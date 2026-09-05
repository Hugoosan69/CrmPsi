# Correções de dados

Scripts que arrumam dados já gravados, não o schema. Ficam separados de `migrations/`
porque são de uma vez só, dependem do estado real do banco naquele momento e — ao
contrário de uma migration — envolvem inferência sobre o que a clínica quis dizer.

Rode **depois** das migrations e leia o cabeçalho de cada arquivo antes: eles dizem o que
é fato e o que é palpite.

| Script | O que faz |
|---|---|
| `2026-09-05_converte_lancamentos_de_1_real.sql` | Converte os lançamentos de R$ 1,00 ou menos (o marcador que a clínica usava para sessão de pacote antes do módulo existir) em pacotes retroativos e sessões consumidas. Mantém o lançamento **pago**, zera o valor e renomeia para "Sessão de pacote — X" |

## Subindo para produção

Ordem, com o app já em manutenção ou fora do horário de atendimento:

```sql
-- 1. Schema. 013 e 014 já estão aplicadas em produção (foram reconstruídas a partir
--    dela); são idempotentes, mas rodar é desnecessário. As que faltam:
migrations/015_session_packages.sql
migrations/016_fix_package_session_trigger.sql
migrations/017_professional_own_financial.sql
migrations/018_unique_package_session_number.sql
migrations/019_amount_edit_and_package_billing.sql

-- 2. Correção dos lançamentos de R$ 1,00
data-fixes/2026-09-05_converte_lancamentos_de_1_real.sql
```

Depois, revise em **Gestão → Pacotes**: os pacotes retroativos nascem inativos, com o
número de sessões inferido a partir de quantos lançamentos cada paciente tinha. O tamanho
real de cada pacote vendido só a clínica sabe — a tela permite corrigir nome, sessões e
valor, e a ficha de cada paciente mostra como ficou.

Conferência rápida depois de rodar:

```sql
-- deve devolver 0: nenhum lançamento de R$1 sem sessão de pacote vinculada
select count(*)
from financial_transactions ft
join appointments a on a.id = ft.appointment_id
where ft.amount <= 1
  and ft.status <> 'cancelado'
  and not exists (select 1 from patient_package_sessions pps where pps.appointment_id = ft.appointment_id);
```
