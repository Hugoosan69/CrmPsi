-- ============================================================================
-- CSIB — Migration 033
-- O pacote passa a ter período: mensal (como hoje) ou quinzenal.
--
-- Até aqui o pacote não tinha período NENHUM. A clínica os trata como mensais — "quatro
-- sessões no mês" — mas isso vivia só na cabeça de quem vende: o saldo não expirava, e uma
-- sessão comprada em janeiro podia ser usada em agosto sem que nada dissesse nada. O pedido
-- de "pacotes quinzenais" é, na prática, o pedido de que o período exista.
--
-- QUINZENA FIXA, e não 15 dias corridos a partir da venda: dia 1 ao 15, dia 16 ao fim do
-- mês. É como a clínica fecha, é igual para todos os pacientes, e mantém o pacote alinhado
-- ao mês — duas quinzenas cabem exatamente num mês, e o fechamento continua sendo uma data
-- só. Com 15 dias corridos cada paciente teria um ciclo próprio e o mês deixaria de fechar.
--
-- O QUE O PERÍODO NÃO FAZ: não bloqueia o uso da sessão depois do fim. O paciente PAGOU
-- por ela, e recusar seria transformar um atraso da clínica em prejuízo dele. O período é
-- visível na ficha e as sobras entram na varredura de anomalias, que é onde a clínica
-- decide caso a caso.
--
-- Apply against a database that already has migrations/001 .. 032.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. O período no catálogo.
--
-- `mensal` como padrão: é o comportamento que a clínica já pratica, então todo pacote que
-- existe hoje continua exatamente como estava, sem ninguém precisar reeditar nada.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'package_period') then
    create type package_period as enum ('mensal', 'quinzenal');
  end if;
end $$;

alter table session_packages
  add column if not exists period package_period not null default 'mensal';

comment on column session_packages.period is
  'Janela em que as sessões deste pacote devem ser usadas. Quinzenal = dia 1 ao 15, ou 16 ao fim do mês — quinzena fixa do calendário, não 15 dias a partir da venda.';

-- ---------------------------------------------------------------------------
-- 2. A janela no pacote VENDIDO.
--
-- Copiada na venda, como `total_price` e `total_sessions` já são. O catálogo muda — o
-- pacote passa de mensal para quinzenal, alguém corrige um preço — e nada disso pode
-- reescrever o que já foi combinado com um paciente. Ler o período do catálogo na hora de
-- exibir faria um pacote vendido em janeiro mudar de janela em março.
-- ---------------------------------------------------------------------------
alter table patient_packages
  add column if not exists period_start date,
  add column if not exists period_end date;

comment on column patient_packages.period_start is
  'Primeiro dia da janela deste pacote, congelado na venda. Nulo nos pacotes anteriores à 033 que não puderam ser datados.';

-- ---------------------------------------------------------------------------
-- 3. Retroativo: os pacotes já vendidos ganham a janela mensal da data da compra.
--
-- Todos eram mensais por definição (o período não existia), então a janela é o mês da
-- venda. Sem isto a ficha do paciente mostraria "sem período" em todo pacote antigo, e a
-- varredura de anomalias não teria como saber o que sobrou.
-- ---------------------------------------------------------------------------
update patient_packages
set period_start = (date_trunc('month', purchased_at at time zone 'America/Sao_Paulo'))::date,
    period_end = (
      date_trunc('month', purchased_at at time zone 'America/Sao_Paulo')
      + interval '1 month' - interval '1 day'
    )::date
where period_start is null;

-- ---------------------------------------------------------------------------
-- 4. A quinzena, em SQL.
--
-- A venda calcula a janela no aplicativo, onde a decisão é tomada. Esta função existe para
-- quem precisa da mesma conta sem passar por lá: a varredura de anomalias, uma consulta de
-- conferência, um retroativo futuro. Mesma regra, escrita uma vez.
-- ---------------------------------------------------------------------------
create or replace function package_period_bounds(
  p_period package_period,
  p_reference date
) returns table (period_start date, period_end date)
language sql
immutable
security invoker
set search_path = public
as $$
  select
    case
      when p_period = 'mensal' then date_trunc('month', p_reference)::date
      when extract(day from p_reference) <= 15 then date_trunc('month', p_reference)::date
      else (date_trunc('month', p_reference) + interval '15 days')::date
    end,
    case
      when p_period = 'mensal'
        then (date_trunc('month', p_reference) + interval '1 month' - interval '1 day')::date
      when extract(day from p_reference) <= 15
        then (date_trunc('month', p_reference) + interval '14 days')::date
      else (date_trunc('month', p_reference) + interval '1 month' - interval '1 day')::date
    end;
$$;

comment on function package_period_bounds is
  'Janela do pacote a partir de uma data. Quinzenal: dia 1 ao 15, ou 16 ao último dia do mês — a segunda quinzena tem 13, 14, 15 ou 16 dias conforme o mês, e é assim mesmo: ela termina quando o mês termina.';
