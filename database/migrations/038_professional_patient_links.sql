-- migration 038: Vínculos profissional ↔ paciente
--
-- Problema: o profissional precisava de `reception.access` para ver seus pacientes,
-- porque a única tela de pacientes vivia em /recepcao. Resultado: ou abria o balcão
-- inteiro, ou o profissional não tinha como acessar o prontuário de quem atendeu.
--
-- Solução: tabela de vínculo explícito. Duas fontes:
--   1) Automática: quando um agendamento é criado, o trigger abaixo vincula o
--      profissional ao paciente (se ainda não existir).
--   2) Manual: a recepção pode vincular/desvincular um profissional a um paciente
--      diretamente da ficha do paciente.
--
-- A rota /profissional/pacientes consulta APENAS esta tabela. A ficha do paciente
-- (/profissional/pacientes/[id]) só abre se houver vínculo — o profissional não vê
-- pacientes de outros colegas (LGPD: dado sensível de saúde mental).

create table if not exists professional_patient_links (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id),
  professional_id uuid not null references professionals(id),
  patient_id  uuid not null references patients(id),
  source      text not null default 'appointment'
    check (source in ('appointment', 'manual')),
  created_at  timestamptz not null default now(),

  unique (professional_id, patient_id)
);

alter table professional_patient_links enable row level security;

create policy "clinic_access" on professional_patient_links
  for all using (has_clinic_access(clinic_id));

-- Índice para a query principal: "meus pacientes" por profissional.
create index if not exists idx_professional_patient_links_prof
  on professional_patient_links (professional_id);

-- Índice para a ficha do paciente: "quais profissionais atendem este paciente?"
create index if not exists idx_professional_patient_links_patient
  on professional_patient_links (patient_id);

-- Trigger: ao criar um agendamento, vincula automaticamente profissional ↔ paciente.
-- ON CONFLICT DO NOTHING: se já existe, não duplica. Roda apenas no INSERT para não
-- disparar em reagendamentos (que não mudam o profissional de verdade).
create or replace function link_professional_on_appointment()
returns trigger as $$
begin
  insert into professional_patient_links (clinic_id, professional_id, patient_id, source)
  values (NEW.clinic_id, NEW.professional_id, NEW.patient_id, 'appointment')
  on conflict (professional_id, patient_id) do nothing;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_link_professional_on_appointment on appointments;
create trigger trg_link_professional_on_appointment
  after insert on appointments
  for each row execute function link_professional_on_appointment();

-- Retroativo: cria vínculos a partir de agendamentos que já existem.
-- Sem isto, os profissionais veriam "Meus pacientes" vazio até o próximo agendamento.
insert into professional_patient_links (clinic_id, professional_id, patient_id, source)
select distinct a.clinic_id, a.professional_id, a.patient_id, 'appointment'
from appointments a
where not exists (
  select 1 from professional_patient_links l
  where l.professional_id = a.professional_id
    and l.patient_id = a.patient_id
)
on conflict (professional_id, patient_id) do nothing;
