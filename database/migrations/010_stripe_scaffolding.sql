-- ============================================================================
-- 010 — Base para pagamentos online (Stripe).
--
-- Só o alicerce do lado do banco: não há cobrança nem tela de checkout ainda. O
-- que se resolve aqui são as duas coisas que precisam existir ANTES do primeiro
-- webhook, porque adicioná-las depois exigiria reprocessar histórico.
--
-- 1. Idempotência. O Stripe garante entrega ao menos uma vez, não exatamente
--    uma: reenvia até receber 2xx, e reenvia de novo se a resposta demorar. Sem
--    um registro do que já foi processado, uma retentativa de
--    `payment_intent.succeeded` grava o mesmo recebimento duas vezes e o caixa
--    do dia fecha errado.
--
-- 2. Ligação com o pagamento externo. `payments` hoje só descreve dinheiro
--    recebido no balcão. Um recebimento vindo do Stripe precisa apontar de volta
--    para o objeto que o originou — para conciliar, para estornar, e para o
--    índice único que sustenta o item 1.
--
-- Apply against a database that already has migrations/001 .. 009.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Origem externa de um recebimento.
--
-- Duas colunas genéricas em vez de `stripe_payment_intent_id`: o dia em que a
-- clínica aceitar Pix por PSP ou maquininha integrada, é a mesma forma — e uma
-- coluna com nome de fornecedor viraria um remendo.
-- ---------------------------------------------------------------------------
alter table payments add column if not exists external_provider text;
alter table payments add column if not exists external_id text;

-- Esta é a garantia real contra duplicidade: mesmo que a lógica da aplicação
-- falhe, o banco recusa o segundo recebimento do mesmo objeto do Stripe.
-- Parcial porque a imensa maioria dos pagamentos é de balcão e não tem origem
-- externa — sem o `where`, um único índice sobre dois nulos barraria o segundo
-- pagamento em dinheiro.
create unique index if not exists uq_payments_external
  on payments (external_provider, external_id)
  where external_provider is not null and external_id is not null;

-- ---------------------------------------------------------------------------
-- Eventos recebidos.
--
-- A chave primária é o id do evento no Stripe, não um uuid nosso: é ele que
-- torna a segunda entrega do mesmo evento uma violação de chave, em vez de uma
-- consulta que pode dar falso negativo sob concorrência.
--
-- Guarda o payload inteiro. Quando um recebimento não bate, a pergunta é sempre
-- "o que exatamente o Stripe mandou" — e a resposta não está em lugar nenhum se
-- só gravarmos o que soubemos interpretar na época.
-- ---------------------------------------------------------------------------
create table if not exists stripe_events (
  id text primary key,
  clinic_id uuid references clinics(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  -- Nulo enquanto não processado. Distinguir "recebido" de "processado" é o que
  -- permite reprocessar uma falha sem perder o registro de que chegou.
  processed_at timestamptz,
  error text
);

create index if not exists idx_stripe_events_unprocessed
  on stripe_events (received_at)
  where processed_at is null;

alter table stripe_events enable row level security;

-- Sem policy de acesso por clínica de propósito. Quem escreve aqui é o webhook,
-- pela service role (que ignora RLS); leitura é diagnóstico, feito pelo painel
-- do Supabase. Uma tabela com RLS ligada e nenhuma policy nega tudo para
-- `authenticated` — que é exatamente o desejado: o payload do Stripe pode conter
-- dados de cartão e endereço de cobrança, e nada no aplicativo precisa lê-lo.

-- ---------------------------------------------------------------------------
-- Forma de pagamento para o que entrar pelo Stripe.
--
-- Sem isto o webhook não teria o que gravar em `payments.payment_method_id`, que
-- é obrigatório. Criada para toda clínica existente.
-- ---------------------------------------------------------------------------
insert into payment_methods (clinic_id, name, slug)
select c.id, 'Cartão online (Stripe)', 'stripe'
from clinics c
on conflict do nothing;
