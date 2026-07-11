// Browser Supabase client — anon key only, every read/write it makes is
// governed by Row Level Security (see supabase/migrations/0001_phase1_auth.sql).
// This is the ONLY Supabase client that repository/hook code running in the
// browser should ever import. For privileged operations (service role), see
// lib/supabase/serviceClient.ts, which is server-only and cannot be imported
// here or into any client component.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to " +
      ".env.local and fill in your Supabase project's values (Project Settings -> API)."
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
