-- ============================================================================
-- 007 — Campanhas e automações de mensageria.
--
-- Antes disto a mensageria só sabia enviar uma mensagem para um paciente, na
-- hora, a partir de um modelo. Faltavam as duas formas que a clínica realmente
-- usa:
--
--   CAMPANHA  — um disparo para um público (todos os ativos, os inativos, ou
--               uma pessoa), opcionalmente agendado para uma data. É a
--               promoção, o aviso de recesso, o convite para um evento.
--
--   AUTOMAÇÃO — uma regra que dispara sozinha a partir de um evento: aniversário
--               do paciente, consulta se aproximando, atendimento concluído.
--               Não tem data; tem gatilho e deslocamento.
--
-- As duas gravam em `messages`, que já tem scheduled_at e status — o envio em si
-- continua passando pelo mesmo dispatcher e pelo n8n.
--
-- Apply against a database that already has 00_core .. 15_audit and
-- migrations/001 .. 006.
-- ============================================================================

do $$ begin
  -- Público-alvo. "inactive" é intencionalmente separado de "all": reativar quem
  -- sumiu é uma campanha diferente de avisar quem já frequenta, e misturá-las
  -- produz mensagem errada para metade da lista.
  create type campaign_audience as enum ('active', 'inactive', 'all', 'single');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type campaign_status as enum ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists message_campaigns (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  channel message_channel not null default 'whatsapp',
  subject text,
  body_template text not null,
  audience campaign_audience not null default 'active',
  -- Só usado quando audience = 'single'.
  patient_id uuid references patients(id) on delete set null,
  -- Nulo = enviar assim que confirmado; preenchido = fila até a data.
  scheduled_for timestamptz,
  status campaign_status not null default 'draft',
  -- Preenchidos no disparo, para a tela mostrar o resultado sem recontar.
  recipients_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Uma campanha para uma pessoa só precisa dizer qual é.
  constraint campaign_single_needs_patient
    check (audience <> 'single' or patient_id is not null)
);

create index if not exists message_campaigns_due_idx
  on message_campaigns (clinic_id, status, scheduled_for);

drop trigger if exists trg_message_campaigns_updated_at on message_campaigns;
create trigger trg_message_campaigns_updated_at
  before update on message_campaigns
  for each row execute function set_updated_at();

alter table message_campaigns enable row level security;

drop policy if exists message_campaigns_select on message_campaigns;
create policy message_campaigns_select on message_campaigns for select
  using (has_clinic_access(clinic_id));

drop policy if exists message_campaigns_write on message_campaigns;
create policy message_campaigns_write on message_campaigns for all
  using (has_permission(clinic_id, 'settings.manage'))
  with check (has_permission(clinic_id, 'settings.manage'));

-- ---------------------------------------------------------------------------
-- Automações: uma linha por tipo de evento, por clínica.
--
-- `offset_minutes` é assinado e relativo ao evento, que é o que permite as três
-- formas com um só campo: -1440 é "lembrete um dia antes da consulta", +120 é
-- "pedido de avaliação duas horas depois do atendimento", e 0 com send_at_time
-- é "aniversário, às 9h do dia".
-- ---------------------------------------------------------------------------
create table if not exists message_automations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  type message_type not null,
  enabled boolean not null default false,
  channel message_channel not null default 'whatsapp',
  template_id uuid references message_templates(id) on delete set null,
  offset_minutes integer not null default 0,
  -- Hora do dia para automações sem hora própria (aniversário). Nulo usa o
  -- deslocamento puro.
  send_at_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Uma automação por tipo por clínica: duas regras de aniversário mandariam a
  -- mensagem duas vezes, e não há leitura sensata para isso.
  unique (clinic_id, type)
);

drop trigger if exists trg_message_automations_updated_at on message_automations;
create trigger trg_message_automations_updated_at
  before update on message_automations
  for each row execute function set_updated_at();

alter table message_automations enable row level security;

drop policy if exists message_automations_select on message_automations;
create policy message_automations_select on message_automations for select
  using (has_clinic_access(clinic_id));

drop policy if exists message_automations_write on message_automations;
create policy message_automations_write on message_automations for all
  using (has_permission(clinic_id, 'settings.manage'))
  with check (has_permission(clinic_id, 'settings.manage'));

-- ---------------------------------------------------------------------------
-- `messages` passa a saber de qual campanha veio, para a tela poder mostrar o
-- resultado de um disparo e para não reenviar o que já saiu.
-- ---------------------------------------------------------------------------
alter table messages
  add column if not exists campaign_id uuid references message_campaigns(id) on delete set null;

create index if not exists messages_campaign_idx on messages (campaign_id);

-- Fila do worker: o que está agendado e ainda não saiu.
create index if not exists messages_due_idx
  on messages (clinic_id, status, scheduled_at)
  where status = 'queued';

-- ---------------------------------------------------------------------------
-- Destinatários de uma campanha, resolvidos na hora do disparo.
--
-- Em SQL para que a definição de "paciente ativo" seja a mesma da tela de
-- pacientes — repetir esse filtro em TypeScript é como uma campanha acaba indo
-- para um público diferente do que a tela mostrou.
-- ---------------------------------------------------------------------------
create or replace function campaign_recipients(p_campaign uuid)
returns table (patient_id uuid, full_name text, phone text, email text)
language sql
stable
as $$
  select p.id, coalesce(nullif(p.social_name, ''), p.full_name), p.phone, p.email
  from message_campaigns c
  join patients p on p.clinic_id = c.clinic_id
  where c.id = p_campaign
    and (
      (c.audience = 'single' and p.id = c.patient_id)
      or (c.audience = 'active'   and p.active)
      or (c.audience = 'inactive' and not p.active)
      or (c.audience = 'all')
    )
  order by 2;
$$;
