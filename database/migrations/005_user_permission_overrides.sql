-- ============================================================================
-- 005 — Permissões por usuário, sobrepondo o papel.
--
-- Antes desta migração a permissão era exclusivamente do papel: quem é
-- "financeiro" tinha exatamente o conjunto do papel financeiro, e a única
-- forma de dar a essa pessoa acesso a cadastrar profissional seria alterar o
-- papel — o que mudaria para TODO mundo que é financeiro.
--
-- Pior: os cinco papéis distribuídos (owner, admin, receptionist,
-- professional, financial) têm clinic_id = null, ou seja, são compartilhados
-- por todas as clínicas do sistema. Editá-los mudaria as permissões de todos
-- os tenants, então setRolePermission() recusa qualquer alteração neles — o
-- que na prática deixou a tela de permissões inteiramente inoperante, já que
-- não existe nenhum papel próprio de clínica.
--
-- A saída é a exceção por pessoa: o papel continua sendo o padrão, e um
-- override registra "esta pessoa, nesta clínica, tem (ou não tem) esta
-- permissão", sem tocar em nada compartilhado.
--
-- Apply against a database that already has 00_core .. 15_audit and
-- migrations/001 .. 004.
-- ============================================================================

create table if not exists user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  -- true = concedida apesar do papel; false = negada apesar do papel.
  -- A ausência de linha significa "herda do papel" — três estados, não dois.
  granted boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, user_id, permission_id)
);

create index if not exists user_permission_overrides_lookup_idx
  on user_permission_overrides (clinic_id, user_id);

drop trigger if exists trg_user_permission_overrides_updated_at on user_permission_overrides;
create trigger trg_user_permission_overrides_updated_at
  before update on user_permission_overrides
  for each row execute function set_updated_at();

alter table user_permission_overrides enable row level security;

-- Leitura: qualquer membro da clínica pode ver (a tela de permissões precisa
-- montar a matriz). Escrita: apenas quem administra usuários.
drop policy if exists user_permission_overrides_select on user_permission_overrides;
create policy user_permission_overrides_select on user_permission_overrides for select
  using (has_clinic_access(clinic_id));

drop policy if exists user_permission_overrides_write on user_permission_overrides;
create policy user_permission_overrides_write on user_permission_overrides for insert
  with check (has_permission(clinic_id, 'users.manage'));

drop policy if exists user_permission_overrides_update on user_permission_overrides;
create policy user_permission_overrides_update on user_permission_overrides for update
  using (has_permission(clinic_id, 'users.manage'))
  with check (has_permission(clinic_id, 'users.manage'));

drop policy if exists user_permission_overrides_delete on user_permission_overrides;
create policy user_permission_overrides_delete on user_permission_overrides for delete
  using (has_permission(clinic_id, 'users.manage'));

-- ---------------------------------------------------------------------------
-- has_permission() passa a consultar o override antes do papel.
--
-- Esta função é a base de ~35 políticas de RLS e de todo requirePermission()
-- da camada de aplicação, então a mudança é deliberadamente conservadora:
--   - sem override  -> comportamento IDÊNTICO ao anterior (herda do papel)
--   - override true -> concede
--   - override false-> nega, mesmo que o papel conceda
--
-- coalesce sobre um scalar subquery é o que dá os três estados: a subquery do
-- override devolve NULL quando não há linha (não `false`), e é justamente essa
-- distinção entre "negado" e "não configurado" que permite herdar.
--
-- Mantida security definer + search_path fixo, como a original: ela é chamada
-- de dentro de políticas de RLS e precisa enxergar as tabelas de autorização
-- independentemente das permissões do chamador.
-- ---------------------------------------------------------------------------
create or replace function has_permission(target_clinic_id uuid, permission_slug text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  with membership as (
    select cm.user_id, cm.role_id
    from clinic_memberships cm
    where cm.clinic_id = target_clinic_id
      and cm.user_id = auth.uid()
      and cm.active
  ),
  target_permission as (
    select p.id from permissions p where p.slug = permission_slug
  )
  select coalesce(
    (
      select o.granted
      from user_permission_overrides o
      join membership m on m.user_id = o.user_id
      join target_permission tp on tp.id = o.permission_id
      where o.clinic_id = target_clinic_id
    ),
    (
      select exists (
        select 1
        from role_permissions rp
        join membership m on m.role_id = rp.role_id
        join target_permission tp on tp.id = rp.permission_id
      )
    ),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Permissões efetivas de um usuário, para a tela de gestão montar a matriz
-- sem replicar a regra de precedência em TypeScript — a definição de "o que
-- esta pessoa pode" fica num lugar só.
-- ---------------------------------------------------------------------------
create or replace function user_effective_permissions(
  p_clinic uuid,
  p_user uuid
) returns table (
  permission_id uuid,
  slug text,
  module text,
  description text,
  from_role boolean,
  override text,
  effective boolean
)
language sql stable
as $$
  select
    p.id,
    p.slug,
    p.module,
    p.description,
    exists (
      select 1
      from clinic_memberships cm
      join role_permissions rp on rp.role_id = cm.role_id
      where cm.clinic_id = p_clinic and cm.user_id = p_user and cm.active
        and rp.permission_id = p.id
    ) as from_role,
    -- 'granted' | 'denied' | null (= herda do papel). Texto em vez de enum:
    -- é um detalhe de apresentação desta função, não um conceito do schema.
    (
      select case when o.granted then 'granted' else 'denied' end
      from user_permission_overrides o
      where o.clinic_id = p_clinic and o.user_id = p_user and o.permission_id = p.id
    ) as override,
    coalesce(
      (select o.granted from user_permission_overrides o
        where o.clinic_id = p_clinic and o.user_id = p_user and o.permission_id = p.id),
      exists (
        select 1
        from clinic_memberships cm
        join role_permissions rp on rp.role_id = cm.role_id
        where cm.clinic_id = p_clinic and cm.user_id = p_user and cm.active
          and rp.permission_id = p.id
      ),
      false
    ) as effective
  from permissions p
  order by p.module, p.slug;
$$;
