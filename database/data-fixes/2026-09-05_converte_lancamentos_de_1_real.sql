-- ============================================================================
-- Correção de dados — 2026-09-05
--
-- Converte os lançamentos que a clínica usava como marcador de sessão de pacote
-- (R$ 1,00 ou menos) em sessões de pacote de verdade.
--
-- Critério, confirmado pela clínica: **todo lançamento de R$ 1,00 ou menos é sessão de
-- pacote**. Valores acima disso são cobranças reais e não são tocados — inclusive o de
-- R$ 1.200,00 de TRIAGEM AVALIAÇÃO, que foi verificado caso a caso.
--
-- O lançamento continua **pago**: o atendimento aconteceu e foi quitado, cancelar
-- reescreveria a história. O que muda é o valor (vai a zero — o dinheiro real está na
-- venda do pacote, o R$ 1 era marcador) e a descrição, que passa a identificá-lo como
-- sessão de pacote. É esse prefixo que o filtro avulsa/pacote e o resumo do financeiro
-- usam para classificar a linha.
--
-- Agrupamento: um pacote retroativo por (paciente, especialidade do profissional que
-- atendeu), com total_sessions = quantas sessões daquele paciente foram encontradas.
-- **É uma inferência**, não um dado que o sistema tinha: o tamanho real de cada pacote
-- vendido só a clínica sabe. Depois de rodar, revise em Gestão → Pacotes e na ficha de
-- cada paciente; a tela de vínculo permite ajustar posição e o catálogo permite corrigir
-- nome, número de sessões e valor.
--
-- Idempotente: só toca lançamentos que ainda não têm sessão de pacote vinculada.
-- Rodar DEPOIS de migrations/015 .. 019.
-- ============================================================================

-- 1. Catálogo dos pacotes retroativos, um por especialidade encontrada. Inativos: são
--    artefato de conversão, não oferta de venda — a clínica ativa se quiser reaproveitar.
insert into session_packages (clinic_id, specialty_id, name, total_sessions, total_price, active)
select distinct
  a.clinic_id,
  pr.specialty_id,
  'Pacote retroativo — ' || s.name,
  1,
  0,
  false
from financial_transactions ft
join appointments a on a.id = ft.appointment_id
join professionals pr on pr.id = a.professional_id
join specialties s on s.id = pr.specialty_id
where ft.amount <= 1
  and ft.status <> 'cancelado'
  and not exists (
    select 1 from patient_package_sessions pps where pps.appointment_id = ft.appointment_id
  )
  and not exists (
    select 1 from session_packages sp
    where sp.clinic_id = a.clinic_id
      and sp.specialty_id = pr.specialty_id
      and sp.name = 'Pacote retroativo — ' || s.name
  );

-- 2. Saldo por paciente + as sessões consumidas, e o acerto do lançamento original.
with eligible as (
  select
    ft.id as transaction_id,
    ft.clinic_id,
    ft.patient_id,
    ft.category,
    ft.created_at,
    ft.appointment_id,
    pr.specialty_id,
    row_number() over (partition by ft.patient_id, pr.specialty_id order by ft.created_at) as rn,
    count(*) over (partition by ft.patient_id, pr.specialty_id) as total_in_group
  from financial_transactions ft
  join appointments a on a.id = ft.appointment_id
  join professionals pr on pr.id = a.professional_id
  where ft.amount <= 1
    and ft.status <> 'cancelado'
    and not exists (
      select 1 from patient_package_sessions pps where pps.appointment_id = ft.appointment_id
    )
),
new_packages as (
  insert into patient_packages (clinic_id, patient_id, session_package_id, total_sessions, total_price, status)
  select
    e.clinic_id,
    e.patient_id,
    sp.id,
    e.total_in_group,
    0,
    'active'
  from (select distinct clinic_id, patient_id, specialty_id, total_in_group from eligible) e
  join specialties s on s.id = e.specialty_id
  join session_packages sp
    on sp.clinic_id = e.clinic_id
   and sp.specialty_id = e.specialty_id
   and sp.name = 'Pacote retroativo — ' || s.name
  returning id, patient_id, session_package_id
),
new_sessions as (
  -- status 'consumed' já na inserção: estas sessões aconteceram no passado. O gatilho de
  -- migrations/016 é o que faz sessions_used acompanhar (a versão original só disparava
  -- em UPDATE e deixaria o saldo zerado aqui).
  insert into patient_package_sessions (patient_package_id, appointment_id, session_number, status, consumed_at)
  select np.id, e.appointment_id, e.rn, 'consumed', e.created_at
  from eligible e
  join specialties s on s.id = e.specialty_id
  join session_packages sp
    on sp.clinic_id = e.clinic_id
   and sp.specialty_id = e.specialty_id
   and sp.name = 'Pacote retroativo — ' || s.name
  join new_packages np on np.patient_id = e.patient_id and np.session_package_id = sp.id
  returning id
)
update financial_transactions ft
set status = 'pago',
    amount = 0,
    description = 'Sessão de pacote — ' || coalesce(ft.category, 'Atendimento')
from eligible e
where ft.id = e.transaction_id;
