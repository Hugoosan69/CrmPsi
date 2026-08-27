-- ============================================================================
-- 003 — Clinic branding readable before login, plus a storage bucket for the
--       logo and the settings row that carries integration config.
--
-- The login screen renders before any session exists, so it cannot read
-- `clinics` (RLS: has_clinic_access) or `clinic_settings` (RLS:
-- has_permission(...,'settings.manage')). Rather than loosening either policy,
-- a narrow security-definer function exposes only the branding fields to anon.
--
-- Apply after 002_agenda_foundation.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Public branding read. Returns only what the login screen draws — never
-- addresses, contact details, or settings.
--
-- `p_slug` null resolves to the single active clinic, which is the CSIB case
-- today. A genuinely multi-clinic deployment gives the login route a slug and
-- passes it here, with no change to this function.
-- ---------------------------------------------------------------------------
create or replace function public_clinic_branding(p_slug text default null)
returns table (
  name text,
  logo_url text,
  mascot_url text,
  primary_color text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.name, c.logo_url, c.mascot_url, c.primary_color
  from clinics c
  where c.active
    and (p_slug is null or c.slug = p_slug)
  -- With no slug this is only meaningful when one active clinic exists; the
  -- limit keeps it deterministic rather than returning an arbitrary row set.
  order by c.created_at
  limit 1;
$$;

revoke all on function public_clinic_branding(text) from public;
grant execute on function public_clinic_branding(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for branding assets. Public read because the login screen is
-- unauthenticated; writes stay restricted to settings.manage.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

drop policy if exists branding_public_read on storage.objects;
create policy branding_public_read on storage.objects for select
  using (bucket_id = 'branding');

drop policy if exists branding_write on storage.objects;
create policy branding_write on storage.objects for insert
  with check (
    bucket_id = 'branding'
    and exists (
      select 1 from clinic_memberships m
      join role_permissions rp on rp.role_id = m.role_id
      join permissions p on p.id = rp.permission_id
      where m.user_id = auth.uid() and m.active and p.slug = 'settings.manage'
    )
  );

drop policy if exists branding_update on storage.objects;
create policy branding_update on storage.objects for update
  using (
    bucket_id = 'branding'
    and exists (
      select 1 from clinic_memberships m
      join role_permissions rp on rp.role_id = m.role_id
      join permissions p on p.id = rp.permission_id
      where m.user_id = auth.uid() and m.active and p.slug = 'settings.manage'
    )
  );

drop policy if exists branding_delete on storage.objects;
create policy branding_delete on storage.objects for delete
  using (
    bucket_id = 'branding'
    and exists (
      select 1 from clinic_memberships m
      join role_permissions rp on rp.role_id = m.role_id
      join permissions p on p.id = rp.permission_id
      where m.user_id = auth.uid() and m.active and p.slug = 'settings.manage'
    )
  );

-- ---------------------------------------------------------------------------
-- Make sure every existing clinic has a settings row, so the settings screen
-- reads and writes without a create-or-update special case.
-- ---------------------------------------------------------------------------
insert into clinic_settings (clinic_id, settings)
select id, '{}'::jsonb from clinics
on conflict (clinic_id) do nothing;
