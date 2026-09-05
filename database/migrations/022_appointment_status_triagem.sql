-- ============================================================================
-- 022 — Situação "triagem" no agendamento.
--
-- A clínica marca triagem o tempo todo (é a porta de entrada do paciente) e até agora isso
-- só existia como nome de procedimento — na agenda a consulta ficava "Agendado" igual a
-- todas as outras, sem nada que a distinguisse de longe. Vira uma situação própria: ganha
-- cor própria no card (Configurações › Cores da agenda) e pode ser filtrada e contada.
--
-- **Esta migration só acrescenta o valor ao enum.** O Postgres não deixa usar um valor de
-- enum recém-criado em predicado de índice na mesma transação ("unsafe use of new value"),
-- e é exatamente isso que a 023 precisa fazer. Por isso são dois arquivos, aplicados em
-- ordem — a 023 não funciona sem esta ter sido efetivada antes.
--
-- Apply against a database that already has migrations/001 .. 021.
-- ============================================================================

alter type appointment_status add value if not exists 'triagem';
