# CSIB — Database

PostgreSQL schema for Supabase, organized by domain (one folder per domain, one `schema.sql`
each). Apply in numeric folder order — later domains reference earlier ones via foreign keys.

| Folder | Domain | Key tables |
|---|---|---|
| `00_core` | Core / multi-tenancy root | `clinics` |
| `01_identity` | Auth, RBAC | `profiles`, `roles`, `permissions`, `role_permissions`, `clinic_memberships` |
| `02_professionals` | Staff | `specialties`, `professionals` |
| `03_patients` | Patients | `patients`, `patient_clinical_info` |
| `04_catalog` | Service catalog | `procedures`, `payment_methods` |
| `05_scheduling` | Agenda | `appointments` |
| `06_queue` | Live queue | `queue_entries`, `queue_transfers` |
| `07_service` | Timer | `service_sessions`, `service_session_events` |
| `08_records` | Prontuário | `cid_codes`, `medical_records`, `record_diagnoses` |
| `09_prescriptions` | Prescriptions | `prescriptions`, `prescription_items` |
| `10_documents` | Clinical docs | `document_templates`, `clinical_documents` |
| `11_financial` | Financial | `financial_transactions`, `payments` |
| `12_communication` | Messaging | `message_templates`, `messages` |
| `13_storage` | File metadata | `files` |
| `14_settings` | Clinic config | `clinic_settings` |
| `15_audit` | Audit trail | `audit_logs` |
| `99_seed` | Demo data only | — |

## Known fix applied 2026-08-20

`00_core/schema.sql` originally created `clinics` without RLS or a policy — an oversight,
not something to replicate. Fixed in this file; if your project already had the old
version applied, run just this against it (after `01_identity` exists):

```sql
alter table clinics enable row level security;

create policy clinics_select on clinics for select
  using (has_clinic_access(id));

create policy clinics_update on clinics for update
  using (has_permission(id, 'settings.manage'))
  with check (has_permission(id, 'settings.manage'));
```

## Conventions

- Every tenant-scoped table has `clinic_id uuid not null references clinics(id)`. No table,
  query, or RLS policy assumes a fixed clinic — multi-clinic is a first-class concern even
  though only one clinic (CSIB) exists today.
- `id uuid primary key default gen_random_uuid()` everywhere.
- `created_at` / `updated_at timestamptz`, with `set_updated_at()` trigger (defined in
  `00_core`) wired onto every mutable table.
- Clinical data is never hard-deleted from the app layer; use `active` flags or status enums.
  `medical_records.locked_at` marks a prontuário entry closed for edits.

## Authorization model (two layers, see item 23 of the product spec)

1. **RLS = tenant isolation.** Nearly every policy is `using (has_clinic_access(clinic_id))` —
   it only proves the caller is an active member of that clinic. This keeps ~35 tables'
   policies mechanical and auditable instead of duplicating fine-grained rules in SQL.
2. **`has_permission(clinic_id, slug)` = fine-grained RBAC.** Used in the couple of places
   RLS itself should be stricter (`clinic_memberships`, `clinic_settings`), and — this is the
   important one — checked again in every Server Action/Route Handler before a mutation,
   independent of what the UI shows. Hiding a button is never treated as authorization
   (item 23).

`has_clinic_access` and `has_permission` are defined once in `01_identity/schema.sql` and
reused by every later domain's policies.

## Running this locally against Supabase

```bash
supabase db reset   # or: psql "$DATABASE_URL" -f <each schema.sql in folder order>
```

`99_seed/seed.sql` requires demo `auth.users` to be created first (Supabase Auth cannot be
seeded with plain SQL inserts) — see the comments at the top of that file.
