function readEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill in your Supabase project credentials.`
    )
  }
  return value
}

/**
 * Non-throwing check, for code that must keep working when the deployment is
 * misconfigured (the proxy, the health endpoint). Reports only whether each variable is
 * present — never the values, so it is safe to expose.
 */
export function supabaseEnvStatus() {
  return {
    url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  }
}

/** True when the browser-facing pair is present — the minimum for auth to work. */
export function isSupabaseConfigured() {
  const s = supabaseEnvStatus()
  return s.url && s.anonKey
}

// Values are only read (and can only throw) when a client is actually created,
// never at module-import time — so the app still builds/boots without Supabase configured.
export const supabaseEnv = {
  get url() {
    return readEnv("NEXT_PUBLIC_SUPABASE_URL")
  },
  get anonKey() {
    return readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  },
  get serviceRoleKey() {
    return readEnv("SUPABASE_SERVICE_ROLE_KEY")
  },
}
