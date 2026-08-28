-- ============================================================================
-- 009 — Permissões granulares, nível de integrações e avatares.
--
-- Três problemas distintos, resolvidos juntos porque os dois primeiros são a
-- mesma tabela.
--
-- 1. `settings.manage` era amplo demais. Uma única permissão dava acesso a
--    identidade visual, catálogo de procedimentos, especialidades, salas e
--    horários, cadastro de profissionais, modelos de mensagem E integrações.
--    Liberar "cadastrar procedimento" para alguém obrigava a liberar tudo isso.
--
-- 2. As integrações (n8n, WhatsApp, Stripe) exigem um nível ACIMA de
--    administrador. Quem as configura controla o número de WhatsApp da clínica
--    e, com o Stripe, o destino do dinheiro — não é a mesma confiança de quem
--    administra usuários. Fica só no papel de proprietário.
--
-- 3. `profiles.avatar_url` existe desde 01_identity mas nunca teve onde guardar
--    a imagem.
--
-- Compatibilidade: as permissões novas são concedidas a quem já tinha
-- `settings.manage`, então ninguém perde acesso ao aplicar isto. A exceção é
-- `integrations.manage`, deliberadamente concedida apenas ao proprietário — se
-- um administrador precisar, a exceção por pessoa de migrations/005 resolve caso
-- a caso, que é justamente o mecanismo certo para uma permissão desse peso.
--
-- Apply against a database that already has migrations/001 .. 008.
-- ============================================================================

insert into permissions (slug, module, description) values
  ('integrations.manage',   'integrations',   'Configurar n8n, WhatsApp e pagamentos online'),
  ('catalog.manage',        'catalog',        'Procedimentos, especialidades e formas de pagamento'),
  ('agenda.configure',      'agenda',         'Salas, horários de atendimento e bloqueios'),
  ('professionals.manage',  'professionals',  'Cadastrar e editar profissionais'),
  ('communication.manage',  'communication',  'Modelos, campanhas e automações de mensagem')
on conflict (slug) do update
  set module = excluded.module, description = excluded.description;

-- ---------------------------------------------------------------------------
-- Quem já podia tudo continua podendo — exceto integrações.
--
-- Sem este bloco, aplicar a migração TIRARIA acesso: as telas passam a exigir as
-- permissões novas, que ninguém teria ainda.
-- ---------------------------------------------------------------------------
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug in (
        'catalog.manage',
        'agenda.configure',
        'professionals.manage',
        'communication.manage'
      )
  and exists (
        select 1
        from role_permissions rp
        join permissions sp on sp.id = rp.permission_id
        where rp.role_id = r.id and sp.slug = 'settings.manage'
      )
on conflict do nothing;

-- Integrações: só o proprietário.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.slug = 'owner' and p.slug = 'integrations.manage'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Avatares.
--
-- Bucket público de leitura: a foto aparece no cabeçalho e em listas, e servir
-- imagem autenticada exigiria uma rota própria para algo que não é sensível.
-- A escrita é restrita ao dono do arquivo — o caminho começa com o id do
-- usuário, e a política compara com auth.uid(), de modo que ninguém troca a
-- foto de outra pessoa.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

-- storage.foldername(name) devolve os segmentos do caminho; [1] é a primeira
-- pasta, que aqui é sempre o id do usuário.
drop policy if exists avatars_own_insert on storage.objects;
create policy avatars_own_insert on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_own_update on storage.objects;
create policy avatars_own_update on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_own_delete on storage.objects;
create policy avatars_own_delete on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
