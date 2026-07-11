// Provisions the demo accounts (physician / pharmacy / admin / superadmin)
// directly in Supabase Auth, for local dev and manual testing of the Phase 1
// migration. Standalone script, never bundled into the Next.js app — it
// uses the service-role key, which must never reach the browser.
//
// Run:
//   npm run seed:supabase
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// .env.local (the service role key is on the Supabase Dashboard, under
// Project Settings -> API — never commit it).
//
// Safe to re-run: accounts that already exist are left in place (with their
// role re-synced to app_metadata, in case it was ever hand-edited).

import { createClient } from "@supabase/supabase-js";
import type { ProfileRole } from "../lib/supabase/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run this via `npm run seed:supabase`, with both set in .env.local."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = "MediGuard!24";

interface DemoAccount {
  email: string;
  role: ProfileRole;
  name: string;
  title: string;
  institution?: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "ama.owusu@demo.mediguard.gh",
    role: "prescriber",
    name: "Dr. Ama Owusu",
    title: "Physician",
    institution: "Korle Bu Teaching Hospital",
  },
  {
    email: "kwame.mensah@demo.mediguard.gh",
    role: "pharmacist",
    name: "Kwame Mensah",
    title: "Pharmacist",
    institution: "Korle Bu Teaching Hospital",
  },
  {
    email: "efua.boateng@demo.mediguard.gh",
    role: "admin",
    name: "Efua Boateng",
    title: "Facility Admin",
    institution: "Korle Bu Teaching Hospital",
  },
  {
    email: "root@demo.mediguard.gh",
    role: "superadmin",
    name: "MediGuard Super Admin",
    title: "MediGuard Operations",
  },
];

async function findExistingUserId(email: string): Promise<string | null> {
  // admin.listUsers doesn't filter by email server-side, so page through and
  // match locally — fine at this account volume (four accounts).
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) return null;
    page++;
  }
}

async function seedAccount(account: DemoAccount): Promise<void> {
  const existingId = await findExistingUserId(account.email);
  let userId = existingId;

  if (!existingId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      app_metadata: { role: account.role },
      user_metadata: { name: account.name },
    });
    if (error || !data.user) {
      console.error(`  FAILED to create ${account.email}:`, error?.message);
      return;
    }
    userId = data.user.id;
    console.log(`  created ${account.email} (${account.role})`);
  } else {
    await supabase.auth.admin.updateUserById(existingId, {
      app_metadata: { role: account.role },
    });
    console.log(`  already exists: ${account.email} (role re-synced)`);
  }

  if (!userId) return;

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    role: account.role,
    name: account.name,
    title: account.title,
    status: "active",
    institution: account.institution ?? null,
  });
  if (profileError) {
    console.error(`  FAILED to upsert profile for ${account.email}:`, profileError.message);
  }
}

async function main() {
  console.log(`Seeding ${DEMO_ACCOUNTS.length} demo accounts into ${SUPABASE_URL}...`);
  for (const account of DEMO_ACCOUNTS) {
    await seedAccount(account);
  }
  console.log(`\nDone. Password for all demo accounts: "${DEMO_PASSWORD}" (MFA: any 6 digits, simulated).`);
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
