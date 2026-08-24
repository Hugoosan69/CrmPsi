-- CSIB — Prescriptions domain: one prescription can carry multiple medication items.

create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id),
  professional_id uuid not null references professionals(id),
  medical_record_id uuid references medical_records(id),
  issued_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  medication_name text not null,
  concentration text,
  pharmaceutical_form text,
  dose text,
  frequency text,
  duration text,
  quantity text,
  instructions text,
  order_index int not null default 0
);

alter table prescriptions enable row level security;
alter table prescription_items enable row level security;

create policy prescriptions_rw on prescriptions for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
create policy prescription_items_rw on prescription_items for all
  using (exists (select 1 from prescriptions p where p.id = prescription_id and has_clinic_access(p.clinic_id)))
  with check (exists (select 1 from prescriptions p where p.id = prescription_id and has_clinic_access(p.clinic_id)));
