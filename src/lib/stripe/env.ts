/**
 * Credenciais do Stripe.
 *
 * Ficam em variáveis de ambiente, e não em `clinic_settings` como o n8n e o WAHA. Aqueles
 * apontam para servidores da própria clínica, que mudam de endereço e são configurados por
 * quem opera o sistema; a chave secreta do Stripe move dinheiro de verdade e pertence ao
 * mesmo nível da service role key do Supabase — quem tem acesso ao painel de deploy, não
 * quem tem acesso a uma tela. O que fica em `clinic_settings` é só o que não é segredo:
 * se está ligado e em que moeda cobrar.
 *
 * A chave publicável é lida como literal estático de propósito. `process.env[nome]` NÃO é
 * substituído pelo bundler, e o valor chegaria undefined no navegador — foi exatamente esse
 * o defeito que derrubou a tela de redefinição de senha.
 */
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing ${name}. Configure as credenciais do Stripe no ambiente.`)
  }
  return value
}

/** Presença, nunca valores — pode ser exposto pelo /api/health. */
export function stripeEnvStatus() {
  return {
    publishableKey: Boolean(PUBLISHABLE_KEY),
    secretKey: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  }
}

/** Mínimo para cobrar: chave secreta. O webhook exige o seu próprio segredo, à parte. */
export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/** Chaves `sk_test_`/`pk_test_` são do ambiente de testes; o resto é dinheiro real. */
export function isStripeTestMode() {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")
}

// Lidas só quando alguém realmente vai chamar o Stripe, nunca na importação — assim o app
// continua subindo sem nenhuma credencial configurada.
export const stripeEnv = {
  get publishableKey() {
    return required(PUBLISHABLE_KEY, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
  },
  get secretKey() {
    return required(process.env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY")
  },
  get webhookSecret() {
    return required(process.env.STRIPE_WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET")
  },
}
