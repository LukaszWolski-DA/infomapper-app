// The Supabase project the server signs people in with (slice 29, Q4): SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, read
// on the server only. A plain module, so the proxy can use it too. Never logged.

export function supabaseConfig(): { url: string; publishableKey: string } {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set on Postgres (slice 29).");
  return { url, publishableKey };
}

/** Supabase's session cookies (`sb-<project>-auth-token`, split into `.0`, `.1` … when long). */
export const isSupabaseAuthCookie = (name: string): boolean => /^sb-.+-auth-token(\.\d+)?$/.test(name);
