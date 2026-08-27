-- ============================================================================
-- 002 — Agenda foundation: rooms, professional availability, schedule
--       exceptions, and race-proof double-booking prevention.
--
-- Before this migration `appointments.scheduled_at` accepted any instant: there
-- was no concept of when a professional works, no holiday or vacation, no room,
-- and nothing preventing two appointments for the same professional at the same
-- time. Every downstream feature (online self-booking, waitlist backfill,
-- recurring series, occupancy reporting) depends on the agenda first being able
-- to answer "is this slot actually available?".
--
-- Apply against a database that already has 00_core .. 15_audit and
-- migrations/001_payment_gate_and_timer.sql.
-- ============================================================================

-- Exclusion constraints on (professional, time range) need GiST support for the
-- scalar equality operator.
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Rooms / consultórios. A multi-specialty clinic runs more professionals than
-- rooms, so the room is a schedulable resource in its own right.
-- ---------------------------------------------------------------------------
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  kind text not null default 'consultorio',
  capacity integer not null default 1 check (capacity > 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, name)
);

create index if not exists rooms_clinic_idx on rooms (clinic_id) where active;

drop trigger if exists trg_rooms_updated_at on rooms;
create trigger trg_rooms_updated_at
  before update on rooms
  for each row execute function set_updated_at();

alter table rooms enable row level security;

drop policy if exists rooms_select on rooms;
create policy rooms_select on rooms for select
  using (has_clinic_access(clinic_id));

drop policy if exists rooms_write on rooms;
create policy rooms_write on rooms for insert
  with check (has_permission(clinic_id, 'settings.manage'));

drop policy if exists rooms_update on rooms;
create policy rooms_update on rooms for update
  using (has_permission(clinic_id, 'settings.manage'))
  with check (has_permission(clinic_id, 'settings.manage'));

-- ---------------------------------------------------------------------------
-- Weekly recurring availability. `weekday` matches Postgres `extract(dow ...)`:
-- 0 = Sunday .. 6 = Saturday. Times are clinic wall-clock (America/Sao_Paulo),
-- deliberately stored as `time` rather than timestamptz — "Dr. Silva works
-- Tuesdays 08:00–12:00" is a rule, not an instant.
-- ---------------------------------------------------------------------------
create table if not exists professional_availability (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  professional_id uuid not null references professionals(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 30 check (slot_minutes between 5 and 480),
  room_id uuid references rooms(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists professional_availability_lookup_idx
  on professional_availability (professional_id, weekday) where active;

drop trigger if exists trg_professional_availability_updated_at on professional_availability;
create trigger trg_professional_availability_updated_at
  before update on professional_availability
  for each row execute function set_updated_at();

alter table professional_availability enable row level security;

drop policy if exists professional_availability_select on professional_availability;
create policy professional_availability_select on professional_availability for select
  using (has_clinic_access(clinic_id));

drop policy if exists professional_availability_write on professional_availability;
create policy professional_availability_write on professional_availability for insert
  with check (has_permission(clinic_id, 'settings.manage'));

drop policy if exists professional_availability_update on professional_availability;
create policy professional_availability_update on professional_availability for update
  using (has_permission(clinic_id, 'settings.manage'))
  with check (has_permission(clinic_id, 'settings.manage'));

drop policy if exists professional_availability_delete on professional_availability;
create policy professional_availability_delete on professional_availability for delete
  using (has_permission(clinic_id, 'settings.manage'));

-- ---------------------------------------------------------------------------
-- One-off deviations from the weekly rule. `professional_id is null` means the
-- exception applies to the whole clinic (a public holiday closes everyone).
-- kind 'block' removes availability; 'extra' adds a shift outside the rule.
-- ---------------------------------------------------------------------------
do $$ begin
  create type schedule_exception_kind as enum ('block', 'extra');
exception when duplicate_object then null;
end $$;

create table if not exists schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  professional_id uuid references professionals(id) on delete cascade,
  kind schedule_exception_kind not null default 'block',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists schedule_exceptions_window_idx
  on schedule_exceptions (clinic_id, starts_at, ends_at);

drop trigger if exists trg_schedule_exceptions_updated_at on schedule_exceptions;
create trigger trg_schedule_exceptions_updated_at
  before update on schedule_exceptions
  for each row execute function set_updated_at();

alter table schedule_exceptions enable row level security;

drop policy if exists schedule_exceptions_select on schedule_exceptions;
create policy schedule_exceptions_select on schedule_exceptions for select
  using (has_clinic_access(clinic_id));

drop policy if exists schedule_exceptions_write on schedule_exceptions;
create policy schedule_exceptions_write on schedule_exceptions for insert
  with check (has_permission(clinic_id, 'agenda.manage'));

drop policy if exists schedule_exceptions_update on schedule_exceptions;
create policy schedule_exceptions_update on schedule_exceptions for update
  using (has_permission(clinic_id, 'agenda.manage'))
  with check (has_permission(clinic_id, 'agenda.manage'));

drop policy if exists schedule_exceptions_delete on schedule_exceptions;
create policy schedule_exceptions_delete on schedule_exceptions for delete
  using (has_permission(clinic_id, 'agenda.manage'));

-- ---------------------------------------------------------------------------
-- Appointments: room assignment + a stored range so overlap is a constraint,
-- not an application convention that a race can slip past.
-- ---------------------------------------------------------------------------
alter table appointments
  add column if not exists room_id uuid references rooms(id) on delete set null;

-- `time_range` is maintained by a trigger rather than being a GENERATED column.
--
-- A generated expression must be IMMUTABLE, and `timestamptz + interval` is only STABLE:
-- adding an interval to a timestamptz depends on the session TimeZone (DST rules), so
-- Postgres refuses it with "42P17: generation expression is not immutable". A BEFORE
-- trigger has no such restriction, and because it always overwrites the column, a client
-- cannot put a value in there that disagrees with scheduled_at/duration_minutes.
alter table appointments
  add column if not exists time_range tstzrange;

create or replace function set_appointment_time_range()
returns trigger
language plpgsql
as $$
begin
  new.time_range := tstzrange(
    new.scheduled_at,
    new.scheduled_at + make_interval(mins => new.duration_minutes),
    '[)'
  );
  return new;
end;
$$;

drop trigger if exists trg_appointments_time_range on appointments;
create trigger trg_appointments_time_range
  before insert or update of scheduled_at, duration_minutes on appointments
  for each row execute function set_appointment_time_range();

-- Backfill rows that predate the column, so the exclusion constraints below can be
-- validated against real data.
update appointments
   set time_range = tstzrange(
         scheduled_at,
         scheduled_at + make_interval(mins => duration_minutes),
         '[)'
       )
 where time_range is null;

-- Only live appointments reserve time. A cancelled or no-show slot is free again,
-- and a completed one no longer blocks a correction booked over it.
do $$ begin
  alter table appointments add constraint appointments_no_professional_overlap
    exclude using gist (
      professional_id with =,
      time_range with &&
    ) where (status in ('scheduled', 'confirmed'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table appointments add constraint appointments_no_room_overlap
    exclude using gist (
      room_id with =,
      time_range with &&
    ) where (room_id is not null and status in ('scheduled', 'confirmed'));
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Slot validation, in SQL so the rule has exactly one definition and a future
-- public booking endpoint enforces the same thing the receptionist's form does.
-- Returns null when the slot is bookable, otherwise a stable reason code the
-- application maps to a message.
-- ---------------------------------------------------------------------------
create or replace function appointment_slot_problem(
  p_clinic uuid,
  p_professional uuid,
  p_room uuid,
  p_start timestamptz,
  p_duration integer,
  p_exclude uuid default null
) returns text
language plpgsql
stable
as $$
declare
  v_end timestamptz := p_start + make_interval(mins => p_duration);
  v_local_start time;
  v_local_end time;
  v_weekday smallint;
  v_has_rule boolean;
  v_has_extra boolean;
  v_blocked boolean;
begin
  if p_duration <= 0 then
    return 'invalid_duration';
  end if;

  -- Availability is a wall-clock rule, so compare in clinic-local time.
  v_local_start := (p_start at time zone 'America/Sao_Paulo')::time;
  v_local_end   := (v_end   at time zone 'America/Sao_Paulo')::time;
  v_weekday     := extract(dow from (p_start at time zone 'America/Sao_Paulo'))::smallint;

  -- A booking that crosses midnight can't be expressed by a single weekday rule.
  if v_local_end <= v_local_start then
    return 'crosses_midnight';
  end if;

  select exists (
    select 1 from professional_availability a
    where a.professional_id = p_professional
      and a.clinic_id = p_clinic
      and a.active
      and a.weekday = v_weekday
      and a.start_time <= v_local_start
      and a.end_time   >= v_local_end
  ) into v_has_rule;

  select exists (
    select 1 from schedule_exceptions e
    where e.clinic_id = p_clinic
      and e.kind = 'extra'
      and (e.professional_id = p_professional or e.professional_id is null)
      and e.starts_at <= p_start
      and e.ends_at   >= v_end
  ) into v_has_extra;

  if not v_has_rule and not v_has_extra then
    return 'outside_availability';
  end if;

  select exists (
    select 1 from schedule_exceptions e
    where e.clinic_id = p_clinic
      and e.kind = 'block'
      and (e.professional_id = p_professional or e.professional_id is null)
      and tstzrange(e.starts_at, e.ends_at, '[)') && tstzrange(p_start, v_end, '[)')
  ) into v_blocked;

  if v_blocked then
    return 'blocked';
  end if;

  if exists (
    select 1 from appointments ap
    where ap.clinic_id = p_clinic
      and ap.professional_id = p_professional
      and ap.status in ('scheduled', 'confirmed')
      and (p_exclude is null or ap.id <> p_exclude)
      and ap.time_range && tstzrange(p_start, v_end, '[)')
  ) then
    return 'professional_busy';
  end if;

  if p_room is not null and exists (
    select 1 from appointments ap
    where ap.clinic_id = p_clinic
      and ap.room_id = p_room
      and ap.status in ('scheduled', 'confirmed')
      and (p_exclude is null or ap.id <> p_exclude)
      and ap.time_range && tstzrange(p_start, v_end, '[)')
  ) then
    return 'room_busy';
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Free slots for one professional on one clinic-local date, derived from the
-- weekly rule minus blocks minus what is already booked. This is what an agenda
-- picker and a future online booking page both read.
-- ---------------------------------------------------------------------------
create or replace function professional_free_slots(
  p_clinic uuid,
  p_professional uuid,
  p_date date,
  p_duration integer default null
) returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
as $$
declare
  v_weekday smallint := extract(dow from p_date)::smallint;
begin
  return query
  with rules as (
    select a.start_time, a.end_time, a.slot_minutes
    from professional_availability a
    where a.professional_id = p_professional
      and a.clinic_id = p_clinic
      and a.active
      and a.weekday = v_weekday
  ),
  candidates as (
    select
      gs as slot_start,
      gs + make_interval(mins => coalesce(p_duration, r.slot_minutes)) as slot_end
    from rules r
    cross join generate_series(
      (p_date + r.start_time) at time zone 'America/Sao_Paulo',
      (p_date + r.end_time)   at time zone 'America/Sao_Paulo'
        - make_interval(mins => coalesce(p_duration, r.slot_minutes)),
      make_interval(mins => r.slot_minutes)
    ) as gs
  )
  select c.slot_start, c.slot_end
  from candidates c
  where not exists (
    select 1 from appointments ap
    where ap.clinic_id = p_clinic
      and ap.professional_id = p_professional
      and ap.status in ('scheduled', 'confirmed')
      and ap.time_range && tstzrange(c.slot_start, c.slot_end, '[)')
  )
  and not exists (
    select 1 from schedule_exceptions e
    where e.clinic_id = p_clinic
      and e.kind = 'block'
      and (e.professional_id = p_professional or e.professional_id is null)
      and tstzrange(e.starts_at, e.ends_at, '[)') && tstzrange(c.slot_start, c.slot_end, '[)')
  )
  order by c.slot_start;
end;
$$;

-- ---------------------------------------------------------------------------
-- Occupancy: booked minutes against available minutes for a period. The
-- numerator and denominator both live here so the dashboard can't drift from
-- the agenda's own definition of "available".
-- ---------------------------------------------------------------------------
create or replace function clinic_occupancy(
  p_clinic uuid,
  p_from date,
  p_to date
) returns table (
  professional_id uuid,
  available_minutes numeric,
  booked_minutes numeric
)
language sql
stable
as $$
  with days as (
    select d::date as day, extract(dow from d)::smallint as weekday
    from generate_series(p_from, p_to, interval '1 day') d
  ),
  avail as (
    select a.professional_id,
           sum(extract(epoch from (a.end_time - a.start_time)) / 60) as minutes
    from days
    join professional_availability a
      on a.weekday = days.weekday
     and a.clinic_id = p_clinic
     and a.active
    group by a.professional_id
  ),
  booked as (
    select ap.professional_id,
           sum(ap.duration_minutes)::numeric as minutes
    from appointments ap
    where ap.clinic_id = p_clinic
      and ap.status in ('scheduled', 'confirmed', 'completed')
      and (ap.scheduled_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
    group by ap.professional_id
  )
  select
    p.id,
    coalesce(avail.minutes, 0),
    coalesce(booked.minutes, 0)
  from professionals p
  left join avail  on avail.professional_id  = p.id
  left join booked on booked.professional_id = p.id
  where p.clinic_id = p_clinic and p.active;
$$;
