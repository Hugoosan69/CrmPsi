-- ============================================================================
-- 008 — Corrige a exclusão de paciente alvo de campanha.
--
-- A migration 007 combinou duas regras que se contradizem:
--
--   patient_id uuid references patients(id) on delete set null
--   constraint campaign_single_needs_patient
--     check (audience <> 'single' or patient_id is not null)
--
-- Apagar um paciente que era alvo de uma campanha `single` faz o ON DELETE
-- anular patient_id, o que viola imediatamente o CHECK. O resultado é que o
-- paciente NÃO PODE SER APAGADO — o banco recusa com 23514 e a mensagem aponta
-- para a campanha, não para o paciente, o que torna a causa difícil de ver.
--
-- Descoberto na prática, limpando o banco para produção: a exclusão de um
-- paciente falhou por causa de uma campanha esquecida.
--
-- A correção é cascade: uma campanha dirigida a uma única pessoa perde o sentido
-- quando essa pessoa deixa de existir. Manter a campanha sem alvo seria pior —
-- ela ficaria na tela como agendada, sem ninguém para receber.
--
-- Campanhas de público amplo (active/inactive/all) não têm patient_id e seguem
-- intactas quando um paciente sai.
--
-- Apply against a database that already has migrations/001 .. 007.
-- ============================================================================

alter table message_campaigns
  drop constraint if exists message_campaigns_patient_id_fkey;

alter table message_campaigns
  add constraint message_campaigns_patient_id_fkey
    foreign key (patient_id) references patients(id) on delete cascade;
