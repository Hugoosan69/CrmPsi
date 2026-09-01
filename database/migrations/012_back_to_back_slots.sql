-- ============================================================================
-- 012 — Atendimento seguido, sem intervalo entre um paciente e o próximo.
--
-- `slot_minutes` não é a duração da consulta: é o PASSO da grade de horários.
-- Os encaixes sugeridos nascem de 30 em 30 minutos (ou o que estiver
-- configurado), e a consulta ocupa a duração do procedimento dentro disso.
--
-- Quando as duas coisas não batem, sobra tempo morto. Com passo de 30 e
-- procedimento de 50 minutos, quem marca às 08:00 termina às 08:50, mas o
-- próximo encaixe oferecido é 09:00 — dez minutos parados. Com procedimento de
-- 20 e passo de 30, são dez minutos perdidos a cada paciente: numa manhã de
-- quatro horas, quase uma hora e meia de agenda que some.
--
-- Há profissional que quer exatamente isso, o respiro entre um atendimento e
-- outro. E há profissional que prefere emendar. Por isso um sinalizador por
-- faixa de horário, e não uma mudança de comportamento para todo mundo:
-- `back_to_back = false` mantém a grade fixa de sempre.
--
-- Fica na faixa (dia da semana) e não no profissional porque é onde
-- `slot_minutes` já vive — e porque a preferência pode mudar com o dia: emendar
-- no sábado de manhã e respirar durante a semana é um arranjo comum.
--
-- Apply against a database that already has migrations/001 .. 011.
-- ============================================================================

alter table professional_availability
  add column if not exists back_to_back boolean not null default false;

comment on column professional_availability.back_to_back is
  'Quando verdadeiro, os encaixes seguem a duração do procedimento em vez do passo fixo de slot_minutes — um paciente começa quando o anterior termina.';

-- ---------------------------------------------------------------------------
-- Geração dos encaixes livres.
--
-- Única mudança em relação a migrations/002: o passo do generate_series. Com o
-- sinalizador ligado ele passa a ser a duração pedida, de modo que o próximo
-- horário oferecido começa quando o anterior termina.
--
-- Sem duração informada (`p_duration` nulo) o passo continua sendo
-- `slot_minutes` nos dois casos — não há o que emendar quando não se sabe
-- quanto o atendimento dura, e é o que acontece ao abrir a agenda sem escolher
-- procedimento.
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
