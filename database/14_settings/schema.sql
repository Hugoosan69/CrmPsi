-- CSIB — Settings domain.
-- A single jsonb blob per clinic keeps this flexible for MVP (business hours, default
-- appointment duration, invoice numbering, etc.) without a schema migration per new setting.
-- Promote a key to a real column later only if it needs to be queried/indexed.

create table clinic_settings (
  clinic_id uuid primary key references clinics(id) on delete cascade,
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger trg_clinic_settings_updated_at
  before update on clinic_settings for each row execute function set_updated_at();

alter table clinic_settings enable row level security;

create policy clinic_settings_read on clinic_settings for select using (has_clinic_access(clinic_id));
create policy clinic_settings_write on clinic_settings for all
  using (has_permission(clinic_id, 'settings.manage'))
  with check (has_permission(clinic_id, 'settings.manage'));
