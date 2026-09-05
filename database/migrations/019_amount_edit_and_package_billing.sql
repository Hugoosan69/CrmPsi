-- ============================================================================
-- 019 — Correção de valor lançado + como o pacote entra no financeiro.
--
-- 1. `financial.edit_amount`
--    Corrigir o valor de um lançamento é diferente de registrar um pagamento: mexe no que
--    já foi contabilizado. Fica em permissão própria (e não dentro de financial.manage)
--    para a clínica poder dar "registra recebimento" a alguém sem dar "reescreve o valor
--    do que já entrou". Toda edição grava audit_log com o valor anterior — é o que
--    permite responder depois "quem mudou isso, de quanto para quanto".
--
-- 2. `session_packages.billing_mode`
--    Como o dinheiro do pacote aparece no financeiro:
--      'unico'      — o valor entra uma vez (na venda); cada sessão usada entra a R$ 0.
--                     É o comportamento atual, e segue como padrão.
--      'por_sessao' — cada sessão lançada carrega o valor por sessão (total ÷ nº sessões).
--                     Serve para quem quer ver a receita diluída ao longo do tratamento.
--    Parametrizado no pacote, e não fixo no código, porque a regra é decisão da clínica e
--    pode variar entre um pacote e outro.
--
-- Apply against a database that already has migrations/001 .. 018.
-- ============================================================================

insert into permissions (slug, module, description) values
  ('financial.edit_amount', 'financial', 'Corrigir o valor de um lançamento já registrado')
on conflict (slug) do nothing;

-- Concedida a quem já administra o financeiro — ninguém perde acesso ao aplicar, e quem
-- não deve ter fica de fora por exceção individual (user_permission_overrides).
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where p.slug = 'financial.edit_amount'
  and exists (
    select 1 from role_permissions rp
    join permissions sp on sp.id = rp.permission_id
    where rp.role_id = r.id and sp.slug = 'financial.manage'
  )
on conflict do nothing;

alter table session_packages
  add column if not exists billing_mode text not null default 'unico';

do $$ begin
  alter table session_packages
    add constraint session_packages_billing_mode_check
    check (billing_mode in ('unico', 'por_sessao'));
exception when duplicate_object then null;
end $$;

comment on column session_packages.billing_mode is
  'unico = valor total lançado uma vez, na venda (sessões entram a R$ 0). por_sessao = cada sessão lança o valor por sessão.';
