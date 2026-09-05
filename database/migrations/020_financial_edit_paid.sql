-- ============================================================================
-- 020 — Alterar um lançamento que já está pago.
--
-- `financial.edit_amount` (migrations/019) libera corrigir o valor de um lançamento. Mexer
-- num lançamento **já pago** é outra conversa: o dinheiro já entrou, já foi conciliado e já
-- contou no fechamento do período. Quem digitou errado hoje de manhã precisa corrigir; quem
-- reescreve um recebimento de mês passado está mudando um número que alguém já reportou.
--
-- Daí a permissão separada: a clínica pode dar "corrige valor" à recepção e manter
-- "altera registro pago" só com quem responde pelo caixa. As duas são exigidas juntas para
-- editar uma linha paga, e a tela avisa, antes de confirmar, que a alteração fica na
-- auditoria com valor anterior, valor novo, autor e horário.
--
-- Apply against a database that already has migrations/001 .. 019.
-- ============================================================================

insert into permissions (slug, module, description) values
  ('financial.edit_paid', 'financial', 'Alterar um lançamento que já está pago')
on conflict (slug) do nothing;

-- Concedida a quem já administra o financeiro — mesmo critério da 019: ninguém perde acesso
-- ao aplicar, e quem não deve ter fica de fora por exceção individual
-- (user_permission_overrides, tela Gestão → Permissões).
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug = 'financial.edit_paid'
  and exists (
    select 1 from role_permissions rp
    join permissions sp on sp.id = rp.permission_id
    where rp.role_id = r.id and sp.slug = 'financial.manage'
  )
on conflict do nothing;
