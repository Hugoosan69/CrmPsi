# CSIB — Centro de Saúde Integrada de Brasília

Plataforma de operação clínica (Next.js + Supabase). Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
para arquitetura completa e [database/README.md](database/README.md) para o schema do banco.

## Como rodar

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie um projeto no [Supabase](https://supabase.com), aplique o schema em ordem:

   ```bash
   # via Supabase CLI, ou cole cada schema.sql (e o seed_cid.sql de 08_records) no SQL
   # editor do painel, em ordem numérica das pastas:
   for f in database/*/schema.sql database/08_records/seed_cid.sql; do echo "$f"; done
   ```

   Depois crie alguns usuários de demonstração no painel Auth do Supabase e rode
   `database/99_seed/seed.sql` (leia os comentários no topo do arquivo primeiro).

3. Copie `.env.example` para `.env.local` e preencha com as credenciais do seu projeto
   (Project Settings → API):

   ```bash
   cp .env.example .env.local
   ```

4. Rode o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Abra [http://localhost:3000](http://localhost:3000) — sem sessão ativa, você cai em `/login`.

## Status

Todas as 5 fases do MVP estão implementadas:

- **Fase 1** — login, dashboard por perfil, usuários/papéis/permissões, pacientes
  (cadastro, busca, edição, informações clínicas), profissionais, procedimentos.
- **Fase 2** — agenda (agendar/reagendar/cancelar/confirmar/não compareceu), check-in,
  fila em tempo real (polling), chamadas, transferência entre profissionais, cronômetro
  de atendimento baseado em eventos de banco.
- **Fase 3** — workspace de atendimento (3 colunas), prontuário, CID-10 (busca e seed de
  referência), prescrições com múltiplos medicamentos, emissão de documentos clínicos
  (atestado/declaração/relatório/encaminhamento) a partir de modelos, com pré-visualização
  antes de emitir.
- **Fase 4** — financeiro (receitas/despesas/contas pendentes/recebimentos), registro de
  pagamento com suporte a pagamento parcial, cobrança gerada automaticamente ao finalizar
  um atendimento vinculado a um procedimento com preço.
- **Fase 5** — comunicação desacoplada de provedor (modelos de mensagem, envio manual pelo
  perfil do paciente, histórico de mensagens); trocar o provedor de log por
  WhatsApp/SMS/e-mail reais é implementar uma classe nova em
  `src/services/communication.service.ts`, sem tocar em mais nada.

Depois do MVP, entraram em produção:

- **Pacotes de sessões** — catálogo por especialidade, venda vinculada ao paciente,
  consumo da sessão ao concluir o atendimento e reprocessamento de saldos e do financeiro.
  A cobrança de cada sessão segue o modo de faturamento do pacote (valor de uma vez na
  primeira sessão, ou dividido entre elas).
- **Financeiro gerencial** — filtros combináveis (período, profissional, especialidade,
  avulsa/pacote, forma de pagamento) e modal de detalhe do lançamento, que responde "de
  onde veio este valor": qual atendimento, qual sessão de qual pacote, o que já foi
  recebido e as correções de valor feitas na linha.
- **Triagem** como situação própria de agendamento, que ocupa o horário como qualquer
  outra.
- **Menu de ações por linha** em todas as tabelas (ver `docs/ARCHITECTURE.md` § 8).
- **Varredura de anomalias** — 12 verificações sobre fila, agenda, financeiro, pacotes e
  cadastro.
- **Teleconsulta** (LiveKit) — vídeo e chat presos ao atendimento, sala do paciente por
  link sem login, histórico de chamadas na ficha e consumo de minutos nas configurações.

O fluxo ponta a ponta do item 35 do briefing (cadastrar → agendar → chegada → check-in →
fila → chamada → atendimento com cronômetro → CID → prescrição/atestado → finalizar →
pagamento) está todo implementado. `npm run build` e `npm run lint` estão limpos.

## Ambientes

Dois projetos Supabase: **produção** (`xyibvthdlbhnuwqvwfsj`) e **homologação**
(`hlaqagoxkwqrwaoubhpg`). O deploy é na Vercel (projeto `crm-psi`), a partir de `main`,
servindo <https://csibrasilia.club>.

As migrations de `database/migrations/` são aplicadas **à mão, em ordem numérica**, e
homologação costuma estar à frente da produção. Subir código que depende de uma migration
ainda não aplicada derruba a tela correspondente — já aconteceu com a agenda, quando o
enum `triagem` existia só em homologação. Confira antes de cada subida.

Variáveis de ambiente: ver `.env.example`. As de teleconsulta e pagamento são de nível de
deploy (Vercel › Settings › Environment Variables) e **nunca** levam prefixo
`NEXT_PUBLIC_`. Variável nova só passa a valer no próximo build — depois de salvar,
redeploy.
