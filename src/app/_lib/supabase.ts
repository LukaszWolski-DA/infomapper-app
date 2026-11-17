import "server-only";
// Supabase Auth on Postgres (slice 29, step 3, DB5): the server's client, through `@supabase/ssr` and the request's
// cookies. Only the server talks to Auth: no Supabase client goes to the browser, so no `NEXT_PUBLIC_` variable exists.
// Sessions are checked with `getClaims()`, locally against the project's JWKS (infomapper-dev signs with ES256, L2).

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./supabase-config";

/**
 * The client for a page, a server action or a route handler.
 * - `write: true` (the sign-in and sign-out actions only): the session's cookies are written.
 * - Otherwise nothing is written: the proxy refreshes the session before a page or an action runs, and a thumbnail's
 *   answer must carry no `Set-Cookie` (AD-32, F9).
 */
export async function supabaseServer({ write = false }: { write?: boolean } = {}) {
  const { url, publishableKey } = supabaseConfig();
  const store = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        if (!write) return;
        for (const { name, value, options } of list) store.set(name, value, options);
      },
    },
  });
}
