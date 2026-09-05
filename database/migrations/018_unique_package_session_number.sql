-- ============================================================================
-- 018 — Uma posição de sessão não pode ser ocupada duas vezes no mesmo pacote.
--
-- O vínculo manual (agenda → "Vincular a um pacote") passou a deixar a recepção escolher
-- QUAL sessão está sendo registrada — "esta consulta foi a 3ª das 4". A tela já esconde
-- as posições ocupadas, mas esconder não é impedir: duas pessoas fechando o mesmo pacote
-- ao mesmo tempo, ou uma aba parada com a lista antiga, gravariam duas vezes a sessão 3 e
-- o saldo do paciente ficaria errado sem ninguém perceber.
--
-- Parcial em `status <> 'released'` de propósito: liberar uma sessão (cancelamento, falta
-- justificada) devolve aquela posição para uso, e a linha liberada fica no histórico.
--
-- Apply against a database that already has migrations/001 .. 017.
-- ============================================================================

create unique index if not exists patient_package_sessions_number_key
  on patient_package_sessions (patient_package_id, session_number)
  where status <> 'released';
