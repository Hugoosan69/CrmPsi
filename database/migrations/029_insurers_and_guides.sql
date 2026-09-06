-- ============================================================================
-- CSIB — Migration 029
-- Corrige o modelo de convênio: guia e avulso CONVIVEM no mesmo atendimento.
--
-- A 028 modelou "ou a guia paga, ou o paciente paga o valor cheio" (`fallback_amount`).
-- Está errado. O que acontece de verdade:
--
--   o paciente chega COM a guia  → o convênio paga o valor da guia (CABEN: R$ 60)
--   e, se faltar diferença       → o paciente paga um avulso POR CIMA, no mesmo atendimento
--
-- São duas cobranças num atendimento só, de duas fontes, e as duas precisam aparecer na
-- ficha do paciente. Um campo de "valor alternativo" nunca daria conta disso.
--
-- Também separa duas coisas que a 028 juntou numa tabela só:
--   TIPO DE COBRANÇA  particular / convênio / cortesia — fixo, escolhido no atendimento
--   CONVÊNIO          CABEN e outros — cadastro, com CRUD próprio
-- É essa separação que faz a tela poder abrir a lista de convênios só depois que alguém
-- escolhe "convênio" como tipo.
--
-- Apply against a database that already has migrations/001 .. 028.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. `billing_types` era convênio disfarçado de tipo. Vira `insurers`.
-- ---------------------------------------------------------------------------
alter table if exists billing_types rename to insurers;

alter table insurers drop column if exists payer;
alter table insurers drop column if exists fallback_amount;

-- O que o convênio paga por guia passa a ser obrigatório: um convênio sem valor não
-- consegue gerar protocolo, e descobrir isso no fim do mês é tarde.
update insurers set amount_per_guide = 0 where amount_per_guide is null;
alter table insurers alter column amount_per_guide set not null;
alter table insurers alter column amount_per_guide set default 0;

-- `billing_payer` deixa de existir: quem paga passou a ser dito pelo tipo de cobrança do
-- atendimento, não pelo cadastro.
drop type if exists billing_payer;

-- ---------------------------------------------------------------------------
-- 2. O tipo de cobrança vive no ATENDIMENTO.
--
-- É o que permite o mesmo paciente ter, no mesmo mês, sessões pagas pelo convênio e
-- sessões pagas por ele — que foi exatamente o caso que motivou tudo isto.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_billing_kind') then
    create type appointment_billing_kind as enum ('particular', 'convenio', 'cortesia');
  end if;
end $$;

alter table appointments
  add column if not exists billing_kind appointment_billing_kind not null default 'particular',
  add column if not exists insurer_id uuid references insurers(id);

create index if not exists idx_appointments_insurer on appointments (insurer_id);

-- Convênio exige dizer QUAL: sem isso o atendimento entraria no protocolo de ninguém.
alter table appointments drop constraint if exists appointments_insurer_required;
alter table appointments add constraint appointments_insurer_required
  check (billing_kind <> 'convenio' or insurer_id is not null);

-- ---------------------------------------------------------------------------
-- 3. A guia do atendimento.
--
-- Some `authorization_id`: não há saldo pré-carregado a consumir — o paciente traz a guia
-- e o número dela é informado no atendimento. Entram o número e o anexo.
--
-- O anexo aceita DOIS caminhos de propósito, porque a decisão de onde guardar ainda está
-- em aberto: `file_id` para o storage da própria clínica e `attachment_url` para um
-- endereço externo (Google Drive, por exemplo). Quem lê usa o que estiver preenchido, e
-- trocar de estratégia depois não exige migrar o que já foi anexado.
-- ---------------------------------------------------------------------------
alter table service_guides
  add column if not exists guide_number text,
  add column if not exists file_id uuid references files(id),
  add column if not exists attachment_url text;

alter table service_guides drop column if exists authorization_id;
alter table service_guides drop column if exists billing_type_id;
alter table service_guides add column if not exists insurer_id uuid references insurers(id);

update service_guides set insurer_id = (select id from insurers limit 1) where insurer_id is null;
alter table service_guides alter column insurer_id set not null;

create index if not exists idx_service_guides_insurer on service_guides (insurer_id);

-- O gatilho de consumo de saldo perde o sentido junto com a autorização.
drop trigger if exists trg_service_guide_consumption on service_guides;
drop function if exists apply_service_guide_consumption();
drop table if exists patient_guide_authorizations;

-- ---------------------------------------------------------------------------
-- 4. O protocolo passa a apontar o convênio, não o "tipo".
-- ---------------------------------------------------------------------------
alter table billing_batches drop constraint if exists billing_batches_billing_type_id_fkey;
alter table billing_batches rename column billing_type_id to insurer_id;
alter table billing_batches
  add constraint billing_batches_insurer_id_fkey
  foreign key (insurer_id) references insurers(id);

drop index if exists idx_billing_batches_open_per_month;
create unique index idx_billing_batches_open_per_month
  on billing_batches (clinic_id, insurer_id, reference_month)
  where status = 'aberto';

-- ---------------------------------------------------------------------------
-- 5. RLS da tabela renomeada.
-- ---------------------------------------------------------------------------
alter table insurers enable row level security;
drop policy if exists billing_types_rw on insurers;
drop policy if exists insurers_rw on insurers;
create policy insurers_rw on insurers for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));

comment on table insurers is
  'Convênios com quem a clínica fatura. O tipo de cobrança do atendimento diz SE é convênio; esta tabela diz QUAL.';
comment on column service_guides.attachment_url is
  'Endereço externo do anexo, para quando a guia não for guardada no storage da clínica. Coexiste com file_id: a decisão de onde guardar ainda está em aberto, e quem lê usa o que estiver preenchido.';
comment on column appointments.billing_kind is
  'Como ESTE atendimento é cobrado. Fica no atendimento e não no paciente porque o mesmo paciente tem, no mesmo mês, sessões pelo convênio e sessões particulares.';
