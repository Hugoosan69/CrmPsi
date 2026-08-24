# CSIB — Plano técnico do MVP

Status: aprovado para início da Fase 1 (schema do banco definido em `database/`, sem UI
implementada ainda). Este documento é a referência que cada fase deve validar contra.

## 1. Arquitetura geral

Monólito modular em Next.js (App Router), não microserviços. Os domínios de negócio são
isolados por *feature folder* e por schema de banco desde o início, para que uma futura
extração de serviço (ex.: financeiro, comunicação) seja um corte de código, não uma reescrita.

Camadas, de fora para dentro:

```
UI (app/, components/, features/*/components)
  → Server Actions / Route Handlers (features/*/actions, app/api/**)
    → Serviços de domínio (services/*.service.ts)  — regra de negócio + autorização
      → Supabase (Postgres + RLS, Auth, Storage, Realtime)
```

Regras:
- UI nunca fala direto com o Supabase para operações de escrita sensíveis — passa por um
  Server Action que revalida permissão via `has_permission()` antes de mutar.
- Leitura simples (ex.: listar pacientes) pode ir direto do client Supabase + RLS, via
  TanStack Query, quando não há lógica de negócio envolvida.
- RLS é a rede de segurança final, nunca a única camada (item 23 do briefing). Esconder um
  botão não é controle de acesso.

## 2. Stack e por quê

| Camada | Escolha | Nota |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Server Components para dados, Server Actions para mutações |
| UI | Tailwind + shadcn/ui | Componentes acessíveis, fácil de tematizar com a paleta CSIB |
| Formulários | React Hook Form + Zod | Mesmo schema Zod valida client e server |
| Dados remotos | Supabase (Postgres, Auth, Storage, Realtime) | Já é o banco fornecido |
| Cache/estado servidor | TanStack Query | Só nas telas com necessidade real de cache/revalidação (fila, agenda) — não usar em toda tela |

Sem adição de bibliotecas além dessas sem necessidade concreta.

## 3. Estrutura de pastas

```
src/
  app/
    (auth)/login/
    (app)/dashboard/
    (app)/recepcao/
      pacientes/
      agenda/
      fila/
      financeiro/
    (app)/profissional/
      agenda/
      fila/
      atendimento/[id]/
      pacientes/[id]/
    (app)/gestao/
      financeiro/
      profissionais/
      procedimentos/
      usuarios/
      permissoes/
      configuracoes/
    api/                     # apenas onde Server Actions não servem (webhooks futuros)
  components/                # shadcn primitives + componentes de UI puros e reutilizáveis
  features/
    patients/
    scheduling/
    queue/
    service/                 # atendimento + cronômetro
    records/                 # prontuário, CID
    prescriptions/
    documents/
    financial/
    professionals/
    procedures/
    users/                   # usuários, papéis, permissões
    communication/
    audit/
    <domain>/
      components/            # UI específica do domínio
      actions.ts              # Server Actions (mutação + checagem de permissão)
      hooks.ts                 # hooks de dados (TanStack Query) quando aplicável
  lib/
    supabase/                 # server client, browser client, admin(service-role) client
    auth/                     # sessão atual, clínica ativa, checagem de permissão no server
  hooks/                       # hooks cross-domain (useCurrentClinic, useAuth)
  types/                       # tipos gerados do Supabase + tipos de domínio
  services/                    # camada de acesso a dados por domínio (repositório)
    patients.service.ts
    scheduling.service.ts
    queue.service.ts
    service.service.ts
    records.service.ts
    financial.service.ts
    audit.service.ts
    ...
  schemas/                     # Zod schemas por domínio (input de formulários e Server Actions)
  utils/
  config/                      # paleta, constantes de enum, feature flags
public/
  branding/
    csib-logo.svg              # placeholder até asset oficial ser fornecido
    csib-mascote.svg
database/                       # ver database/README.md
docs/
  ARCHITECTURE.md               # este arquivo
```

`services/` é a única camada que fala com o Supabase para escrita; `features/*/actions.ts`
chama `services/*` depois de validar input (Zod) e permissão (`has_permission`).

## 4. Módulos e entidades (banco já definido em `database/`)

Ver `database/README.md` para a tabela completa domínio → tabelas. Resumo funcional:

- **Identity/RBAC**: `profiles`, `roles`, `permissions`, `role_permissions`,
  `clinic_memberships`. Um usuário pertence a uma clínica através de `clinic_memberships`,
  nunca por um campo fixo — isso é o que sustenta multi-tenancy.
- **Pacientes**: `patients` + `patient_clinical_info` (alergias, condições crônicas).
- **Agenda vs. Fila** (decisão de design importante): `appointments` guarda o compromisso
  agendado com status de calendário (scheduled/confirmed/cancelled/no_show/completed).
  `queue_entries` é a entidade operacional em tempo real (waiting/called/in_service/
  paused/completed/cancelled), pode ou não referenciar um `appointment_id`, e cobre
  encaixes e walk-ins que nunca tiveram agendamento. `queue_transfers` preserva histórico
  de transferência entre profissionais.
- **Atendimento/cronômetro**: `service_sessions` + `service_session_events` (start/pause/
  resume/finish, timestamp de banco — nunca o relógio do navegador).
- **Prontuário**: `medical_records` (um por atendimento) + `record_diagnoses` (N CIDs) +
  `cid_codes` (tabela de referência).
- **Prescrições**: `prescriptions` + `prescription_items` (N medicamentos por receita).
- **Documentos clínicos**: `document_templates` (modelos reutilizáveis) +
  `clinical_documents` (documento emitido).
- **Financeiro**: `financial_transactions` (receita/despesa, com status) + `payments`
  (recebimentos reais, permite pagamento parcial).
- **Comunicação**: `message_templates` + `messages`, desacoplado de provedor — ver §8.
- **Storage**: `files`, metadado sobre objetos no Supabase Storage.
- **Configurações**: `clinic_settings` (jsonb flexível).
- **Auditoria**: `audit_logs`, escrito exclusivamente pelo backend após cada mutação
  sensível listada no item 22 do briefing.

## 5. Autenticação e autorização

**Autenticação**: Supabase Auth (e-mail/senha). Não há auto-cadastro público — contas de
staff são criadas por quem tem `users.manage` (Proprietário/Administrador), via Admin API
no server, o que também cria a linha em `profiles` e a `clinic_membership` inicial.

**Sessão e clínica ativa**: no login, o server carrega as `clinic_memberships` ativas do
usuário. Com uma única clínica hoje, a clínica ativa é implícita; a estrutura já suporta
um seletor de clínica quando houver mais de uma (SaaS futuro) sem mudança de schema.

**Autorização (RBAC granular)**: papel → permissões via `role_permissions`
(`patients.manage`, `agenda.manage`, `queue.manage`, `service.manage`, `records.view`,
`documents.issue`, `financial.view`, `financial.manage`, `users.manage`,
`settings.manage`, `audit.view`, …). Papéis iniciais: `owner`, `admin`, `receptionist`,
`professional`, `financial` (seed em `database/99_seed/seed.sql`).

Checagem em três pontos, nunca menos que os dois primeiros:
1. **Middleware/layout de rota**: bloqueia navegação para `/gestao/**`, `/recepcao/**`,
   `/profissional/**` conforme o papel — evita flash de conteúdo indevido.
2. **Server Action**: revalida `has_permission(clinicId, slug)` antes de qualquer mutação,
   independente do que a UI permitiu chegar até ali.
3. **RLS**: garante isolamento por clínica como rede de segurança final (ver
   `database/README.md` §Authorization model).

## 6. Fluxos operacionais

### Recepção
Buscar/cadastrar paciente → Agendar → Paciente chega → Check-in → Entrar na fila →
Acompanhar fila em tempo real → Registrar pagamento ao final do atendimento.

### Profissional
Ver fila destinada a mim → Chamar paciente → Iniciar atendimento (cronômetro liga) →
Pausar/retomar → Consultar histórico/prescrições/documentos anteriores → Registrar
queixa/exame/avaliação/plano + CID → Emitir prescrição/atestado → Finalizar (cronômetro
para, `queue_entries.status = completed`).

### Transferência
Em atendimento → Transferir para outro profissional → `queue_transfers` registra
de/para/motivo/quem fez → fila do profissional destino recebe o paciente.

### Financeiro
Atendimento finalizado ou avulso → `financial_transactions` (receita) → `payments`
(um ou mais recebimentos) → status pendente/pago/atrasado.

Esses fluxos devem funcionar ponta a ponta (cenário do item 35 do briefing) antes de
qualquer funcionalidade secundária ser adicionada.

## 7. Rotas (App Router)

```
/login
/dashboard                          # redireciona por papel para a home certa

/recepcao
/recepcao/pacientes
/recepcao/agenda
/recepcao/fila
/recepcao/financeiro

/profissional
/profissional/agenda
/profissional/fila
/profissional/atendimento/[id]      # workspace de atendimento (cronômetro sempre visível)
/profissional/pacientes/[id]        # perfil do paciente (mesma tela usada pela recepção)

/gestao
/gestao/financeiro
/gestao/profissionais
/gestao/procedimentos
/gestao/usuarios
/gestao/permissoes
/gestao/configuracoes
```

`/profissional/pacientes/[id]` e a versão acessada pela recepção compartilham o mesmo
componente de perfil do paciente (`features/patients/components/PatientProfile`), só
variando quais abas/ações aparecem conforme a permissão do usuário logado.

## 8. Componentes reutilizáveis (base inicial)

`PatientSearch`, `PatientCard`, `PatientProfile`, `AppointmentCard`, `AppointmentStatus`,
`QueueList`, `QueueEntry`, `ServiceTimer`, `PatientTimeline`, `ClinicalHistory`,
`PrescriptionBuilder`, `DocumentBuilder`, `PaymentModal`, `ProfessionalCard`,
`PermissionMatrix`, `DataTable`, `ConfirmDialog`. Todos em `components/` se forem
genéricos, ou em `features/<domain>/components` se dependerem de regra de negócio do
domínio.

## 9. Comunicação (desacoplada, item 21)

`services/communication.service.ts` expõe uma interface `MessageProvider` (`send(message):
Promise<ProviderResult>`). MVP usa um `ConsoleProvider` (loga e marca `sent` para fins de
demonstração) — trocar por WhatsApp/SMS/e-mail real depois é implementar um novo Provider,
sem tocar em `message_templates`/`messages` nem em quem chama o serviço.

## 10. Estados de tela

Todo componente de dado assíncrono trata explicitamente: loading, vazio, erro, sucesso,
confirmação (via `ConfirmDialog`), dado incompleto, e ausência de permissão (mensagem
clara, nunca uma tela quebrada).

## 11. Identidade visual (placeholder até assets oficiais)

Paleta base a partir do item 5 do briefing — azul-petróleo + fundo claro:
- Primária: `#0B3D5C` (azul-petróleo)
- Secundária/fundo: `#F5F7FA`
- Acento: a definir com asset real (logo ainda não fornecido)

`public/branding/csib-logo.svg` e `csib-mascote.svg` serão placeholders simples nesta
paleta até os arquivos oficiais (`csib-logo-reference.png`, `csib-mascote-reference.png`)
serem fornecidos — trocar o arquivo depois não exige mudança de código, só o asset.

## 12. Ordem de implementação

- **Fase 0 (infra)**: scaffold Next.js, Supabase client (server/browser/admin), aplicar
  schema em `database/`, layout shells por área (`(app)/recepcao`, `/profissional`,
  `/gestao`), tema Tailwind com a paleta acima.
- **Fase 1**: Login → Dashboard (por papel) → Usuários/perfis → Pacientes →
  Profissionais → Procedimentos.
- **Fase 2**: Agenda → Check-in → Fila → Chamadas → Cronômetro.
- **Fase 3**: Atendimento (workspace) → Prontuário → Histórico → CID → Prescrição →
  Atestado.
- **Fase 4**: Financeiro (pagamentos, receitas, despesas).
- **Fase 5**: Comunicação (estrutura de confirmação/lembrete).

Cada fase só avança depois que o fluxo ponta a ponta do item 35 do briefing continua
funcionando com o que foi adicionado.
