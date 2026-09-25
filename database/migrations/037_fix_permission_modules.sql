-- 037: corrige o agrupamento de três permissões na tela de Permissões.
--
-- whatsapp.connect estava no módulo 'communication', mas a tela onde a ação acontece é
-- Configurações › WhatsApp — Comunicação é modelo/campanha/automação PARA O PACIENTE, coisa
-- diferente de conectar o número da própria clínica.
update permissions set module = 'settings' where slug = 'whatsapp.connect';

-- clinic.manage: permissão órfã — existia no banco (com concessões já dadas) mas não em
-- src/config/permissions.ts nem em nenhum requirePermission() do código. Duplicava
-- settings.manage e não travava tela nenhuma. Removida por completo.
delete from user_permission_overrides
  where permission_id in (select id from permissions where slug = 'clinic.manage');
delete from role_permissions
  where permission_id in (select id from permissions where slug = 'clinic.manage');
delete from permissions where slug = 'clinic.manage';
