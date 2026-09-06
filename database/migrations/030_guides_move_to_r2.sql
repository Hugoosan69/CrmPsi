-- ============================================================================
-- CSIB — Migration 030
-- O anexo da guia sai do storage do Supabase e vai para o R2 da Cloudflare.
--
-- A clínica passou a usar um bucket R2 ("crm") para os documentos. A coluna
-- `service_guides.attachment_url` já guardava uma referência livre justamente porque essa
-- decisão estava em aberto — agora ela guarda a CHAVE do objeto no R2, e quem lê pede um
-- link assinado ao servidor (src/lib/storage/guide-attachments.ts).
--
-- O bucket continua PRIVADO, no R2 como era no Supabase, e pela mesma razão: a guia liga
-- paciente, atendimento e convênio. Um endereço fixo vaza para sempre a quem o receber uma
-- vez; um link assinado morre sozinho, e é isso que torna seguro mandá-lo por e-mail.
--
-- Esta migration só derruba as policies do bucket antigo. O Supabase não permite apagar o
-- bucket por SQL (`storage.protect_delete`), então ele fica vazio e inalcançável até
-- alguém removê-lo pelo painel — nada aponta mais para lá.
--
-- Apply against a database that already has migrations/001 .. 029.
-- ============================================================================

drop policy if exists guides_clinic_read on storage.objects;
drop policy if exists guides_clinic_insert on storage.objects;
drop policy if exists guides_clinic_delete on storage.objects;
