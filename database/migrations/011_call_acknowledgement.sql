-- ============================================================================
-- 011 — "Avisei o paciente" compartilhado entre quem está no balcão.
--
-- O aviso de chamada já alerta o balcão por som, cartão e notificação, mas o
-- "Avisei o paciente" era local ao navegador. Com duas pessoas no balcão, uma
-- não via que a outra já tinha chamado o paciente — as duas iam avisar, ou
-- nenhuma iria por achar que a outra foi.
--
-- Duas colunas em `queue_entries` em vez de tabela própria: é um fato sobre a
-- chamada em curso, com no máximo um valor por entrada, e uma tabela de
-- eventos aqui só adicionaria um join a uma consulta que roda a cada cinco
-- segundos em toda tela do balcão.
--
-- Sem reset explícito de propósito. A leitura compara `call_acknowledged_at`
-- com `called_at`: um aviso vale apenas para a chamada que o precedeu, então um
-- paciente chamado de novo volta a aparecer como não avisado sem que nada
-- precise limpar as colunas. Isso vale para QUALQUER caminho que ponha a
-- entrada em `called`, inclusive um futuro que não passe pelo serviço de hoje —
-- um gatilho de limpeza protegeria só os caminhos que alguém lembrasse de cobrir.
--
-- Apply against a database that already has migrations/001 .. 010.
-- ============================================================================

alter table queue_entries
  add column if not exists call_acknowledged_at timestamptz;

-- Sem `on delete`: apagar o perfil de quem avisou não deve apagar o registro de
-- que o paciente foi avisado, e é a mesma escolha das outras colunas de autoria
-- em tabelas clínicas (released_by, transferred_by, created_by).
alter table queue_entries
  add column if not exists call_acknowledged_by uuid references profiles(id);

comment on column queue_entries.call_acknowledged_at is
  'Quando alguém do balcão marcou que avisou o paciente. Só vale para a chamada em curso: compare com called_at.';
comment on column queue_entries.call_acknowledged_by is
  'Quem avisou o paciente — o balcão precisa saber que já foi feito, e por quem.';
