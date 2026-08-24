-- CSIB — Professionals domain: specialties and professionals.

create table specialties (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table professionals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  user_id uuid references profiles(id), -- null if the professional has no login yet
  full_name text not null,
  professional_register text, -- CRM/CRP/CRO/etc
  specialty_id uuid references specialties(id),
  phone text,
  email text,
  color text not null default '#0B3D5C', -- agenda color coding
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_professionals_updated_at
  before update on professionals for each row execute function set_updated_at();

alter table specialties enable row level security;
alter table professionals enable row level security;

create policy specialties_rw on specialties for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
create policy professionals_rw on professionals for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
