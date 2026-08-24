-- CSIB — Communication domain (item 21).
-- Deliberately provider-agnostic: this schema only records intent (message_templates) and
-- outcome (messages). The actual send goes through a ProviderAdapter interface in
-- src/services/communication — swapping WhatsApp/SMS/e-mail vendors later never touches
-- this table shape.

create type message_channel as enum ('whatsapp', 'sms', 'email');
create type message_type as enum ('confirmation', 'reminder', 'birthday', 'post_visit', 'general');
create type message_status as enum ('queued', 'sent', 'failed', 'skipped');

create table message_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  type message_type not null,
  channel message_channel not null,
  subject text,
  body_template text not null,
  active boolean not null default true
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id),
  template_id uuid references message_templates(id),
  channel message_channel not null,
  type message_type not null,
  status message_status not null default 'queued',
  payload jsonb,
  scheduled_at timestamptz,
  sent_at timestamptz,
  provider_response jsonb,
  created_at timestamptz not null default now()
);

alter table message_templates enable row level security;
alter table messages enable row level security;

create policy message_templates_rw on message_templates for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
create policy messages_rw on messages for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
