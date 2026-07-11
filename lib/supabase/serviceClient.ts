// Service-role Supabase client — bypasses Row Level Security entirely.
// `import "server-only"` makes any accidental import of this file from
// client-bundled code a BUILD ERROR, not just a lint warning: the single
// most important safety property in this migration is that
// SUPABASE_SERVICE_ROLE_KEY can never reach the browser. Only import this
// from Next.js route handlers (app/api/**/route.ts) or standalone
// server-side scripts — never from a "use client" component, a repository
// called from a React Query hook, or anything else that ships to the browser.

import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. The service role key is a " +
      "secret from Project Settings -> API — set it in .env.local for local dev and as a " +
      "server-side environment variable in Vercel for production. Never prefix it with NEXT_PUBLIC_."
  );
}

export const supabaseService = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
