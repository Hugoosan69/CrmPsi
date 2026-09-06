-- ============================================================================
-- CSIB — Migration 027
-- Reenvio de `participant_joined` deixa de duplicar o participante.
--
-- O LiveKit entrega webhook **ao menos uma vez**: o mesmo evento chega de novo sempre que
-- ele não recebe o 2xx a tempo. A 025 protegeu o caso de duas sessões abertas ao mesmo
-- tempo com um índice parcial em (call_id, identity) `where left_at is null` — mas ele para
-- de valer justamente depois que a pessoa sai:
--
--   1. participant_joined  → insere a linha (left_at nulo, índice cobre)
--   2. participant_left    → grava left_at (a linha sai do índice parcial)
--   3. participant_joined  → REENVIADO: o índice não cobre mais, e insere de novo
--
-- Verificado: reenviar a mesma sequência criava uma segunda linha para o mesmo paciente,
-- e o histórico da consulta passava a mostrar duas entradas onde houve uma.
--
-- `joined_at` vem do `createdAt` do evento, que é o mesmo em todas as tentativas de entrega
-- do MESMO evento — e diferente quando a pessoa realmente entra outra vez. É por isso que
-- ele serve de chave de deduplicação sem impedir uma reentrada legítima.
--
-- Apply against a database that already has migrations/001 .. 026.
-- ============================================================================

-- Limpa duplicatas já criadas, mantendo a primeira linha de cada evento.
delete from video_call_participants p
using video_call_participants outra
where p.call_id = outra.call_id
  and p.identity = outra.identity
  and p.joined_at = outra.joined_at
  and p.ctid > outra.ctid;

create unique index if not exists idx_video_call_participants_event
  on video_call_participants (call_id, identity, joined_at);

comment on index idx_video_call_participants_event is
  'Deduplica reenvios de participant_joined: o webhook do LiveKit entrega ao menos uma vez, e o createdAt do evento é o mesmo em todas as tentativas.';
