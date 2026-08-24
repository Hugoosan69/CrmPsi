function readEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill in your Supabase project credentials.`
    )
  }
  return value
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
