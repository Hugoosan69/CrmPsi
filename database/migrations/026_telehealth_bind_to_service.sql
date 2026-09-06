-- ============================================================================
-- CSIB — Migration 026
-- A teleconsulta passa a pendurar no ATENDIMENTO, não no agendamento.
--
-- A 025 vinculou a chamada a `appointments`, para o link poder ser enviado com
-- antecedência. Na prática isso separa duas coisas que precisam coincidir: se a sala
-- existe desde a marcação, o paciente entra quando quiser e o tempo dentro dela não tem
-- relação nenhuma com o tempo do atendimento registrado — o cronômetro mede uma coisa e a
-- consulta acontece em outra.
--
-- Vinculando a `queue_entries`, a sala nasce no mesmo momento em que o profissional abre o
-- atendimento: o mesmo intervalo alimenta o cronômetro, o tempo efetivo e a produtividade.
-- Uma teleconsulta deixa de ser um evento paralelo e passa a ser o atendimento.
--
-- Consequência aceita: o paciente remoto percorre o mesmo caminho do presencial —
-- check-in, gate de pagamento, fila —, feito pela recepção à distância. É mais passo, e é
-- o passo que faz a consulta ser contada, cobrada e registrada como todas as outras.
--
-- A 025 não chegou a produção e não tem dados em homologação, então a troca é direta.
--
-- Apply against a database that already has migrations/001 .. 025.
-- ============================================================================

-- A chamada é do atendimento. `on delete cascade` acompanha a entrada de fila: apagada a
-- entrada, a sala não tem mais a que se referir.
alter table video_calls
  add column if not exists queue_entry_id uuid references queue_entries(id) on delete cascade;

-- Sem dados a migrar (025 é de hoje e nasceu vazia). A coluna antiga sai por inteiro para
-- não sobrar duas âncoras concorrentes — a próxima pessoa a ler o schema não deve ter de
-- adivinhar qual das duas manda.
alter table video_calls drop column if exists appointment_id;

alter table video_calls alter column queue_entry_id set not null;

drop index if exists idx_video_calls_appointment;
create index if not exists idx_video_calls_queue_entry on video_calls (queue_entry_id);

-- Uma sala viva por atendimento. Reabrir a tela devolve a mesma sala em vez de criar outra
-- e deixar profissional e paciente em consultas diferentes — a checagem já existe no
-- serviço, e isto é o que a torna verdadeira mesmo sob duas requisições simultâneas.
drop index if exists idx_video_calls_one_live_per_entry;
create unique index idx_video_calls_one_live_per_entry
  on video_calls (queue_entry_id)
  where status in ('aguardando', 'em_andamento');

comment on table video_calls is
  'Teleconsulta de um atendimento em curso (queue_entries). Nasce quando o profissional abre o atendimento, para o tempo da sala coincidir com o do cronômetro.';
comment on column video_calls.queue_entry_id is
  'O atendimento a que esta sala pertence. O agendamento, quando houver, chega por queue_entries.appointment_id.';
