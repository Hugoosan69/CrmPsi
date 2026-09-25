-- 036: mensagens recebidas do paciente (resposta de confirmação por WhatsApp).
--
-- Até aqui `messages` só guardava o que a clínica ENVIA. Para reagir a uma resposta do
-- paciente ("confirmar"), a mesma tabela passa a guardar também o que ela RECEBE —
-- `direction` distingue as duas, e `from_number` é o número bruto que respondeu, para casos
-- em que o número não bate com nenhum paciente cadastrado.

alter table messages
  add column direction text not null default 'outbound'
    check (direction in ('outbound', 'inbound')),
  add column from_number text;

alter type message_status add value if not exists 'received';

create index idx_messages_inbound on messages (clinic_id, patient_id, direction, created_at desc)
  where direction = 'inbound';
