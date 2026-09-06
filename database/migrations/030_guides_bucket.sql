-- ============================================================================
-- CSIB — Migration 030
-- Bucket das guias de convênio.
--
-- PRIVADO, ao contrário de `avatars` e `branding`: a guia liga um paciente a um atendimento
-- e a um convênio — é dado de saúde. Um bucket público seria acessível a quem descobrisse a
-- URL, sem sessão nenhuma. A leitura passa pelo servidor, que confere a clínica antes de
-- gerar um link temporário.
--
-- O caminho do arquivo começa com o `clinic_id`, e é isso que as policies conferem: uma
-- clínica não alcança a guia de outra nem sabendo o nome do arquivo.
--
-- A coluna `service_guides.attachment_url` continua existindo em paralelo, para o caso de a
-- clínica decidir guardar as guias fora (Google Drive, por exemplo) — a decisão segue em
-- aberto, e as duas formas convivem.
--
-- Apply against a database that already has migrations/001 .. 029.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('guides', 'guides', false)
on conflict (id) do update set public = false;

drop policy if exists guides_clinic_read on storage.objects;
create policy guides_clinic_read on storage.objects for select
  to authenticated
  using (
    bucket_id = 'guides'
    and has_clinic_access(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists guides_clinic_insert on storage.objects;
create policy guides_clinic_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'guides'
    and has_clinic_access(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists guides_clinic_delete on storage.objects;
create policy guides_clinic_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'guides'
    and has_clinic_access(((storage.foldername(name))[1])::uuid)
  );
