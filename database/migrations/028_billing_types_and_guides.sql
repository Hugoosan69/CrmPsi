-- ============================================================================
-- CSIB — Migration 028
-- Tipos de cobrança, guias de convênio e o protocolo mensal.
--
-- O sistema nasceu supondo que quem paga é o paciente, no balcão, no dia. O CABEN quebra
-- as três coisas: quem paga é o convênio, o pagamento vem no fim do mês, e vem em lote.
--
--   guia do paciente → atendimento → acumula no mês → protocolo → convênio paga a clínica
--
-- E o caso que obriga o modelo a ser mais que um "sim/não": o paciente tem 2 guias e o
-- tratamento do mês são 4 sessões. As duas primeiras o convênio paga (R$ 60 cada); nas
-- outras duas o paciente paga a diferença (R$ 100). É o MESMO paciente, no MESMO mês, com
-- atendimentos cobrados de fontes diferentes — por isso o tipo de cobrança vive no
-- atendimento, e não no cadastro do paciente.
--
-- Apply against a database that already has migrations/001 .. 027.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Quem paga.
--
-- É o que diferencia um tipo de cobrança do outro — não o nome. `convenio` é o único que
-- gera valor a receber de terceiro e entra em protocolo; `ninguem` (cortesia, retorno
-- cortesia, atendimento social) fecha o atendimento sem cobrança e sem dívida.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'billing_payer') then
    create type billing_payer as enum ('paciente', 'convenio', 'ninguem');
  end if;
end $$;

create table if not exists billing_types (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  payer billing_payer not null default 'paciente',

  -- Só fazem sentido quando `payer = 'convenio'`:
  --   `amount_per_guide`  o que o convênio paga por atendimento (CABEN: R$ 60)
  --   `fallback_amount`   o que o PACIENTE paga quando não há guia disponível (R$ 100)
  --
  -- O fallback é o que permite "CABEN sem guia" sem inventar um segundo cadastro: o
  -- atendimento continua marcado como CABEN — o relatório sabe disso — e a cobrança vai
  -- para o paciente porque o saldo acabou.
  amount_per_guide numeric(10,2) check (amount_per_guide is null or amount_per_guide >= 0),
  fallback_amount numeric(10,2) check (fallback_amount is null or fallback_amount >= 0),

  -- Dados do convênio, para o protocolo e para quem cobra.
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (clinic_id, name)
);

drop trigger if exists trg_billing_types_updated_at on billing_types;
create trigger trg_billing_types_updated_at
  before update on billing_types for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. A autorização que o paciente traz.
--
-- Um número de guia, uma validade e uma quantidade de sessões autorizadas. O saldo é
-- `total_guides - used_guides`, e é ele que decide, no atendimento, se o convênio paga ou
-- se o paciente paga a diferença.
--
-- Mesmo espírito de `patient_packages`: o saldo é do paciente, o consumo é por atendimento.
-- Tabela própria e não reúso porque quem paga é outro, e o dinheiro entra por outro
-- caminho — juntar as duas obrigaria cada consulta a perguntar "é pacote ou é convênio?".
-- ---------------------------------------------------------------------------
create table if not exists patient_guide_authorizations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  billing_type_id uuid not null references billing_types(id),

  guide_number text,
  valid_from date,
  valid_until date,
  total_guides integer not null check (total_guides > 0),
  used_guides integer not null default 0 check (used_guides >= 0),

  /** O documento que o paciente trouxe — referencia `files`, como o resto dos anexos. */
  file_id uuid references files(id),

  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_guide_auth_patient
  on patient_guide_authorizations (clinic_id, patient_id);
create index if not exists idx_guide_auth_billing_type
  on patient_guide_authorizations (billing_type_id);

drop trigger if exists trg_guide_auth_updated_at on patient_guide_authorizations;
create trigger trg_guide_auth_updated_at
  before update on patient_guide_authorizations for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. O protocolo mensal.
--
-- Criado antes das guias emitidas porque elas o referenciam. `aberto` acumula durante o
-- mês; `enviado` é o que foi para o convênio (e a partir daí não recebe guia nova);
-- `liquidado` é o que já teve baixa.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'billing_batch_status') then
    create type billing_batch_status as enum ('aberto', 'enviado', 'liquidado', 'cancelado');
  end if;
end $$;

create table if not exists billing_batches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  billing_type_id uuid not null references billing_types(id),

  /** Primeiro dia do mês de referência — o agrupamento é mensal. */
  reference_month date not null,
  /** Número do protocolo entregue ao convênio. Só existe depois do envio. */
  protocol_number text,
  status billing_batch_status not null default 'aberto',

  sent_at timestamptz,
  settled_at timestamptz,
  /** Recebimento consolidado, quando houver. */
  financial_transaction_id uuid references financial_transactions(id),

  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um protocolo aberto por convênio e mês: dois abertos ao mesmo tempo espalhariam os
-- atendimentos do mesmo mês entre eles, e o convênio receberia duas remessas parciais.
create unique index if not exists idx_billing_batches_open_per_month
  on billing_batches (clinic_id, billing_type_id, reference_month)
  where status = 'aberto';

drop trigger if exists trg_billing_batches_updated_at on billing_batches;
create trigger trg_billing_batches_updated_at
  before update on billing_batches for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. A guia de comprovação, uma por atendimento.
--
-- É o que a clínica emite a cada atendimento e o que vai dentro do protocolo. O desfecho é
-- por guia, e não por protocolo, porque é assim que o convênio responde: paga umas, glosa
-- outras (paga menos) e recusa outras — e a clínica precisa saber QUAL e POR QUÊ para
-- recorrer ou cobrar do paciente.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'service_guide_status') then
    create type service_guide_status as enum ('emitida', 'enviada', 'paga', 'glosada', 'recusada', 'cancelada');
  end if;
end $$;

create table if not exists service_guides (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  billing_type_id uuid not null references billing_types(id),
  authorization_id uuid references patient_guide_authorizations(id),
  batch_id uuid references billing_batches(id),

  /** O que o convênio deve pagar por este atendimento (cópia do valor vigente na emissão:
   *  o combinado muda com o tempo, e o protocolo já enviado não pode mudar junto). */
  amount numeric(10,2) not null check (amount >= 0),
  /** O que ele efetivamente pagou. Menor que `amount` = glosa parcial. */
  paid_amount numeric(10,2) check (paid_amount is null or paid_amount >= 0),
  denial_reason text,

  status service_guide_status not null default 'emitida',
  issued_at timestamptz not null default now(),

  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma guia por atendimento: emitir duas mandaria o mesmo atendimento duas vezes no
-- protocolo, e o convênio pagaria (ou glosaria) em duplicidade.
create unique index if not exists idx_service_guides_one_per_appointment
  on service_guides (appointment_id)
  where status <> 'cancelada';

create index if not exists idx_service_guides_batch on service_guides (batch_id);
create index if not exists idx_service_guides_clinic_status
  on service_guides (clinic_id, status);

drop trigger if exists trg_service_guides_updated_at on service_guides;
create trigger trg_service_guides_updated_at
  before update on service_guides for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Consumo do saldo, no banco.
--
-- Emitir a guia desconta a autorização; cancelar devolve. Fica em gatilho pelo mesmo motivo
-- de `patient_packages`: o saldo tem de estar certo mesmo quando a linha for escrita por
-- um caminho que ninguém previu.
-- ---------------------------------------------------------------------------
create or replace function apply_service_guide_consumption()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.authorization_id is not null and new.status <> 'cancelada' then
    update patient_guide_authorizations
      set used_guides = used_guides + 1
      where id = new.authorization_id;
  elsif tg_op = 'UPDATE' and new.authorization_id is not null then
    -- Cancelar devolve a guia ao saldo; reativar volta a consumi-la.
    if old.status <> 'cancelada' and new.status = 'cancelada' then
      update patient_guide_authorizations
        set used_guides = greatest(0, used_guides - 1)
        where id = new.authorization_id;
    elsif old.status = 'cancelada' and new.status <> 'cancelada' then
      update patient_guide_authorizations
        set used_guides = used_guides + 1
        where id = new.authorization_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_service_guide_consumption on service_guides;
create trigger trg_service_guide_consumption
  after insert or update of status on service_guides
  for each row execute function apply_service_guide_consumption();

-- ---------------------------------------------------------------------------
-- 6. RLS e permissões.
--
-- `billing.manage` e não `catalog.manage`: faturamento por convênio é assunto de dinheiro,
-- não de catálogo clínico — quem cadastra procedimento não decide com quem a clínica
-- fatura. Concedida a quem já tem `financial.manage`.
-- ---------------------------------------------------------------------------
alter table billing_types enable row level security;
alter table patient_guide_authorizations enable row level security;
alter table billing_batches enable row level security;
alter table service_guides enable row level security;

drop policy if exists billing_types_rw on billing_types;
create policy billing_types_rw on billing_types for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));

drop policy if exists patient_guide_authorizations_rw on patient_guide_authorizations;
create policy patient_guide_authorizations_rw on patient_guide_authorizations for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));

drop policy if exists billing_batches_rw on billing_batches;
create policy billing_batches_rw on billing_batches for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));

drop policy if exists service_guides_rw on service_guides;
create policy service_guides_rw on service_guides for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));

insert into permissions (slug, module, description) values
  ('billing.view', 'billing', 'Ver tipos de cobrança, guias e protocolos'),
  ('billing.manage', 'billing', 'Cadastrar tipos de cobrança, emitir guias e fechar protocolos')
on conflict (slug) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug in ('billing.view', 'billing.manage')
  and exists (
    select 1 from role_permissions rp
    join permissions existing on existing.id = rp.permission_id
    where rp.role_id = r.id and existing.slug = 'financial.manage'
  )
on conflict do nothing;

-- Quem atende precisa VER de que forma o atendimento é cobrado, sem poder mudar o cadastro.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug = 'billing.view'
  and exists (
    select 1 from role_permissions rp
    join permissions existing on existing.id = rp.permission_id
    where rp.role_id = r.id and existing.slug = 'service.manage'
  )
on conflict do nothing;

comment on column billing_types.fallback_amount is
  'O que o PACIENTE paga quando o saldo de guias acabou. É o que permite "CABEN sem guia" sem um segundo cadastro: o atendimento segue marcado como do convênio e a cobrança vai para o paciente.';
comment on table service_guides is
  'A guia de comprovação emitida por atendimento. O desfecho é por guia porque é assim que o convênio responde: paga umas, glosa outras, recusa outras.';
