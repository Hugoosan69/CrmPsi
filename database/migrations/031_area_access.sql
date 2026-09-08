-- ============================================================================
-- CSIB — Migration 031
-- Separa ONDE a pessoa trabalha de O QUE ela pode fazer.
--
-- O problema, relatado da clínica: o profissional abria as telas de Recepção. Não era
-- falha de guarda — era o modelo. O menu e as rotas eram filtrados pelas permissões de
-- CAPACIDADE, e o profissional precisa legitimamente das mesmas:
--
--   patients.view   para abrir a ficha do paciente que ele vai atender
--   agenda.view     para ver a agenda dele
--   queue.manage    para CHAMAR o próximo da própria fila (a ação é a mesma do balcão)
--
-- Tirar qualquer uma dessas dele quebraria o atendimento. Ou seja: a permissão de
-- capacidade nunca poderia responder "esta pessoa trabalha no balcão?", porque essa é uma
-- pergunta diferente — e é a que o menu estava tentando fazer.
--
-- Entram três permissões de ÁREA. Elas não autorizam nenhuma ação: dizem em que parte do
-- sistema a pessoa trabalha. Menu e rota passam a exigir a área E a capacidade; as Server
-- Actions seguem exigindo só a capacidade, porque chamar o próximo paciente é a mesma ação
-- venha ela do balcão ou do consultório.
--
-- Consequência desejada: o profissional mantém tudo que faz e perde o menu Recepção.
--
-- Apply against a database that already has migrations/001 .. 030.
-- ============================================================================

insert into permissions (slug, module, description) values
  ('reception.access', 'areas', 'Trabalhar na recepção (balcão): pacientes, agenda, fila e caixa'),
  ('professional.access', 'areas', 'Trabalhar como profissional: minha agenda, minha fila e atendimentos'),
  ('management.access', 'areas', 'Ver a área de gestão e os indicadores gerenciais da clínica')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Concessão por papel.
--
-- A regra que guiou o recorte: ninguém perde nada que use hoje, EXCETO o profissional
-- perdendo a recepção — que é justamente o pedido. Por isso a área é concedida a quem já
-- tem alguma tela daquela área, e não a quem "parece" pertencer a ela.
--
-- `management.access` NÃO vai para a recepcionista, e isso é a segunda metade do pedido:
-- hoje ela enxerga Gestão › Financeiro (faturamento, despesas, resultado do mês) porque
-- tem `financial.view`, que ela precisa ter para fechar a cobrança no balcão. Continua
-- fechando cobrança; deixa de ver o caixa da clínica.
-- ---------------------------------------------------------------------------
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug = 'reception.access'
  and exists (
    select 1 from role_permissions rp
    join permissions existing on existing.id = rp.permission_id
    where rp.role_id = r.id and existing.slug in ('queue.manage', 'financial.manage')
  )
  -- O profissional tem `queue.manage` para a própria fila e cairia aqui. É o caso que esta
  -- migration existe para corrigir, então sai por nome: nenhum outro papel se define pelo
  -- que ele NÃO é.
  and r.slug <> 'professional'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug = 'professional.access'
  and exists (
    select 1 from role_permissions rp
    join permissions existing on existing.id = rp.permission_id
    -- Só `service.manage`. `financial.view_own` seria tentador ("Meu financeiro" fica nesta
    -- área) e está errado: ela diz apenas "vê o dinheiro dos próprios atendimentos", e a
    -- recepcionista a tem no banco de homologação. Concedida por ela, a área do consultório
    -- caía no balcão — e as telas de lá são vazias para quem não é profissional.
    where rp.role_id = r.id and existing.slug = 'service.manage'
  )
on conflict do nothing;

-- Gestão acompanha quem administra o sistema: `users.manage` já é proprietário e
-- administrador, e ninguém mais. O papel Financeiro entra logo abaixo, por nome.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug = 'management.access'
  and exists (
    select 1 from role_permissions rp
    join permissions existing on existing.id = rp.permission_id
    where rp.role_id = r.id and existing.slug = 'users.manage'
  )
on conflict do nothing;

-- O papel Financeiro não tem `users.manage`, mas a área de gestão é onde ele trabalha.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug = 'management.access' and r.slug = 'financial'
on conflict do nothing;

comment on column permissions.module is
  'Agrupador da tela de permissões. O módulo `areas` é especial: não autoriza ação nenhuma, diz em que parte do sistema a pessoa trabalha, e é o que separa o menu do balcão do menu do consultório.';
