-- CSIB — Queue domain: the live operational entity (item 12), independent of the agenda.
-- Handles scheduled, walk-in, fit-in, and transferred patients through one status lifecycle.
-- Transfers keep full history via queue_transfers — never overwritten.

create type queue_entry_type as enum ('scheduled', 'walk_in', 'fit_in', 'transfer');
create type queue_status as enum ('waiting', 'called', 'in_service', 'paused', 'completed', 'cancelled');

create table queue_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id),
  appointment_id uuid references appointments(id),
  professional_id uuid references professionals(id),
  specialty_id uuid references specialties(id),
  entry_type queue_entry_type not null default 'scheduled',
  status queue_status not null default 'waiting',
  priority int not null default 0,
  arrived_at timestamptz not null default now(),
  called_at timestamptz,
  service_started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_queue_clinic_status on queue_entries (clinic_id, status);
create index idx_queue_professional_status on queue_entries (professional_id, status);

create trigger trg_queue_entries_updated_at
  before update on queue_entries for each row execute function set_updated_at();

create table queue_transfers (
  id uuid primary key default gen_random_uuid(),
  queue_entry_id uuid not null references queue_entries(id) on delete cascade,
  from_professional_id uuid references professionals(id),
  to_professional_id uuid not null references professionals(id),
  reason text,
  transferred_by uuid references profiles(id),
  transferred_at timestamptz not null default now()
);

alter table queue_entries enable row level security;
alter table queue_transfers enable row level security;

create policy queue_entries_rw on queue_entries for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
create policy queue_transfers_rw on queue_transfers for all
  using (exists (select 1 from queue_entries q where q.id = queue_entry_id and has_clinic_access(q.clinic_id)))
  with check (exists (select 1 from queue_entries q where q.id = queue_entry_id and has_clinic_access(q.clinic_id)));
