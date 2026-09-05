-- CSIB — Scheduling domain: appointments.
-- Appointment status is deliberately coarse (the calendar-level lifecycle). The live
-- operational states (chegou/aguardando/chamado/em atendimento/pausado) live in the
-- queue domain (06_queue), which references appointments but evolves independently —
-- required because the queue also handles walk-ins and transfers that have no appointment.

-- 'triagem' entrou depois (migrations/022): é uma consulta ativa como 'scheduled' e
-- 'confirmed' — ocupa o horário e conta nos guardas de conflito (migrations/023).
create type appointment_status as enum (
  'scheduled', 'triagem', 'confirmed', 'cancelled', 'no_show', 'completed'
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id),
  professional_id uuid not null references professionals(id),
  procedure_id uuid references procedures(id),
  scheduled_at timestamptz not null,
  duration_minutes int not null default 30,
  status appointment_status not null default 'scheduled',
  notes text,
  cancelled_reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_appointments_clinic_date on appointments (clinic_id, scheduled_at);
create index idx_appointments_professional_date on appointments (professional_id, scheduled_at);

create trigger trg_appointments_updated_at
  before update on appointments for each row execute function set_updated_at();

alter table appointments enable row level security;
create policy appointments_rw on appointments for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
