/**
 * The bundler replaces `process.env.NEXT_PUBLIC_*` at build time ONLY when it is written
 * as a static literal. A computed read — `process.env[name]` — is left untouched, and in
 * the browser `process.env` is an empty object, so it resolves to undefined.
 *
 * That is why the two browser-facing values are spelled out here instead of going through
 * `readEnv`. Reading them dynamically made `lib/supabase/client.ts` throw
 * "Missing NEXT_PUBLIC_SUPABASE_URL" on every client component that created a browser
 * client — invisible for as long as nothing did, then a hard crash on hydration the moment
 * the password-recovery screen started using it.
 */
const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUBLIC_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function required(value: string | undefined, name: string): string {
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
    url: Boolean(PUBLIC_URL),
    anonKey: Boolean(PUBLIC_ANON_KEY),
    // Server-only, and never inlined into the browser bundle: on the client this is
    // always false, which is correct — the browser has no business holding it.
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  }
}

/** True when the browser-facing pair is present — the minimum for auth to work. */
export function isSupabaseConfigured() {
  return Boolean(PUBLIC_URL && PUBLIC_ANON_KEY)
}

// Values are only read (and can only throw) when a client is actually created,
// never at module-import time — so the app still builds/boots without Supabase configured.
export const supabaseEnv = {
  get url() {
    return required(PUBLIC_URL, "NEXT_PUBLIC_SUPABASE_URL")
  },
  get anonKey() {
    return required(PUBLIC_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY")
  },
  get serviceRoleKey() {
    return required(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY")
  },
}
