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
| `migrations/002` | Agenda foundation | `rooms`, `professional_availability`, `schedule_exceptions` |
| `migrations/004` | Internal comms | `conversations`, `conversation_participants`, `internal_messages`, `notifications` |
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

Apply in this order. **The `migrations/` folder is not optional** — the domain `schema.sql`
files describe the original shape, and each migration carries changes made after that.
Provisioning only `00_core .. 15_audit` produces a database this application cannot run
against: the payment gate has no enum values or columns, and the agenda has no availability
rules, so the app reports "banco de dados desatualizado" on the affected screens.

```bash
# 1. domain schemas, in numeric folder order
psql "$DATABASE_URL" -f 00_core/schema.sql          # ... through 15_audit/schema.sql

# 2. migrations, in numeric order
psql "$DATABASE_URL" -f migrations/001_payment_gate_and_timer.sql
psql "$DATABASE_URL" -f migrations/002_agenda_foundation.sql
psql "$DATABASE_URL" -f migrations/003_branding_and_integrations.sql
psql "$DATABASE_URL" -f migrations/004_internal_comms.sql

# 3. reference + demo data
psql "$DATABASE_URL" -f 08_records/seed_cid.sql
psql "$DATABASE_URL" -f 99_seed/seed.sql
```

Or paste each file into the Supabase SQL Editor in the same order.

| Migration | Adds |
|---|---|
| `001_payment_gate_and_timer.sql` | `queue_status` gains `payment_pending` / `released`; `queue_entries.financial_transaction_id`, `released_at`, `released_by`; `appointments.checked_in_at`; `service_sessions.total_seconds`, `effective_seconds`; the trigger enforcing payment before the queue |
| `002_agenda_foundation.sql` | `rooms`, `professional_availability`, `schedule_exceptions`; `appointments.room_id` and a trigger-maintained `time_range` (a GENERATED column would need to be IMMUTABLE, and `timestamptz + interval` is only STABLE — depends on session TimeZone/DST — so Postgres refuses it with 42P07); GiST exclusion constraints preventing professional and room double-booking; the `appointment_slot_problem`, `professional_free_slots` and `clinic_occupancy` functions |
| `003_branding_and_integrations.sql` | `public_clinic_branding()` — a security-definer read granted to `anon` so the login screen can show the clinic's logo without a session; the public-read `branding` storage bucket with `settings.manage`-gated writes; a `clinic_settings` row per clinic |
| `004_internal_comms.sql` | `conversations`, `conversation_participants`, `internal_messages`, `notifications`; `is_conversation_participant()`. **Note:** these are the only tables in the schema *not* scoped with `has_clinic_access` — chat is scoped to participation and notifications to `user_id = auth.uid()`, because a direct message must not be readable by every clinic member. Also adds both tables to the realtime publication |
| `005_user_permission_overrides.sql` | `user_permission_overrides` — exceção de permissão por pessoa, sobrepondo o papel. `has_permission()` consulta o override antes do papel; `user_effective_permissions()` alimenta a tela de gestão. Necessária porque os papéis do sistema têm `clinic_id = null` (compartilhados entre tenants) e por isso nenhuma clínica pode editá-los. **Com a tabela vazia o comportamento é idêntico ao anterior** |
| `006_specialty_unique_name.sql` | índice único `(clinic_id, name)` em `specialties` — a tabela nasceu sem ele, ao contrário de `rooms`, e aceitava nomes repetidos em silêncio |
| `007_campaigns_and_automations.sql` | `message_campaigns` (disparo para um público, opcionalmente agendado) e `message_automations` (regra recorrente a partir de um evento: confirmação, lembrete, aniversário, avaliação). `messages` ganha `campaign_id`, e `campaign_recipients()` resolve o público em SQL para "paciente ativo" ter a mesma definição da tela de pacientes |
| `008_campaign_patient_cascade.sql` | troca o `on delete set null` de `message_campaigns.patient_id` por `cascade`. A 007 o combinou com um CHECK exigindo `patient_id` para público `single`, e as duas regras se contradizem: apagar o paciente anulava a coluna e violava o CHECK, tornando o paciente **inapagável**. Descoberto limpando o banco para produção |
| `009_granular_permissions_and_avatars.sql` | quebra `settings.manage` em `catalog.manage`, `agenda.configure`, `professionals.manage`, `communication.manage` e `integrations.manage`. As quatro primeiras são concedidas a quem já tinha `settings.manage`, então ninguém perde acesso ao aplicar; `integrations.manage` fica **só no proprietário** — quem conecta o WhatsApp da clínica ou a conta de pagamentos precisa de mais confiança que um administrador, e a exceção por pessoa da 005 resolve os casos avulsos. Cria também o bucket `avatars` (leitura pública, escrita restrita à pasta `auth.uid()`) para a foto de perfil |
| `010_stripe_scaffolding.sql` | base para pagamentos online: `payments.external_provider`/`external_id` com índice único **parcial** (o `where` é indispensável — sem ele um único índice sobre dois nulos barraria o segundo pagamento em dinheiro), a tabela `stripe_events` com o id do Stripe como chave primária, e a forma de pagamento `stripe`. Idempotência antes de tudo: o Stripe entrega **ao menos uma vez**, e sem isso a retentativa de um `payment_intent.succeeded` grava o mesmo recebimento duas vezes. Não cria cobrança nem tela de checkout |

`99_seed/seed.sql` requires demo `auth.users` to be created first (Supabase Auth cannot be
seeded with plain SQL inserts) — see the comments at the top of that file. For a set of
test logins against an already-provisioned project, use `scripts/dev/reset-users-01-create.mjs`
instead, which goes through the Auth Admin API.

### Deleting users

`profiles.id` cascades from `auth.users`, but the clinical tables that reference
`profiles(id)` — `professionals.user_id`, `patients.created_by`, `appointments.created_by`,
`financial_transactions.created_by`, `payments.received_by`, `audit_logs.user_id`,
`queue_entries.released_by`, `queue_transfers.transferred_by`, `files.uploaded_by`,
`service_session_events.created_by`, and — once 002/004 are applied —
`schedule_exceptions.created_by` / `conversations.created_by` — declare **no** `on delete`
action. Deleting an auth user who created any clinical record therefore fails with a
foreign-key violation rather than destroying data. Re-point those references first;
`scripts/dev/reset-users-01-create.mjs` does exactly that before
`reset-users-02-delete-old.mjs` removes the old accounts.

**Never `insert into auth.users` by hand.** That table belongs to GoTrue (the auth
service), is not a documented write surface, and its column shape and NOT NULL
constraints drift between Supabase versions without notice. A malformed row there does
not just fail to insert — once it exists, it silently breaks GoTrue's own queries: a
prior version of this repo's `create-master-user.sql` did exactly this, and it made
`/auth/v1/admin/users` return `500 {"msg":"Database error finding users"}` for *every*
account, not just the broken one, because the admin list endpoint joins across all
users' `auth.identities` rows. The Admin API (`scripts/dev/reset-users-01-create.mjs`,
`create-master-01-create.mjs` / `create-master-02-delete-others.mjs`) is the only
supported way to create or delete a Supabase-authenticated user; `create-master-user.sql`
is now a **cleanup** script for exactly that failure mode, not a creation path.

To keep exactly one login (a `master` account) and remove every other user:

```bash
node scripts/dev/create-master-01-create.mjs      # creates the master, re-points every
                                                   # clinical FK from every other user onto it
node scripts/dev/create-master-02-delete-others.mjs   # deletes everyone except the master
```

Both are idempotent and read the current user list from the Admin API rather than a
hardcoded id list, so they work regardless of which accounts currently exist.

## Email templates

`email-templates/reset-password.html` is a branded, table-based HTML template for
**Authentication → Email Templates → Reset Password** in the Supabase dashboard — paste
it into the "Message body" field as-is. Supabase's default template has no styling at
all. Table layout and inline CSS are deliberate: they are the only subset of HTML/CSS
that renders consistently across Outlook, Gmail and Apple Mail — flexbox, grid and
`<style>`-only rules are not reliable in email clients. Uses `{{ .ConfirmationURL }}`,
the same variable the default template uses.
