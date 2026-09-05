-- ============================================================================
-- 017 — "Meu financeiro": o profissional vê a movimentação dos próprios
--       atendimentos, sem enxergar o caixa da clínica.
--
-- `financial.view` é a visão da clínica inteira — dar isso a quem atende para que a
-- pessoa acompanhe a própria produção seria abrir receita de todo mundo. Daí uma
-- permissão separada, que a tela `/profissional/financeiro` exige e que filtra sempre
-- pelo profissional vinculado ao login de quem consulta.
--
-- Concedida a quem já tem `service.manage` (o conjunto de quem atende) e a quem já tem
-- `financial.view` — assim ninguém precisa reconfigurar nada depois de aplicar.
--
-- Apply against a database that already has migrations/001 .. 016.
-- ============================================================================

insert into permissions (slug, module, description) values
  ('financial.view_own', 'financial', 'Ver o próprio financeiro (apenas os seus atendimentos)')
on conflict (slug) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug = 'financial.view_own'
  and exists (
    select 1 from role_permissions rp
    join permissions sp on sp.id = rp.permission_id
    where rp.role_id = r.id and sp.slug in ('service.manage', 'financial.view')
  )
on conflict do nothing;
