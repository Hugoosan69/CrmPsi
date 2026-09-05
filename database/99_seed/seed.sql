-- CSIB — Demo/fictional seed data only. Never insert real patients here (item 31).
--
-- auth.users rows must be created first via Supabase Auth (dashboard or admin API) —
-- they cannot be inserted with plain SQL. Create a handful of demo users there, then
-- replace the placeholder UUIDs below with the real ones before running this file,
-- and insert matching `profiles` + `clinic_memberships` rows.

insert into clinics (id, name, slug, primary_color, secondary_color) values
  ('00000000-0000-0000-0000-000000000001', 'CSIB - Centro de Saúde Integrada de Brasília', 'csib', '#0B3D5C', '#F5F7FA');

insert into roles (id, clinic_id, slug, name, is_system) values
  ('00000000-0000-0000-0000-000000000010', null, 'owner', 'Proprietário', true),
  ('00000000-0000-0000-0000-000000000011', null, 'admin', 'Administrador', true),
  ('00000000-0000-0000-0000-000000000012', null, 'receptionist', 'Recepcionista', true),
  ('00000000-0000-0000-0000-000000000013', null, 'professional', 'Profissional', true),
  ('00000000-0000-0000-0000-000000000014', null, 'financial', 'Financeiro', true);

insert into permissions (slug, module, description) values
  ('patients.view', 'patients', 'Visualizar pacientes'),
  ('patients.manage', 'patients', 'Cadastrar/editar pacientes'),
  ('agenda.view', 'agenda', 'Visualizar agenda'),
  ('agenda.manage', 'agenda', 'Agendar/reagendar/cancelar/confirmar'),
  ('queue.manage', 'queue', 'Gerenciar fila e chamadas'),
  ('service.manage', 'service', 'Conduzir atendimento clínico (cronômetro, prontuário)'),
  ('records.view', 'records', 'Visualizar prontuário'),
  ('documents.issue', 'documents', 'Emitir prescrições, atestados e declarações'),
  ('financial.view', 'financial', 'Visualizar financeiro'),
  ('financial.manage', 'financial', 'Registrar pagamentos e lançamentos'),
  ('users.manage', 'users', 'Gerenciar usuários e permissões'),
  ('settings.manage', 'settings', 'Identidade visual e ajustes gerais da clínica'),
  ('catalog.manage', 'catalog', 'Procedimentos, especialidades e formas de pagamento'),
  ('agenda.configure', 'agenda', 'Salas, horários de atendimento e bloqueios'),
  ('professionals.manage', 'professionals', 'Cadastrar e editar profissionais'),
  ('communication.manage', 'communication', 'Modelos, campanhas e automações de mensagem'),
  ('integrations.manage', 'integrations', 'Configurar n8n, WhatsApp e pagamentos online'),
  ('audit.view', 'audit', 'Visualizar trilha de auditoria'),
  ('packages.view', 'packages', 'Visualizar pacotes de sessões'),
  ('packages.manage', 'packages', 'Vender pacotes e gerenciar o catálogo'),
  ('financial.view_own', 'financial', 'Ver o próprio financeiro (apenas os seus atendimentos)'),
  ('financial.edit_amount', 'financial', 'Corrigir o valor de um lançamento já registrado'),
  ('financial.edit_paid', 'financial', 'Alterar um lançamento que já está pago'),
  ('agenda.appearance', 'agenda', 'Personalizar as cores da agenda por situação');

insert into role_permissions (role_id, permission_id)
-- Proprietário: tudo, integrações inclusive.
select '00000000-0000-0000-0000-000000000010', id from permissions
union all
-- Administrador: tudo menos integrações. Conectar o WhatsApp da clínica ou a conta de
-- pagamentos é um nível acima de administrar o sistema, e a clínica quer isso numa pessoa
-- só. Quem precisar recebe por exceção individual (user_permission_overrides).
select '00000000-0000-0000-0000-000000000011', id from permissions
  where slug <> 'integrations.manage'
union all
select '00000000-0000-0000-0000-000000000012', id from permissions where slug in
  ('patients.view', 'patients.manage', 'agenda.view', 'agenda.manage', 'queue.manage', 'financial.view', 'financial.manage', 'packages.view', 'packages.manage', 'financial.edit_amount', 'financial.edit_paid')
union all
select '00000000-0000-0000-0000-000000000013', id from permissions where slug in
  ('patients.view', 'agenda.view', 'queue.manage', 'service.manage', 'records.view', 'documents.issue', 'packages.view', 'financial.view_own')
union all
select '00000000-0000-0000-0000-000000000014', id from permissions where slug in
  ('financial.view', 'financial.manage', 'packages.view', 'packages.manage', 'financial.view_own', 'financial.edit_amount', 'financial.edit_paid');

insert into specialties (clinic_id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Clínica Geral'),
  ('00000000-0000-0000-0000-000000000001', 'Psicologia'),
  ('00000000-0000-0000-0000-000000000001', 'Nutrição');

insert into payment_methods (clinic_id, name, slug) values
  ('00000000-0000-0000-0000-000000000001', 'Dinheiro', 'dinheiro'),
  ('00000000-0000-0000-0000-000000000001', 'PIX', 'pix'),
  ('00000000-0000-0000-0000-000000000001', 'Cartão de Débito', 'debito'),
  ('00000000-0000-0000-0000-000000000001', 'Cartão de Crédito', 'credito'),
  ('00000000-0000-0000-0000-000000000001', 'Transferência', 'transferencia'),
  ('00000000-0000-0000-0000-000000000001', 'Convênio', 'convenio'),
  ('00000000-0000-0000-0000-000000000001', 'Outros', 'outros');

insert into document_templates (clinic_id, type, name, body_template) values
  ('00000000-0000-0000-0000-000000000001', 'atestado', 'Atestado médico (padrão)',
   'ATESTADO MÉDICO' || chr(10) || chr(10) ||
   'Atesto para os devidos fins que o(a) paciente {{patient_name}}, CPF {{patient_cpf}}, ' ||
   'esteve sob meus cuidados profissionais em {{date}}, necessitando de {{days}} dia(s) de afastamento ' ||
   'de suas atividades a partir desta data.' || chr(10) || chr(10) ||
   '{{clinic_name}}, {{date}}.' || chr(10) || chr(10) ||
   '{{professional_name}}' || chr(10) || '{{professional_register}}'),
  ('00000000-0000-0000-0000-000000000001', 'declaracao', 'Declaração de comparecimento (padrão)',
   'DECLARAÇÃO DE COMPARECIMENTO' || chr(10) || chr(10) ||
   'Declaro para os devidos fins que o(a) paciente {{patient_name}}, CPF {{patient_cpf}}, ' ||
   'compareceu a consulta/atendimento nesta unidade em {{date}}.' || chr(10) || chr(10) ||
   '{{clinic_name}}, {{date}}.' || chr(10) || chr(10) ||
   '{{professional_name}}' || chr(10) || '{{professional_register}}');

-- After creating demo auth.users + profiles + clinic_memberships, add:
--   professionals, procedures, fictional patients, appointments, queue_entries, payments.
-- Keep everything here obviously fictional (e.g. "Paciente Demonstração 1").
