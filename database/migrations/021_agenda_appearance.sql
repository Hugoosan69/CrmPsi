-- ============================================================================
-- 021 — Personalizar as cores da agenda.
--
-- A cor de cada situação no card da agenda (agendado, confirmado, concluído, cancelado,
-- não compareceu) passa a ser da clínica, gravada em `clinic_settings.settings.agenda`.
-- Nenhuma coluna nova: `settings` já é o jsonb onde as preferências da clínica moram.
--
-- A permissão é própria e não `settings.manage` porque a natureza é outra: trocar a logo é
-- identidade visual, mexer nas cores da agenda muda a leitura da tela em que a recepção e
-- os profissionais trabalham o dia inteiro. A clínica pode querer separar as duas coisas.
--
-- Apply against a database that already has migrations/001 .. 020.
-- ============================================================================

insert into permissions (slug, module, description) values
  ('agenda.appearance', 'agenda', 'Personalizar as cores da agenda por situação')
on conflict (slug) do nothing;

-- Concedida a quem já configura a clínica — mesmo critério das 019/020.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug = 'agenda.appearance'
  and exists (
    select 1 from role_permissions rp
    join permissions sp on sp.id = rp.permission_id
    where rp.role_id = r.id and sp.slug = 'settings.manage'
  )
on conflict do nothing;
