-- ============================================================================
-- LEIA ANTES DE RODAR
--
-- Este arquivo continha originalmente um bloco que criava um usuário direto
-- por INSERT em auth.users/auth.identities. Isso quebrou o projeto: o GoTrue
-- (serviço de autenticação do Supabase) passou a responder
--   {"code":500,"error_code":"unexpected_failure","msg":"Database error
--   finding users"}
-- para QUALQUER listagem ou consulta de usuário — inclusive de contas que
-- nunca foram tocadas — porque uma única linha malformada em auth.users ou
-- auth.identities quebra a query interna que o GoTrue usa para montar a
-- lista. auth.users pertence ao serviço de autenticação, não é uma
-- superfície de escrita suportada, e o formato de suas colunas muda entre
-- versões do Supabase sem aviso.
--
-- O caminho suportado é a Auth Admin API — é o que os scripts
-- scripts/dev/create-master-01-create.mjs e
-- scripts/dev/create-master-02-delete-others.mjs usam agora, e é o mesmo
-- mecanismo que scripts/dev/reset-users-01-create.mjs já usou com sucesso
-- nesta sessão. Rode esses dois arquivos com node, nesta ordem:
--
--   node scripts/dev/create-master-01-create.mjs
--   node scripts/dev/create-master-02-delete-others.mjs
--
-- Se você já rodou a versão antiga deste arquivo e o Supabase começou a
-- devolver erro 500 em qualquer tela de usuários, rode o bloco abaixo
-- primeiro — ele remove especificamente a linha corrompida (localizada e
-- confirmada nesta sessão: o registro de master@csib.local quebrava tanto a
-- listagem quanto a consulta individual daquele id, enquanto todo o resto
-- do schema auth continuava saudável). Depois rode os dois scripts acima.
-- ============================================================================

do $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = 'master@csib.local';

  if v_id is null then
    raise notice 'Nenhum usuário master@csib.local encontrado — nada a limpar.';
    return;
  end if;

  -- auth.identities não tem cascade garantido em todas as versões do
  -- schema; removido explicitamente antes de auth.users.
  delete from auth.identities where user_id = v_id;
  delete from auth.users where id = v_id;

  -- public.profiles e public.clinic_memberships casceiam a partir de
  -- auth.users (on delete cascade), então já saem junto no delete acima.
  -- Nenhum dado clínico é afetado: nada além dessas duas linhas referenciava
  -- este id específico.

  raise notice 'Registro corrompido de master@csib.local removido (id %). Rode agora scripts/dev/create-master-01-create.mjs.', v_id;
end $$;

-- Conferência: deve retornar 0 linhas.
select id, email from auth.users where email = 'master@csib.local';
