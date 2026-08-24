-- CSIB — Catalog domain: procedures and payment methods.

create table procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes int not null default 30,
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  slug text not null, -- dinheiro | pix | debito | credito | transferencia | convenio | outros
  active boolean not null default true,
  unique (clinic_id, slug)
);

alter table procedures enable row level security;
alter table payment_methods enable row level security;

create policy procedures_rw on procedures for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
create policy payment_methods_rw on payment_methods for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
