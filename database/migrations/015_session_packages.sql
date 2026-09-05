-- ============================================================================
-- 015 — Pacotes de sessões.
--
-- Hoje toda "sessão de pacote" vendida pela clínica é lançada manualmente como um
-- atendimento avulso de R$ 1,00 só para não ficar pendente no financeiro — distorce os
-- relatórios (mostra R$ 1,00 em vez do valor real) e não mostra quanto do pacote já foi
-- usado. Esta migration cria o conceito real: um catálogo de pacotes por especialidade
-- (`session_packages`), o saldo vendido a um paciente (`patient_packages`), e uma linha
-- por sessão reservada/consumida (`patient_package_sessions`) que liga de volta a um
-- `appointment`.
--
-- Reserva x consumo: agendar com pacote cria a sessão em `reserved` (aparece na agenda
-- como "3/4" antes mesmo de acontecer); só vira `consumed` (e só aí incrementa o saldo)
-- quando o atendimento é de fato concluído. Falta justificada ou cancelamento liberam a
-- posição sem consumir; falta não justificada consome sem que o atendimento tenha
-- ocorrido.
--
-- Pacote é por especialidade (não por profissional específico) e pago integralmente no
-- ato da venda — nenhuma sessão individual gera cobrança nova. O check-in de uma sessão
-- de pacote cria uma `financial_transactions` de R$ 0,00 já `pago` (implementado na
-- camada de aplicação), o que satisfaz o gate de pagamento da fila
-- (`enforce_queue_payment_gate`, migration 001) sem precisar alterar o trigger.
--
-- Apply against a database that already has 00_core .. 15_audit and
-- migrations/001 .. 014.
-- ============================================================================

do $$ begin
  create type patient_package_status as enum ('active', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type patient_package_session_status as enum ('reserved', 'consumed', 'released');
exception when duplicate_object then null;
end $$;

-- Catálogo — clinic-editable, no espírito de `procedures`/`specialties`.
create table if not exists session_packages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  specialty_id uuid not null references specialties(id),
  name text not null,
  total_sessions integer not null check (total_sessions > 0),
  total_price numeric(10,2) not null check (total_price >= 0),
  -- Calculado, nunca digitado — item 3 do briefing original.
  price_per_session numeric(10,2) generated always as (round(total_price / total_sessions, 2)) stored,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_session_packages_clinic on session_packages (clinic_id) where active;

-- O pacote vendido a um paciente — snapshot dos valores da venda, para não quebrar
-- histórico se o catálogo mudar depois.
create table if not exists patient_packages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id),
  session_package_id uuid not null references session_packages(id),
  total_sessions integer not null check (total_sessions > 0),
  total_price numeric(10,2) not null,
  sessions_used integer not null default 0,
  purchased_at timestamptz not null default now(),
  -- Nulo para pacotes retroativos (conversão de lançamentos antigos de R$1 — não existe
  -- uma única cobrança de venda para eles).
  financial_transaction_id uuid references financial_transactions(id),
  status patient_package_status not null default 'active'
);

create index if not exists idx_patient_packages_patient on patient_packages (patient_id, status);

-- Uma linha por sessão do pacote. `appointment_id` nulo é o que permite o vínculo
-- retroativo (requisito 6) sem exigir um agendamento "puro" por trás.
create table if not exists patient_package_sessions (
  id uuid primary key default gen_random_uuid(),
  patient_package_id uuid not null references patient_packages(id) on delete cascade,
  appointment_id uuid references appointments(id),
  session_number integer not null check (session_number > 0),
  status patient_package_session_status not null default 'reserved',
  consumed_at timestamptz
);

create index if not exists idx_pps_package on patient_package_sessions (patient_package_id);
create unique index if not exists idx_pps_appointment on patient_package_sessions (appointment_id)
  where appointment_id is not null;

alter table appointments
  add column if not exists patient_package_session_id uuid references patient_package_sessions(id),
  add column if not exists no_show_justified boolean;

-- Espelha exatamente o padrão de `set_updated_at`/`enforce_queue_payment_gate`: a regra
-- de negócio vive no banco, não só na Server Action, para não depender de todo caminho de
-- escrita lembrar de aplicá-la.
create or replace function apply_patient_package_session_consumption()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'consumed' and old.status is distinct from 'consumed' then
    update patient_packages
      set sessions_used = sessions_used + 1
      where id = new.patient_package_id;

    update patient_packages
      set status = 'completed'
      where id = new.patient_package_id
        and status = 'active'
        and sessions_used >= total_sessions;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_patient_package_session_consumption on patient_package_sessions;
create trigger trg_patient_package_session_consumption
  after update of status on patient_package_sessions
  for each row execute function apply_patient_package_session_consumption();

alter table session_packages enable row level security;
alter table patient_packages enable row level security;
alter table patient_package_sessions enable row level security;

drop policy if exists session_packages_rw on session_packages;
create policy session_packages_rw on session_packages for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));

drop policy if exists patient_packages_rw on patient_packages;
create policy patient_packages_rw on patient_packages for all
  using (has_clinic_access(clinic_id)) with check (has_clinic_access(clinic_id));

drop policy if exists patient_package_sessions_rw on patient_package_sessions;
create policy patient_package_sessions_rw on patient_package_sessions for all
  using (exists (
    select 1 from patient_packages pp
    where pp.id = patient_package_id and has_clinic_access(pp.clinic_id)
  ))
  with check (exists (
    select 1 from patient_packages pp
    where pp.id = patient_package_id and has_clinic_access(pp.clinic_id)
  ));

-- Permissões novas — mesmo mecanismo da migration 009: concedidas a quem já tem uma
-- permissão correlata, para ninguém perder acesso ao aplicar.
insert into permissions (slug, module, description) values
  ('packages.view', 'packages', 'Visualizar pacotes de sessões'),
  ('packages.manage', 'packages', 'Vender pacotes e gerenciar o catálogo')
on conflict (slug) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug = 'packages.view'
  and exists (
    select 1 from role_permissions rp
    join permissions sp on sp.id = rp.permission_id
    where rp.role_id = r.id and sp.slug = 'patients.view'
  )
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug = 'packages.manage'
  and exists (
    select 1 from role_permissions rp
    join permissions sp on sp.id = rp.permission_id
    where rp.role_id = r.id and sp.slug = 'financial.manage'
  )
on conflict do nothing;
