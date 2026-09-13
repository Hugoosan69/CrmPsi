-- ============================================================================
-- CSIB — Migration 034
-- Vincular o número de WhatsApp deixa de exigir a permissão de integrações.
--
-- Até aqui a mesma permissão — integrations.manage, só do proprietário — cobria duas coisas
-- de peso muito diferente:
--
--   INFRAESTRUTURA   endereço do servidor WAHA, nome da sessão, chave de API, n8n
--                    → controle total da conta de WhatsApp da clínica
--   VÍNCULO          ler o QR code, reiniciar a sessão que caiu, desconectar o número
--                    → operação de rotina, repetida a cada queda da sessão
--
-- Com as duas juntas, ou alguém além do proprietário recebia a chave de API só para poder
-- reler um QR, ou o WhatsApp da clínica ficava fora do ar até o proprietário aparecer.
-- A tela também separa: o vínculo fica em Configurações › WhatsApp, e a infraestrutura
-- numa página própria, Gestão › Integrações.
--
-- Concedida ao proprietário e ao administrador. Exceção pessoa a pessoa pela tela de
-- Permissões, como as demais.
--
-- Apply against a database that already has migrations/001 .. 033.
-- ============================================================================

insert into permissions (slug, module, description) values
  ('whatsapp.connect', 'communication',
   'Vincular e desvincular o número de WhatsApp da clínica (ler QR code, reiniciar sessão)')
on conflict (slug) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug = 'whatsapp.connect'
  and r.slug in ('owner', 'admin')
on conflict do nothing;
