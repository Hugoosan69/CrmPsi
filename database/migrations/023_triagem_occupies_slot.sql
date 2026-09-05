-- ============================================================================
-- 023 — Uma triagem ocupa o horário, como qualquer agendamento ativo.
--
-- Sem isto o valor novo do enum (migration 022) seria um buraco na agenda: os três guardas
-- de conflito e as duas consultas de disponibilidade definem "horário ocupado" como
-- `status in ('scheduled','confirmed')`, então uma triagem marcada às 14h não impediria
-- ninguém de marcar outro paciente às 14h com o mesmo profissional — e ainda apareceria
-- como horário livre no formulário. Cancelado e não-compareceu continuam de fora: esses de
-- fato liberam o horário.
--
-- Tudo aqui é reescrita idempotente do que as migrations 001, 002 e 012 criaram, com a
-- lista de situações ativas atualizada. Requer a 022 já efetivada.
--
-- Apply against a database that already has migrations/001 .. 022.
-- ============================================================================

-- 1. Índice de dupla marcação (migration 001)
drop index if exists idx_appointments_no_double_booking;
create unique index idx_appointments_no_double_booking
  on appointments (professional_id, scheduled_at)
  where status in ('scheduled', 'confirmed', 'triagem');

-- 2. Restrições de sobreposição de profissional e de sala (migration 002)
alter table appointments drop constraint if exists appointments_no_professional_overlap;
alter table appointments add constraint appointments_no_professional_overlap
  exclude using gist (
    professional_id with =,
    time_range with &&
  ) where (status in ('scheduled', 'confirmed', 'triagem'));

alter table appointments drop constraint if exists appointments_no_room_overlap;
alter table appointments add constraint appointments_no_room_overlap
  exclude using gist (
    room_id with =,
    time_range with &&
  ) where (room_id is not null and status in ('scheduled', 'confirmed', 'triagem'));

-- 3. Validação de horário (migration 002) — mesma função, só a lista de situações muda.
create or replace function appointment_slot_problem(
  p_clinic uuid,
  p_professional uuid,
  p_start timestamptz,
  p_duration int,
  p_room uuid default null,
  p_exclude uuid default null
) returns text
language plpgsql
stable
as $$
declare
  v_end timestamptz;
  v_weekday smallint;
  v_has_rule boolean;
  v_has_extra boolean;
  v_blocked boolean;
begin
  if p_duration is null or p_duration <= 0 then
    return 'invalid_duration';
  end if;

  v_end := p_start + make_interval(mins => p_duration);

  if (p_start at time zone 'America/Sao_Paulo')::date
     <> (v_end at time zone 'America/Sao_Paulo' - interval '1 microsecond')::date then
    return 'crosses_midnight';
  end if;

  v_weekday := extract(dow from (p_start at time zone 'America/Sao_Paulo'))::smallint;

  select exists (
    select 1 from professional_availability a
    where a.clinic_id = p_clinic
      and a.professional_id = p_professional
      and a.active
      and a.weekday = v_weekday
      and (p_start at time zone 'America/Sao_Paulo')::time >= a.start_time
      and (v_end   at time zone 'America/Sao_Paulo')::time <= a.end_time
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
      and ap.status in ('scheduled', 'confirmed', 'triagem')
      and (p_exclude is null or ap.id <> p_exclude)
      and ap.time_range && tstzrange(p_start, v_end, '[)')
  ) then
    return 'professional_busy';
  end if;

  if p_room is not null and exists (
    select 1 from appointments ap
    where ap.clinic_id = p_clinic
      and ap.room_id = p_room
      and ap.status in ('scheduled', 'confirmed', 'triagem')
      and (p_exclude is null or ap.id <> p_exclude)
      and ap.time_range && tstzrange(p_start, v_end, '[)')
  ) then
    return 'room_busy';
  end if;

  return null;
end;
$$;

-- 4. Horários livres (migrations 002 + 012) — idem.
create or replace function professional_free_slots(
  p_clinic uuid,
  p_professional uuid,
  p_date date,
  p_duration int default null
) returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
as $$
declare
  v_weekday smallint := extract(dow from p_date)::smallint;
begin
  return query
  with rules as (
    select a.start_time, a.end_time, a.slot_minutes, a.back_to_back
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
      make_interval(
        mins => case
          when r.back_to_back then coalesce(p_duration, r.slot_minutes)
          else r.slot_minutes
        end
      )
    ) as gs
  )
  select c.slot_start, c.slot_end
  from candidates c
  where not exists (
    select 1 from appointments ap
    where ap.clinic_id = p_clinic
      and ap.professional_id = p_professional
      and ap.status in ('scheduled', 'confirmed', 'triagem')
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
