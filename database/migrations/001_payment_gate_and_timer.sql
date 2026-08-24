-- ============================================================================
-- CSIB — Migration 001
-- 1. Payment gate: a patient may only enter the queue after payment is confirmed.
-- 2. Service timer: persist consolidated total / paused / effective seconds.
-- 3. Check-in becomes a state of its own, separate from the queue.
--
-- Safe to run once on an existing database. Idempotent where Postgres allows it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Queue lifecycle gains two pre-queue states.
--
--    payment_pending → released → waiting → called → in_service ⇄ paused → completed
--
--    `payment_pending`: patient physically checked in, charge open, NOT callable.
--    `released`:        payment confirmed, waiting for reception to send to queue.
--
--    Payment truth stays in financial_transactions/payments; queue_entries.status is
--    only the operational reflection of it (the two states remain separate concerns).
-- ---------------------------------------------------------------------------
alter type queue_status add value if not exists 'payment_pending' before 'waiting';
alter type queue_status add value if not exists 'released' before 'waiting';

-- ---------------------------------------------------------------------------
-- 2. Link the queue entry to the charge that gates it, and record the release.
-- ---------------------------------------------------------------------------
alter table queue_entries
  add column if not exists financial_transaction_id uuid references financial_transactions(id),
  add column if not exists released_at timestamptz,
  add column if not exists released_by uuid references profiles(id);

create index if not exists idx_queue_entries_transaction
  on queue_entries (financial_transaction_id);

-- Check-in is its own fact on the appointment, not "there is a queue row".
alter table appointments
  add column if not exists checked_in_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3. Consolidated timer figures (item 8.4). The append-only event log in
--    service_session_events stays the source of truth; these columns are the
--    settled result written at finish, so reporting never has to replay events.
-- ---------------------------------------------------------------------------
alter table service_sessions
  add column if not exists total_seconds int,
  add column if not exists effective_seconds int;

comment on column service_sessions.total_seconds is
  'Wall-clock seconds from start to finish, including pauses.';
comment on column service_sessions.effective_seconds is
  'Seconds actually spent attending, i.e. total minus paused.';
comment on column service_sessions.total_paused_seconds is
  'Seconds spent paused. total_seconds - total_paused_seconds = effective_seconds.';

-- ---------------------------------------------------------------------------
-- 4. THE GATE — enforced in the database, not only in the UI.
--
--    Any transition into a paid-only state requires a linked financial_transaction
--    whose status is 'pago'. This is what makes the rule unbypassable: it holds for
--    Server Actions, for direct REST calls, and for anything written by hand in the
--    SQL editor.
-- ---------------------------------------------------------------------------
create or replace function enforce_queue_payment_gate()
returns trigger
language plpgsql
as $$
declare
  paid_only_states queue_status[] := array['released','waiting','called','in_service','paused']::queue_status[];
  tx_status financial_transaction_status;
begin
  -- Leaving the patient in a pre-payment or terminal state is always allowed.
  if not (new.status = any (paid_only_states)) then
    return new;
  end if;

  -- Already past the gate and staying past it: don't re-litigate on every update
  -- (a paid patient must not get stuck if the charge is later refunded mid-visit).
  if tg_op = 'UPDATE' and old.status = any (paid_only_states) then
    return new;
  end if;

  if new.financial_transaction_id is null then
    raise exception
      'Pagamento pendente: vincule uma cobranca a este paciente antes de libera-lo para a fila.'
      using errcode = 'check_violation';
  end if;

  select status into tx_status
  from financial_transactions
  where id = new.financial_transaction_id;

  if tx_status is null then
    raise exception 'Cobranca vinculada nao encontrada.' using errcode = 'check_violation';
  end if;

  if tx_status <> 'pago' then
    raise exception
      'Pagamento pendente: este paciente precisa ter o pagamento confirmado antes de entrar na fila.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_queue_payment_gate on queue_entries;
create trigger trg_queue_payment_gate
  before insert or update of status on queue_entries
  for each row execute function enforce_queue_payment_gate();

-- ---------------------------------------------------------------------------
-- 5. Agenda conflict guard (audit finding: double-booking was fully unvalidated).
--    Partial unique index so cancelled / no-show slots can be reused freely.
-- ---------------------------------------------------------------------------
create unique index if not exists idx_appointments_no_double_booking
  on appointments (professional_id, scheduled_at)
  where status in ('scheduled', 'confirmed');
