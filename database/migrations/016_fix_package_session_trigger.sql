-- ============================================================================
-- 016 — Corrige o gatilho de consumo de sessão de pacote (migration 015).
--
-- `trg_patient_package_session_consumption` só disparava em UPDATE OF status. O vínculo
-- retroativo (`linkRetroactiveSession`, requisito 6) insere a sessão já como `consumed`
-- diretamente (não passa por `reserved` primeiro, já que a sessão já aconteceu no
-- passado) — nesse caminho o gatilho nunca disparava e `sessions_used` nunca era
-- incrementado. Descoberto em revisão antes de qualquer dado depender disso.
--
-- Apply against a database that already has migrations/001 .. 015.
-- ============================================================================

create or replace function apply_patient_package_session_consumption()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'consumed' and (tg_op = 'INSERT' or old.status is distinct from 'consumed') then
    update patient_packages
      set sessions_used = sessions_used + 1
      where id = new.patient_package_id;

    update patient_packages
      set status = 'completed'
      where id = new.patient_package_id
        and status = 'active'
        and sessions_used >= total_sessions;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_patient_package_session_consumption on patient_package_sessions;
create trigger trg_patient_package_session_consumption
  after insert or update of status on patient_package_sessions
  for each row execute function apply_patient_package_session_consumption();
