-- CSIB — Core domain
-- Extensions, shared trigger functions, and the `clinics` table (root of multi-tenancy).

create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  slug text not null unique,
  logo_url text,
  mascot_url text,
  primary_color text not null default '#0B3D5C',
  secondary_color text not null default '#F5F7FA',
  phone text,
  email text,
  address jsonb,
  timezone text not null default 'America/Sao_Paulo',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_clinics_updated_at
  before update on clinics
  for each row execute function set_updated_at();

-- Every tenant-scoped table in the domains below carries a `clinic_id` referencing this table.
-- No code path may assume a fixed clinic_id — the active clinic always comes from the
-- caller's clinic_memberships row (see 01_identity/schema.sql).

-- NOTE: the policies below call has_clinic_access()/has_permission(), which are only
-- defined once 01_identity/schema.sql has run. If applying this file standalone (e.g. as
-- a fix on an already-provisioned database), run it after 01_identity, or run just the
-- block below once 01_identity exists.
alter table clinics enable row level security;

create policy clinics_select on clinics for select
  using (has_clinic_access(id));

create policy clinics_update on clinics for update
  using (has_permission(id, 'settings.manage'))
  with check (has_permission(id, 'settings.manage'));
