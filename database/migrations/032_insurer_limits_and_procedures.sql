-- ============================================================================
-- CSIB — Migration 032
-- O convênio deixa de ter valor e passa a ter limite e procedimentos.
--
-- Três correções vindas do uso real, agora que o CABEN entrou de verdade:
--
-- 1. VALOR SAI DO CADASTRO. `amount_per_guide` fingia saber o que o convênio paga. Não
--    sabe: o valor real só aparece quando o convênio paga (ou glosa), e é isso que
--    `service_guides.paid_amount` sempre guardou. Com o valor no cadastro, a tela de
--    pagamento fazia "procedimento − valor da guia = sobra para o paciente" — uma conta
--    cujo resultado ninguém conferia contra o extrato. Sem guia disponível, o atendimento
--    passa a ser cobrado pelo preço cheio do procedimento, como qualquer particular.
--
-- 2. LIMITE MENSAL POR PACIENTE. É a regra que já existia no papel e não no sistema: o
--    paciente tem N guias por mês, e a partir da N+1 ele paga. Emitir a mais não é erro
--    inofensivo — é guia que vai no protocolo e volta glosada no mês seguinte.
--
-- 3. CONVÊNIO POR PROCEDIMENTO. O CABEN vale só para psicologia hoje. Amarrar isso no
--    código seria escrever no sistema uma regra comercial que muda: vira vínculo, e a tela
--    de pagamento passa a oferecer só os convênios do procedimento daquele atendimento.
--    Procedimento sem nenhum vínculo continua oferecendo todos — não vincular nada é o
--    estado de quem ainda não configurou, e não deve fechar porta nenhuma.
--
-- Apply against a database that already has migrations/001 .. 031.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fora o valor, dentro o limite.
-- ---------------------------------------------------------------------------
alter table insurers drop column if exists amount_per_guide;

alter table insurers
  add column if not exists max_guides_per_patient_month integer
    check (max_guides_per_patient_month is null or max_guides_per_patient_month > 0);

comment on column insurers.max_guides_per_patient_month is
  'Quantas guias este convênio aceita por paciente em cada mês. NULL = sem limite — a ausência de regra é diferente de zero, que significaria um convênio que não aceita guia nenhuma.';

-- A guia não nasce mais com valor: o que o convênio deve só é sabido quando ele paga.
alter table service_guides alter column amount drop not null;
alter table service_guides alter column amount drop default;

comment on column service_guides.amount is
  'Obsoleto desde a 032, mantido para as guias emitidas antes dela. O valor combinado saiu do cadastro do convênio porque só se sabe no acerto — o que foi pago vive em paid_amount.';

-- ---------------------------------------------------------------------------
-- 2. Que procedimentos cada convênio cobre.
--
-- Tabela de ligação, e não uma coluna `specialty_id` no convênio: o recorte real é por
-- procedimento (o CABEN cobre a sessão de psicologia, não necessariamente tudo que a
-- psicologia faz), e um convênio novo pode cobrir procedimentos de especialidades
-- diferentes sem que nada precise mudar de forma.
-- ---------------------------------------------------------------------------
create table if not exists insurer_procedures (
  insurer_id uuid not null references insurers(id) on delete cascade,
  procedure_id uuid not null references procedures(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (insurer_id, procedure_id)
);

create index if not exists idx_insurer_procedures_procedure
  on insurer_procedures (procedure_id);

alter table insurer_procedures enable row level security;
drop policy if exists insurer_procedures_rw on insurer_procedures;
create policy insurer_procedures_rw on insurer_procedures for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));

comment on table insurer_procedures is
  'Que procedimentos cada convênio cobre. Procedimento SEM nenhuma linha aqui aceita qualquer convênio: ausência de vínculo é "ainda não configurado", não "proibido".';

-- ---------------------------------------------------------------------------
-- 3. Quantas guias este paciente já usou neste mês, neste convênio.
--
-- Em SQL e não só no aplicativo porque é a contagem que decide um bloqueio: a tela mostra o
-- saldo antes de emitir, e a Server Action confere de novo no momento de gravar. Duas
-- recepcionistas atendendo o mesmo paciente ao mesmo tempo veem o mesmo número aqui.
--
-- Guia cancelada não conta — foi emitida por engano e desfeita, e mantê-la no cômputo
-- gastaria uma guia que o convênio nunca viu.
-- ---------------------------------------------------------------------------
create or replace function insurer_guides_used_in_month(
  p_clinic uuid,
  p_patient uuid,
  p_insurer uuid,
  p_reference date
) returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from service_guides g
  join appointments a on a.id = g.appointment_id
  where g.clinic_id = p_clinic
    and g.insurer_id = p_insurer
    and a.patient_id = p_patient
    and g.status <> 'cancelada'
    and g.issued_at >= date_trunc('month', p_reference::timestamptz)
    and g.issued_at < date_trunc('month', p_reference::timestamptz) + interval '1 month';
$$;

comment on function insurer_guides_used_in_month is
  'Guias vivas deste paciente, neste convênio, no mês da data informada. Base do limite mensal: a tela consulta para mostrar o saldo e a Server Action consulta de novo para bloquear.';
