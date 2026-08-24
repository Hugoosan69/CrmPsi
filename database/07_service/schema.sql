-- CSIB — Service domain: the timer (item 14).
-- The visual timer is a rendering of service_session_events timestamps, never the
-- browser clock — start/pause/resume/finish are each a durable, auditable event, which
-- later enables tempo médio / tempo efetivo / produtividade analytics.

create type service_event_type as enum ('start', 'pause', 'resume', 'finish');

create table service_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  queue_entry_id uuid not null references queue_entries(id),
  professional_id uuid not null references professionals(id),
  patient_id uuid not null references patients(id),
  started_at timestamptz,
  finished_at timestamptz,
  total_paused_seconds int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_service_sessions_updated_at
  before update on service_sessions for each row execute function set_updated_at();

create table service_session_events (
  id uuid primary key default gen_random_uuid(),
  service_session_id uuid not null references service_sessions(id) on delete cascade,
  event_type service_event_type not null,
  occurred_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

alter table service_sessions enable row level security;
alter table service_session_events enable row level security;

create policy service_sessions_rw on service_sessions for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
create policy service_session_events_rw on service_session_events for all
  using (exists (select 1 from service_sessions s where s.id = service_session_id and has_clinic_access(s.clinic_id)))
  with check (exists (select 1 from service_sessions s where s.id = service_session_id and has_clinic_access(s.clinic_id)));
