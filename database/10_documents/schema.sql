-- CSIB — Clinical documents domain: reusable templates + issued documents (item 18).

create type clinical_document_type as enum ('atestado', 'declaracao', 'relatorio', 'encaminhamento', 'outros');

create table document_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  type clinical_document_type not null,
  name text not null,
  body_template text not null, -- placeholders: {{patient_name}}, {{cpf}}, {{professional_name}}, {{professional_register}}, {{date}}
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table clinical_documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id),
  professional_id uuid not null references professionals(id),
  medical_record_id uuid references medical_records(id),
  template_id uuid references document_templates(id),
  type clinical_document_type not null,
  content text not null,
  file_url text,
  issued_at timestamptz not null default now()
);

alter table document_templates enable row level security;
alter table clinical_documents enable row level security;

create policy document_templates_rw on document_templates for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
create policy clinical_documents_rw on clinical_documents for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
