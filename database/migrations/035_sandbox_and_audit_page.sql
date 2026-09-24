-- 035: Sandbox mode + permissão de auditoria
--
-- Sandbox é per-user via cookie, não via banco. A migração só adiciona a permissão de
-- controle. A página de auditoria já tem `audit.view` no banco desde o seed; esta
-- migration só confirma que a permissão existe e não precisa criar nada.

-- Permissão para ativar/desativar o modo sandbox. Só o owner recebe.
insert into permissions (slug, module, description)
values ('sandbox.toggle', 'settings', 'Alternar modo sandbox (dados de homologação)')
on conflict (slug) do nothing;

-- Conceder ao owner
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.slug = 'owner' and p.slug = 'sandbox.toggle'
on conflict do nothing;
