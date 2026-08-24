-- CSIB — Patients domain: patient records and clinical info summary (allergies etc).

create table patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  full_name text not null,
  social_name text,
  cpf text,
  birth_date date,
  sex text,
  phone text,
  whatsapp text,
  email text,
  mother_name text,
  address jsonb,
  notes text,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fast-search requirement (item 9/27): name, CPF, phone, whatsapp.
create index idx_patients_clinic_name on patients (clinic_id, full_name);
create index idx_patients_clinic_cpf on patients (clinic_id, cpf);
create index idx_patients_clinic_phone on patients (clinic_id, phone);
create index idx_patients_clinic_whatsapp on patients (clinic_id, whatsapp);

create trigger trg_patients_updated_at
  before update on patients for each row execute function set_updated_at();

create table patient_clinical_info (
  patient_id uuid primary key references patients(id) on delete cascade,
  allergies text[],
  chronic_conditions text[],
  current_medications text[],
  relevant_history text,
  updated_at timestamptz not null default now()
);

alter table patients enable row level security;
alter table patient_clinical_info enable row level security;

create policy patients_rw on patients for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
create policy patient_clinical_info_rw on patient_clinical_info for all
  using (exists (select 1 from patients p where p.id = patient_id and has_clinic_access(p.clinic_id)))
  with check (exists (select 1 from patients p where p.id = patient_id and has_clinic_access(p.clinic_id)));
