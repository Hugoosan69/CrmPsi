-- CSIB — Audit domain (item 22).
-- Client code never inserts here directly (no client-facing insert policy). Every server
-- action that performs a sensitive mutation (login, patient CRUD, appointment lifecycle,
-- queue/service transitions, document/prescription issuance, financial and user/permission
-- changes) writes one row here, via the service-role connection, after the mutation commits.

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete set null,
  user_id uuid references profiles(id),
  action text not null, -- e.g. 'patient.create', 'appointment.cancel', 'service.pause'
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_audit_clinic_created on audit_logs (clinic_id, created_at desc);

alter table audit_logs enable row level security;
create policy audit_logs_select on audit_logs for select using (has_clinic_access(clinic_id));
