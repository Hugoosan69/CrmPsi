-- ============================================================================
-- 006 — Nome de especialidade único por clínica.
--
-- `specialties` nasceu sem restrição de unicidade, ao contrário de `rooms`, que
-- já declara `unique (clinic_id, name)`. Na prática isso permitia cadastrar
-- "Psicologia" duas vezes — verificado contra o banco: o insert duplicado
-- retornou 201, sem reclamar. Duas especialidades com o mesmo nome deixam o
-- seletor do cadastro de profissionais ambíguo, e não há como saber depois qual
-- é "a certa".
--
-- Escopado por clínica, não global: dois tenants podendo ter "Psicologia" cada
-- um é o comportamento correto num sistema multi-clínica.
--
-- A UI depende desta constraint: describeDbError() traduz 23505 para "Já existe
-- um registro com estes dados", e sem ela essa mensagem nunca apareceria porque
-- o banco aceitaria a duplicata em silêncio.
--
-- Apply against a database that already has 00_core .. 15_audit and
-- migrations/001 .. 005.
-- ============================================================================

-- Se houver duplicatas pré-existentes, a criação do índice falha e diz quais são
-- — melhor descobrir aqui do que ter o erro aparecendo depois, no uso.
do $$
declare
  v_dups text;
begin
  select string_agg(format('%s (clinic %s, %s vezes)', name, clinic_id, n), '; ')
    into v_dups
  from (
    select clinic_id, name, count(*) as n
    from specialties
    group by clinic_id, name
    having count(*) > 1
  ) d;

  if v_dups is not null then
    raise exception
      'Existem especialidades duplicadas — renomeie ou desative antes de rodar esta migration: %',
      v_dups;
  end if;
end $$;

create unique index if not exists specialties_clinic_name_key
  on specialties (clinic_id, name);
