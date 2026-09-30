-- 039: Permissão para finalizar processos da fila sem atendimento
--
-- Operação administrativa para limpar entradas antigas que ficaram presas na fila
-- por erro operacional. Marca a queue_entry e o appointment como completed sem
-- criar service_session. Concedida a quem já gerencia a fila.

insert into permissions (slug, module, description)
values ('queue.force_complete', 'queue', 'Finalizar processos da fila sem atendimento (limpeza)')
on conflict (slug) do nothing;

-- Concede a quem já tem queue.manage: owner, admin, recepcionista
insert into role_permissions (role_id, permission_id)
select rp.role_id, p.id
from permissions p
cross join (
  select distinct role_id
  from role_permissions
  where permission_id = (select id from permissions where slug = 'queue.manage')
) rp
where p.slug = 'queue.force_complete'
on conflict do nothing;
