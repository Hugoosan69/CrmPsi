-- ============================================================================
-- CSIB — Migration 025
-- Teleatendimento: videochamada com chat, vinculada ao agendamento.
--
-- A chamada pendura em `appointments`, e não em `queue_entries`/`service_sessions`, por um
-- motivo de ordem no tempo: o link precisa ser gerado e enviado ANTES de o paciente chegar,
-- e as outras duas só passam a existir depois do check-in presencial — que numa teleconsulta
-- não acontece. O agendamento é a única âncora que existe na hora de convidar.
--
-- Pelo mesmo motivo a teleconsulta NÃO cria entrada na fila: o gate de pagamento
-- (migration 001) é operado no balcão, e não há balcão aqui. A cobrança segue pelo
-- financeiro como qualquer outra, à parte do fluxo de fila.
--
-- Apply against a database that already has migrations/001 .. 024.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Situação da chamada.
--    aguardando → em_andamento → encerrada, ou cancelada a qualquer momento antes.
--    As transições reais vêm do webhook do LiveKit, não da tela: quem sabe se alguém
--    entrou de fato é o servidor de mídia.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'video_call_status') then
    create type video_call_status as enum ('aguardando', 'em_andamento', 'encerrada', 'cancelada');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'video_call_role') then
    create type video_call_role as enum ('atendente', 'cliente', 'supervisor');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. A chamada.
--
-- `room_name` é um uuid próprio, nunca derivado do paciente ou do agendamento: nome de
-- sala adivinhável é o mesmo que sala sem porta. É `unique` porque o LiveKit trata o nome
-- como identidade da sala.
-- ---------------------------------------------------------------------------
create table if not exists video_calls (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  room_name uuid not null unique default gen_random_uuid(),
  status video_call_status not null default 'aguardando',
  created_by uuid references profiles(id),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_video_calls_appointment on video_calls (appointment_id);
create index if not exists idx_video_calls_clinic_status on video_calls (clinic_id, status);

drop trigger if exists trg_video_calls_updated_at on video_calls;
create trigger trg_video_calls_updated_at
  before update on video_calls for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. O convite do paciente.
--
-- Guarda o HASH do token, nunca o token. Quem tiver leitura desta tabela — um backup, um
-- dump, um SELECT mal colocado — não consegue entrar na consulta de ninguém. O mesmo
-- princípio de uma tabela de senhas, e pela mesma razão.
-- ---------------------------------------------------------------------------
create table if not exists video_call_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  call_id uuid not null references video_calls(id) on delete cascade,
  token_hash text not null unique,
  display_name text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  used_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_video_call_invites_call on video_call_invites (call_id);

-- ---------------------------------------------------------------------------
-- 4. Quem entrou e quando. Escrito pelo webhook, não pela tela.
-- ---------------------------------------------------------------------------
create table if not exists video_call_participants (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  call_id uuid not null references video_calls(id) on delete cascade,
  identity text not null,
  display_name text,
  papel video_call_role not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create index if not exists idx_video_call_participants_call on video_call_participants (call_id);
create unique index if not exists idx_video_call_participants_open
  on video_call_participants (call_id, identity)
  where left_at is null;

-- ---------------------------------------------------------------------------
-- 5. O chat.
--
-- O transporte é o data channel do LiveKit; esta tabela é a memória — é o que faz quem
-- entra atrasado ver o que já foi dito, e o que sobrevive a um F5.
--
-- `body` é TEXTO. Nunca renderizar como HTML: o conteúdo vem de quem está na sala, e o
-- paciente é um estranho do ponto de vista do sistema.
-- ---------------------------------------------------------------------------
create table if not exists video_call_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  call_id uuid not null references video_calls(id) on delete cascade,
  sender_identity text not null,
  sender_name text not null,
  body text not null check (length(body) between 1 and 2000),
  sent_at timestamptz not null default now()
);

create index if not exists idx_video_call_messages_call_sent
  on video_call_messages (call_id, sent_at);

-- ---------------------------------------------------------------------------
-- 6. RLS — isolamento por clínica, como as outras ~35 tabelas.
--
-- O paciente NÃO tem sessão no Supabase: ele chega por link. Toda leitura e escrita do
-- lado dele passa pelo servidor com a service role, depois de validar o convite — mesmo
-- arranjo de `notifications` (migration 004), onde a confiança vem de a escrita só poder
-- ter nascido no servidor.
-- ---------------------------------------------------------------------------
alter table video_calls enable row level security;
alter table video_call_invites enable row level security;
alter table video_call_participants enable row level security;
alter table video_call_messages enable row level security;

drop policy if exists video_calls_rw on video_calls;
create policy video_calls_rw on video_calls for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));

drop policy if exists video_call_invites_rw on video_call_invites;
create policy video_call_invites_rw on video_call_invites for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));

drop policy if exists video_call_participants_rw on video_call_participants;
create policy video_call_participants_rw on video_call_participants for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));

drop policy if exists video_call_messages_rw on video_call_messages;
create policy video_call_messages_rw on video_call_messages for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));

-- ---------------------------------------------------------------------------
-- 7. Permissões (mesmo padrão da migration 009).
--
-- `telehealth.view` acompanha quem já vê a agenda; `telehealth.manage` — abrir chamada e
-- convidar — acompanha quem já conduz o atendimento, mais recepção e gestão.
-- ---------------------------------------------------------------------------
insert into permissions (slug, module, description) values
  ('telehealth.view', 'telehealth', 'Ver teleconsultas e o histórico da chamada'),
  ('telehealth.manage', 'telehealth', 'Abrir teleconsulta, convidar o paciente e encerrar')
on conflict (slug) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug in ('telehealth.view', 'telehealth.manage')
  and exists (
    select 1 from role_permissions rp
    join permissions existing on existing.id = rp.permission_id
    where rp.role_id = r.id and existing.slug = 'service.manage'
  )
on conflict do nothing;

-- Recepção e gestão também abrem e acompanham: quem marca a consulta é quem manda o link.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug in ('telehealth.view', 'telehealth.manage')
  and exists (
    select 1 from role_permissions rp
    join permissions existing on existing.id = rp.permission_id
    where rp.role_id = r.id and existing.slug = 'agenda.manage'
  )
on conflict do nothing;

comment on table video_calls is
  'Teleconsulta vinculada a um agendamento. Não cria entrada na fila: o gate de pagamento da migration 001 é operado no balcão, e teleconsulta não passa por balcão.';
comment on column video_call_invites.token_hash is
  'SHA-256 do token do link. O token em claro só existe no momento em que é gerado e entregue.';
