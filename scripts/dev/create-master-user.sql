-- ============================================================================
-- Cria um usuário MASTER (papel owner) direto por SQL, para uso em ambiente de
-- teste — e, opcionalmente, remove todos os outros usuários.
--
-- Rode no SQL Editor do Supabase.
--
-- AVISO IMPORTANTE
-- ----------------
-- Inserir em `auth.users` na mão NÃO é um caminho suportado pelo Supabase: o
-- schema `auth` pertence ao serviço de autenticação e pode mudar de forma
-- incompatível entre versões (a coluna `auth.identities.provider_id`, por
-- exemplo, não existe em projetos antigos — o bloco abaixo trata os dois casos).
-- O caminho suportado é a Auth Admin API, que é o que
-- `scripts/dev/reset-users-01-create.mjs` usa.
--
-- Use este arquivo para ambiente de teste. Para produção, prefira o script.
-- ============================================================================

-- Altere estes dois valores antes de rodar.
--   E-mail:  master@csib.local
--   Senha:   Master@2026
-- Depois de entrar, troque a senha em Meu perfil.

do $$
declare
  v_email    text := 'master@csib.local';
  v_password text := 'Master@2026';
  v_name     text := 'Master CSIB';
  v_clinic   uuid := '00000000-0000-0000-0000-000000000001'; -- CSIB
  v_role     uuid := '00000000-0000-0000-0000-000000000010'; -- papel owner (sistema)
  v_user_id  uuid;
  v_has_provider_id boolean;
begin
  -- ------------------------------------------------------------------
  -- 1. auth.users
  -- ------------------------------------------------------------------
  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      -- Sem isto o login é recusado com "Email not confirmed".
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      -- `crypt`/`gen_salt` vêm do pgcrypto, pré-instalado no schema `extensions`
      -- dos projetos Supabase. Se der "function crypt does not exist", rode antes:
      --   create extension if not exists pgcrypto with schema extensions;
      -- e troque por extensions.crypt(...) / extensions.gen_salt('bf').
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );

    -- ----------------------------------------------------------------
    -- 2. auth.identities — o GoTrue exige uma identidade 'email' para
    --    aceitar login por senha. `provider_id` só existe em versões
    --    recentes, daí a checagem.
    -- ----------------------------------------------------------------
    select exists (
      select 1 from information_schema.columns
       where table_schema = 'auth'
         and table_name   = 'identities'
         and column_name  = 'provider_id'
    ) into v_has_provider_id;

    if v_has_provider_id then
      insert into auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
        'email', v_user_id::text,
        now(), now(), now()
      );
    else
      insert into auth.identities (
        id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
        'email',
        now(), now(), now()
      );
    end if;

    raise notice 'auth.users criado: % (%)', v_email, v_user_id;
  else
    -- Já existe: só garante a senha, para o caso de você ter esquecido.
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_user_id;
    raise notice 'auth.users já existia, senha redefinida: % (%)', v_email, v_user_id;
  end if;

  -- ------------------------------------------------------------------
  -- 3. profiles — não há trigger criando isto automaticamente neste
  --    schema (database/01_identity/schema.sql), então é explícito.
  -- ------------------------------------------------------------------
  insert into profiles (id, full_name, email, active)
  values (v_user_id, v_name, v_email, true)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email     = excluded.email,
        active    = true;

  -- ------------------------------------------------------------------
  -- 4. clinic_memberships — é isto que dá acesso; sem membership ativa
  --    o login funciona mas o app recusa ("não vinculado a nenhuma
  --    clínica ativa").
  -- ------------------------------------------------------------------
  insert into clinic_memberships (clinic_id, user_id, role_id, active)
  values (v_clinic, v_user_id, v_role, true)
  on conflict (clinic_id, user_id) do update
    set role_id = excluded.role_id,
        active   = true;

  raise notice 'Pronto. Entre com % / % e troque a senha em Meu perfil.', v_email, v_password;
end $$;


-- ============================================================================
-- OPCIONAL — remover todos os OUTROS usuários
--
-- Não basta deletar de auth.users: as tabelas clínicas referenciam
-- profiles(id) SEM `on delete` action, então o delete falha com violação de
-- chave estrangeira em vez de destruir dados. Este bloco re-aponta essas
-- referências para o master e só então apaga.
--
-- Descomente para rodar. Os dados clínicos são preservados — apenas a autoria
-- passa a ser do master.
-- ============================================================================

-- do $$
-- declare
--   v_master uuid;
-- begin
--   select id into v_master from auth.users where email = 'master@csib.local';
--   if v_master is null then
--     raise exception 'Rode o bloco de criação do master primeiro.';
--   end if;
--
--   -- Toda coluna que referencia profiles(id) sem cascade.
--   update professionals            set user_id      = v_master where user_id      is not null and user_id      <> v_master;
--   update patients                 set created_by   = v_master where created_by   is not null and created_by   <> v_master;
--   update appointments             set created_by   = v_master where created_by   is not null and created_by   <> v_master;
--   update financial_transactions   set created_by   = v_master where created_by   is not null and created_by   <> v_master;
--   update payments                 set received_by  = v_master where received_by  is not null and received_by  <> v_master;
--   update audit_logs               set user_id      = v_master where user_id      is not null and user_id      <> v_master;
--   update queue_entries            set released_by  = v_master where released_by  is not null and released_by  <> v_master;
--   update queue_transfers          set transferred_by = v_master where transferred_by is not null and transferred_by <> v_master;
--   update files                    set uploaded_by  = v_master where uploaded_by  is not null and uploaded_by  <> v_master;
--   update service_session_events   set created_by   = v_master where created_by   is not null and created_by   <> v_master;
--
--   -- Se a migration 002 já rodou, os bloqueios de agenda também referenciam profiles.
--   if to_regclass('public.schedule_exceptions') is not null then
--     update schedule_exceptions set created_by = v_master where created_by is not null and created_by <> v_master;
--   end if;
--
--   -- Se a migration 004 já rodou, o chat também referencia profiles.
--   if to_regclass('public.internal_messages') is not null then
--     delete from internal_messages         where sender_id  <> v_master;
--     delete from conversation_participants where user_id    <> v_master;
--     delete from notifications             where user_id    <> v_master;
--     update conversations set created_by = v_master where created_by is not null and created_by <> v_master;
--   end if;
--
--   -- profiles e clinic_memberships têm cascade a partir de auth.users,
--   -- então apagar o usuário limpa os dois.
--   delete from auth.users where id <> v_master;
--
--   raise notice 'Todos os outros usuários removidos. Restou apenas o master.';
-- end $$;

-- Conferência:
--   select u.email, p.full_name, r.slug as papel, m.active
--     from auth.users u
--     left join profiles p on p.id = u.id
--     left join clinic_memberships m on m.user_id = u.id
--     left join roles r on r.id = m.role_id;
