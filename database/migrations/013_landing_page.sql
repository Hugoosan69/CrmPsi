-- ============================================================================
-- 013 — Landing page (institucional, pública).
--
-- Reconstruído a partir do schema vivo de produção em 2026-09-05. Esta migration
-- tinha sido aplicada direto no SQL editor do Supabase (rastreada lá como
-- `create_landing_page_tables`, 20260902224253) sem nenhum arquivo correspondente
-- neste repositório — descoberto ao replicar produção para o ambiente de
-- homologação: produção tinha 50 tabelas, o repo só descrevia 42.
--
-- Conteúdo editável da página pública da clínica (hero, seções, serviços,
-- equipe, depoimentos, FAQ, contato) mais os leads capturados pelo formulário.
-- Leitura pública (`anon`); escrita restrita a owner/admin via `lp_is_admin()`.
--
-- Apply against a database that already has 00_core .. 15_audit and
-- migrations/001 .. 012.
-- ============================================================================

create table if not exists lp_settings (
  id text primary key default 'main',
  clinic_name text not null default 'CSIB - Centro de Saúde Integrada',
  tagline text default 'Cuidar do Corpo e Mente em um só lugar',
  primary_color text default '#005377',
  secondary_color text default '#59B6DE',
  accent_color text default '#F8BE00',
  background_color text default '#FCFCFC',
  text_color text default '#1E293B',
  font_family text default 'Urbanist',
  logo_url text default '',
  hero_badge text default 'Excelência Médica & Bem-Estar Integrado em Brasília',
  hero_title text default 'Cuidar do Corpo e Mente em um só lugar',
  hero_subtitle text default 'Encontre equilíbrio e bem-estar através de cuidados especializados em psicologia, neuropsicologia e especialidades integradas com ambiente acolhedor.',
  hero_cta_text text default 'Agendar Consulta',
  hero_cta_whatsapp text default '5561999990000',
  meta_title text default 'CSIB - Clínica Integrada em Brasília',
  meta_description text default 'Clínica Especializada em Psicologia, Neuropsicologia, Nutrição, Fonoaudiologia e Psiquiatria em Brasília.',
  admin_pin text default '123456',
  updated_at timestamptz default now(),
  hero_image_url text,
  about_image_url text
);

create table if not exists lp_sections (
  id text primary key,
  title text not null,
  subtitle text default '',
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz default now()
);

create table if not exists lp_services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text default 'Geral',
  description text not null,
  icon text default 'HeartPulse',
  image_url text default '',
  duration text default '50 min',
  whatsapp_message text default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists lp_team (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  registry text default '',
  bio text default '',
  photo_url text default '',
  specialties text[] default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists lp_testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_role text default 'Paciente',
  rating integer not null default 5,
  comment text not null,
  avatar_url text default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists lp_contact (
  id text primary key default 'main',
  phone text default '(61) 3345-0000',
  whatsapp text default '(61) 98123-4567',
  whatsapp_raw text default '5561981234567',
  email text default 'contato@csib.com.br',
  address_street text default 'SGAS 915 - Centro Clínico Advance',
  address_neighborhood text default 'Asa Sul',
  city text default 'Brasília',
  state text default 'DF',
  zip_code text default '70390-150',
  google_maps_embed_url text default 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3838.790906232585!2d-47.9255000!3d-15.8150000!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x935a3b27b50f7ff1%3A0x2649b1c7c10b42f5!2sAsa%20Sul%2C%20Bras%C3%ADlia%20-%20DF!5e0!3m2!1spt-BR!2sbr!4v1700000000000!5m2!1spt-BR!2sbr',
  google_maps_url text default 'https://maps.google.com/?q=Asa+Sul+Brasilia',
  hours_weekdays text default 'Segunda a Sexta: 08:00 às 20:00',
  hours_saturday text default 'Sábados: 08:00 às 13:00',
  instagram_url text default 'https://www.instagram.com/csibrasilia/',
  facebook_url text default '',
  linkedin_url text default '',
  updated_at timestamptz default now()
);

create table if not exists lp_faq (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists lp_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text default '',
  phone text not null,
  service_interest text default '',
  message text default '',
  status text not null default 'novo',
  created_at timestamptz default now()
);

-- security definer: usado dentro das políticas abaixo, precisa enxergar
-- clinic_memberships/roles/profiles independentemente de quem chama.
create or replace function lp_is_admin()
returns boolean
language sql stable security definer
set search_path = 'public'
as $function$
  select exists (
    select 1
    from public.clinic_memberships m
    join public.roles r on r.id = m.role_id
    left join public.profiles p on p.id = m.user_id
    where m.user_id = auth.uid()
      and m.active
      and r.slug in ('owner', 'admin')
      and coalesce(p.active, true)
  );
$function$;

alter table lp_settings enable row level security;
alter table lp_sections enable row level security;
alter table lp_services enable row level security;
alter table lp_team enable row level security;
alter table lp_testimonials enable row level security;
alter table lp_contact enable row level security;
alter table lp_faq enable row level security;
alter table lp_leads enable row level security;

drop policy if exists lp_settings_public_read on lp_settings;
create policy lp_settings_public_read on lp_settings for select using (true);
drop policy if exists lp_settings_admin_insert on lp_settings;
create policy lp_settings_admin_insert on lp_settings for insert with check (lp_is_admin());
drop policy if exists lp_settings_admin_update on lp_settings;
create policy lp_settings_admin_update on lp_settings for update using (lp_is_admin()) with check (lp_is_admin());
drop policy if exists lp_settings_admin_delete on lp_settings;
create policy lp_settings_admin_delete on lp_settings for delete using (lp_is_admin());

drop policy if exists lp_sections_public_read on lp_sections;
create policy lp_sections_public_read on lp_sections for select using (true);
drop policy if exists lp_sections_admin_insert on lp_sections;
create policy lp_sections_admin_insert on lp_sections for insert with check (lp_is_admin());
drop policy if exists lp_sections_admin_update on lp_sections;
create policy lp_sections_admin_update on lp_sections for update using (lp_is_admin()) with check (lp_is_admin());
drop policy if exists lp_sections_admin_delete on lp_sections;
create policy lp_sections_admin_delete on lp_sections for delete using (lp_is_admin());

drop policy if exists lp_services_public_read on lp_services;
create policy lp_services_public_read on lp_services for select using (true);
drop policy if exists lp_services_admin_insert on lp_services;
create policy lp_services_admin_insert on lp_services for insert with check (lp_is_admin());
drop policy if exists lp_services_admin_update on lp_services;
create policy lp_services_admin_update on lp_services for update using (lp_is_admin()) with check (lp_is_admin());
drop policy if exists lp_services_admin_delete on lp_services;
create policy lp_services_admin_delete on lp_services for delete using (lp_is_admin());

drop policy if exists lp_team_public_read on lp_team;
create policy lp_team_public_read on lp_team for select using (true);
drop policy if exists lp_team_admin_insert on lp_team;
create policy lp_team_admin_insert on lp_team for insert with check (lp_is_admin());
drop policy if exists lp_team_admin_update on lp_team;
create policy lp_team_admin_update on lp_team for update using (lp_is_admin()) with check (lp_is_admin());
drop policy if exists lp_team_admin_delete on lp_team;
create policy lp_team_admin_delete on lp_team for delete using (lp_is_admin());

drop policy if exists lp_testimonials_public_read on lp_testimonials;
create policy lp_testimonials_public_read on lp_testimonials for select using (true);
drop policy if exists lp_testimonials_admin_insert on lp_testimonials;
create policy lp_testimonials_admin_insert on lp_testimonials for insert with check (lp_is_admin());
drop policy if exists lp_testimonials_admin_update on lp_testimonials;
create policy lp_testimonials_admin_update on lp_testimonials for update using (lp_is_admin()) with check (lp_is_admin());
drop policy if exists lp_testimonials_admin_delete on lp_testimonials;
create policy lp_testimonials_admin_delete on lp_testimonials for delete using (lp_is_admin());

drop policy if exists lp_contact_public_read on lp_contact;
create policy lp_contact_public_read on lp_contact for select using (true);
drop policy if exists lp_contact_admin_insert on lp_contact;
create policy lp_contact_admin_insert on lp_contact for insert with check (lp_is_admin());
drop policy if exists lp_contact_admin_update on lp_contact;
create policy lp_contact_admin_update on lp_contact for update using (lp_is_admin()) with check (lp_is_admin());
drop policy if exists lp_contact_admin_delete on lp_contact;
create policy lp_contact_admin_delete on lp_contact for delete using (lp_is_admin());

drop policy if exists lp_faq_public_read on lp_faq;
create policy lp_faq_public_read on lp_faq for select using (true);
drop policy if exists lp_faq_admin_insert on lp_faq;
create policy lp_faq_admin_insert on lp_faq for insert with check (lp_is_admin());
drop policy if exists lp_faq_admin_update on lp_faq;
create policy lp_faq_admin_update on lp_faq for update using (lp_is_admin()) with check (lp_is_admin());
drop policy if exists lp_faq_admin_delete on lp_faq;
create policy lp_faq_admin_delete on lp_faq for delete using (lp_is_admin());

-- lp_leads não tem policy de leitura pública: só quem enviou o formulário (anon) grava,
-- só admin/owner lê o que chegou.
drop policy if exists lp_leads_public_insert on lp_leads;
create policy lp_leads_public_insert on lp_leads for insert with check (true);
drop policy if exists lp_leads_admin_read on lp_leads;
create policy lp_leads_admin_read on lp_leads for select using (lp_is_admin());
drop policy if exists lp_leads_admin_insert on lp_leads;
create policy lp_leads_admin_insert on lp_leads for insert with check (lp_is_admin());
drop policy if exists lp_leads_admin_update on lp_leads;
create policy lp_leads_admin_update on lp_leads for update using (lp_is_admin()) with check (lp_is_admin());
drop policy if exists lp_leads_admin_delete on lp_leads;
create policy lp_leads_admin_delete on lp_leads for delete using (lp_is_admin());
