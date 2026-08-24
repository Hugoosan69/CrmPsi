-- CSIB — Clinical records domain: CID reference table, prontuário entries, diagnoses.
-- medical_records is never silently deleted (item 16) — locked_at marks a record closed
-- for edits; corrections after that point must be a new record or a documented amendment,
-- both of which flow through audit_logs.

create table cid_codes (
  code text primary key,
  description text not null,
  category text
);

create table medical_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id),
  professional_id uuid not null references professionals(id),
  appointment_id uuid references appointments(id),
  queue_entry_id uuid references queue_entries(id),
  service_session_id uuid references service_sessions(id),
  chief_complaint text,
  history text,
  exam text,
  assessment text,
  plan text,
  notes text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_medical_records_patient on medical_records (patient_id, created_at desc);

create trigger trg_medical_records_updated_at
  before update on medical_records for each row execute function set_updated_at();

create table record_diagnoses (
  id uuid primary key default gen_random_uuid(),
  medical_record_id uuid not null references medical_records(id) on delete cascade,
  cid_code text not null references cid_codes(code),
  is_primary boolean not null default false
);

alter table cid_codes enable row level security;
alter table medical_records enable row level security;
alter table record_diagnoses enable row level security;

create policy cid_codes_select on cid_codes for select using (auth.role() = 'authenticated');
create policy medical_records_rw on medical_records for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
create policy record_diagnoses_rw on record_diagnoses for all
  using (exists (select 1 from medical_records m where m.id = medical_record_id and has_clinic_access(m.clinic_id)))
  with check (exists (select 1 from medical_records m where m.id = medical_record_id and has_clinic_access(m.clinic_id)));
