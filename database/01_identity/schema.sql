-- CSIB — Identity domain
-- Profiles, roles, granular permissions, and clinic memberships (the RBAC join table).
-- Also defines the two authorization helper functions every later RLS policy relies on.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- System roles (owner, admin, receptionist, professional, financial) have clinic_id = null
-- and are available to every clinic. Custom per-clinic roles can be added later without
-- touching this schema.
create table roles (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (clinic_id, slug)
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  module text not null,
  description text
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role_id uuid not null references roles(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

-- Tenant isolation boundary: does the current JWT's user belong (actively) to this clinic?
create or replace function has_clinic_access(target_clinic_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from clinic_memberships cm
    where cm.clinic_id = target_clinic_id
      and cm.user_id = auth.uid()
      and cm.active
  );
$$;

-- Fine-grained authorization: does the current user's role in this clinic grant a permission?
-- Used server-side (Server Actions / Route Handlers) before any mutation, and optionally in
-- RLS for a handful of sensitive tables (settings, users). RLS itself otherwise only enforces
-- tenant isolation via has_clinic_access — granular CRUD rules live in the service layer so
-- they can be unit-tested and are not duplicated as dozens of near-identical SQL policies.
create or replace function has_permission(target_clinic_id uuid, permission_slug text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from clinic_memberships cm
    join role_permissions rp on rp.role_id = cm.role_id
    join permissions p on p.id = rp.permission_id
    where cm.clinic_id = target_clinic_id
      and cm.user_id = auth.uid()
      and cm.active
      and p.slug = permission_slug
  );
$$;

alter table profiles enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table clinic_memberships enable row level security;

create policy profiles_select on profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from clinic_memberships mine
      join clinic_memberships theirs on theirs.clinic_id = mine.clinic_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );
create policy profiles_update_self on profiles for update using (id = auth.uid());

-- Reference tables: readable by any authenticated user, mutated only via service-role
-- server actions gated on has_permission(clinic_id, 'users.manage').
create policy roles_select on roles for select using (auth.role() = 'authenticated');
create policy permissions_select on permissions for select using (auth.role() = 'authenticated');
create policy role_permissions_select on role_permissions for select using (auth.role() = 'authenticated');

create policy clinic_memberships_select on clinic_memberships for select
  using (has_clinic_access(clinic_id));
create policy clinic_memberships_write on clinic_memberships for all
  using (has_permission(clinic_id, 'users.manage'))
  with check (has_permission(clinic_id, 'users.manage'));
