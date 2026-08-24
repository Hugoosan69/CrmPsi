-- CSIB — Financial domain.
-- financial_transactions covers receitas/despesas/contas pendentes with a type discriminator
-- (avoids three near-identical tables); payments records actual receipts against a
-- transaction, supporting partial/multiple payments per transaction.

create type financial_transaction_type as enum ('receita', 'despesa');
create type financial_transaction_status as enum ('pendente', 'pago', 'atrasado', 'cancelado');

create table financial_transactions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid references patients(id),
  appointment_id uuid references appointments(id),
  type financial_transaction_type not null,
  category text,
  description text,
  amount numeric(10,2) not null,
  due_date date,
  status financial_transaction_status not null default 'pendente',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_financial_clinic_status on financial_transactions (clinic_id, status);

create trigger trg_financial_transactions_updated_at
  before update on financial_transactions for each row execute function set_updated_at();

create table payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  financial_transaction_id uuid not null references financial_transactions(id),
  payment_method_id uuid not null references payment_methods(id),
  amount numeric(10,2) not null,
  paid_at timestamptz not null default now(),
  received_by uuid references profiles(id),
  notes text
);

alter table financial_transactions enable row level security;
alter table payments enable row level security;

-- RLS enforces tenant isolation only; who may view despesas vs. who may only register a
-- payment (recepcionista vs. financeiro) is a permission check in the service layer.
create policy financial_transactions_rw on financial_transactions for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
create policy payments_rw on payments for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));
