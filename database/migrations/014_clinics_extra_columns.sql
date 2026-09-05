-- ============================================================================
-- 014 — Colunas extras em `clinics`, descobertas ao replicar produção.
--
-- `cnpj`, `whatsapp`, `staff_count` e `short_name` existiam em produção sem
-- nenhuma migration correspondente neste repositório — aplicadas direto no SQL
-- editor em algum momento após 00_core. Descoberto comparando
-- information_schema.columns de produção contra o schema aplicado a partir
-- deste repositório ao provisionar o ambiente de homologação.
--
-- Apply against a database that already has 00_core .. 15_audit and
-- migrations/001 .. 013.
-- ============================================================================

alter table clinics add column if not exists cnpj text;
alter table clinics add column if not exists whatsapp text;
alter table clinics add column if not exists staff_count integer;
alter table clinics add column if not exists short_name text;
