-- CSIB — Storage domain: metadata wrapper around Supabase Storage objects.
-- Actual bytes live in Storage buckets; this table makes uploads queryable/auditable
-- and lets files attach to any entity via related_type/related_id.

create table files (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid references patients(id),
  professional_id uuid references professionals(id),
  related_type text, -- 'clinical_document' | 'prescription' | 'patient' | ...
  related_id uuid,
  bucket text not null,
  path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table files enable row level security;
create policy files_rw on files for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
