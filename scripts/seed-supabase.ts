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

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database, ProfileRole } from "../lib/supabase/types";
import { DEFAULT_REGION, getFormularyBundle } from "../lib/formulary";
import { screenDrugLine } from "../lib/screening-engine";
import { seedPatients } from "../lib/data/seed/patients";
import type { Patient, PrescriptionDrugLine } from "../lib/types";

type PrescriptionInsert = Database["public"]["Tables"]["prescriptions"]["Insert"];
type OverrideLogInsert = Database["public"]["Tables"]["override_logs"]["Insert"];

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

// Everything below is real, permanent seed data — not throwaway test/
// verification data. Writing a one-off test account instead? Prefix it
// per the ZZTEST_ convention (see AGENTS.md) so a later cleanup pass is a
// single filtered query instead of manual recognition.

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

// ---------------------------------------------------------------------------
// Phase 2: clinical demo data (patients, prescriptions, override_logs,
// patient_checks). Reuses the same demo scenarios as
// lib/data/seed/{prescriptions,patientChecks}.ts (same drugs, same clinical
// story) and the same screenDrugLine engine, but resolves prescriberId
// against the real seeded Supabase account UUID instead of the old seedUsers
// string id, and generates real UUID primary keys throughout — required
// since patients/prescriptions/patient_checks.id are Postgres uuid columns.
//
// Idempotency: coarse, matching the existing local Dexie bootstrap's own
// convention (lib/data/db.ts) — if any patient already exists in this
// project, the whole clinical block is skipped rather than partially
// re-seeded.
// ---------------------------------------------------------------------------

function screenLine(
  patient: Patient | null,
  line: PrescriptionDrugLine,
  otherLines: PrescriptionDrugLine[],
  formulary: ReturnType<typeof getFormularyBundle>
) {
  return screenDrugLine({ patient, drugLine: line, otherLines, formulary });
}

// Same rule as above: real seed data only. Test patients/prescriptions/
// checks created during verification belong under the ZZTEST_ convention
// (AGENTS.md), not appended here.
async function seedClinicalData(): Promise<void> {
  console.log("\nSeeding clinical demo data...");

  const { count, error: countError } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true });
  if (countError) {
    console.error("  FAILED to check for existing patients:", countError.message);
    return;
  }
  if (count && count > 0) {
    console.log("  Clinical data already seeded — skipping.");
    return;
  }

  const prescriberId = await findExistingUserId("ama.owusu@demo.mediguard.gh");
  if (!prescriberId) {
    console.error("  Skipping clinical data — prescriber account not found (run account seeding first).");
    return;
  }

  const formulary = getFormularyBundle(DEFAULT_REGION);

  // Patients: fresh UUID per row, kept in a map so the scenarios below can
  // still refer to patients by the familiar seedPatients ids.
  const patientId = new Map<string, string>();
  for (const p of seedPatients) {
    const id = randomUUID();
    const { error } = await supabase.from("patients").insert({
      id,
      name: p.name,
      dob: p.dob,
      sex: p.sex,
      phone: p.phone ?? null,
      weight_kg: p.weightKg,
      renal_status: p.renalStatus,
      hepatic_status: p.hepaticStatus,
      allergies: p.allergies,
      active_medications: p.activeMedications,
      is_pregnant: p.isPregnant ?? null,
      owner_id: prescriberId,
    });
    if (error) {
      console.error(`  FAILED to insert patient ${p.name}:`, error.message);
      continue;
    }
    patientId.set(p.id, id);
  }
  console.log(`  ${patientId.size}/${seedPatients.length} patients seeded`);

  const patientByOldId = (oldId: string) => seedPatients.find((p) => p.id === oldId) ?? null;

  // 1. Safe, already dispensed.
  const rx1Lines: PrescriptionDrugLine[] = [
    { id: randomUUID(), drugId: "drug_paracetamol", form: "tablet", strengthMg: 500, route: "oral", doseMg: 500, frequencyPerDay: 3, durationDays: 5 },
  ];
  // 2. Caution (interaction with warfarin), overridden, verified by pharmacist.
  const rx2Lines: PrescriptionDrugLine[] = [
    { id: randomUUID(), drugId: "drug_ciprofloxacin", form: "tablet", strengthMg: 500, route: "oral", doseMg: 500, frequencyPerDay: 2, durationDays: 7 },
  ];
  // 3. Blocked (severe penicillin allergy), overridden, awaiting pharmacist review.
  const rx3Lines: PrescriptionDrugLine[] = [
    { id: randomUUID(), drugId: "drug_amoxicillin", form: "capsule", strengthMg: 500, route: "oral", doseMg: 500, frequencyPerDay: 3, durationDays: 7 },
  ];
  // 4. Safe, awaiting pharmacist review (no overrides), walk-in with an external prescriber.
  const rx4Lines: PrescriptionDrugLine[] = [
    { id: randomUUID(), drugId: "drug_amlodipine", form: "tablet", strengthMg: 5, route: "oral", doseMg: 5, frequencyPerDay: 1, durationDays: 30 },
  ];

  const rx1Id = randomUUID();
  const rx2Id = randomUUID();
  const rx3Id = randomUUID();

  // Non-null assertions: every id here is one just inserted above in the
  // same run (or the whole clinical block was already skipped by the count
  // check), so these are always present.
  const prescriptionRows: PrescriptionInsert[] = [
    {
      id: rx1Id,
      patient_id: patientId.get("patient_kwabena_owusu")!,
      prescriber_id: prescriberId,
      drugs: rx1Lines,
      verdicts: rx1Lines.map((l) => screenLine(patientByOldId("patient_kwabena_owusu"), l, rx1Lines, formulary)),
      status: "dispensed",
      created_at: "2026-06-28T09:15:00.000Z",
      source: "physician",
    },
    {
      id: rx2Id,
      patient_id: patientId.get("patient_kojo_asante")!,
      prescriber_id: prescriberId,
      drugs: rx2Lines,
      verdicts: rx2Lines.map((l) => screenLine(patientByOldId("patient_kojo_asante"), l, rx2Lines, formulary)),
      status: "verified",
      created_at: "2026-06-29T11:40:00.000Z",
      source: "physician",
    },
    {
      id: rx3Id,
      patient_id: patientId.get("patient_abena_sarpong")!,
      prescriber_id: prescriberId,
      drugs: rx3Lines,
      verdicts: rx3Lines.map((l) => screenLine(patientByOldId("patient_abena_sarpong"), l, rx3Lines, formulary)),
      status: "submitted",
      created_at: "2026-07-01T14:05:00.000Z",
      source: "physician",
    },
    {
      id: randomUUID(),
      patient_id: patientId.get("patient_yaw_boadi")!,
      prescriber_id: prescriberId,
      drugs: rx4Lines,
      verdicts: rx4Lines.map((l) => screenLine(patientByOldId("patient_yaw_boadi"), l, rx4Lines, formulary)),
      status: "submitted",
      created_at: "2026-07-02T08:20:00.000Z",
      source: "walk_in",
      external_prescriber_name: "Dr. Nana Yeboah (Ridge Hospital, external)",
    },
  ];

  const { error: rxError } = await supabase.from("prescriptions").insert(prescriptionRows);
  if (rxError) {
    console.error("  FAILED to insert prescriptions:", rxError.message);
  } else {
    console.log(`  ${prescriptionRows.length} prescriptions seeded`);
  }

  const overrideRows: OverrideLogInsert[] = [
    {
      id: randomUUID(),
      prescription_id: rx2Id,
      drug_id: "drug_ciprofloxacin",
      verdict_overridden: "caution",
      reason_code: "verified_with_pharmacist",
      reason_text: "INR to be monitored twice weekly during course; pharmacist counseled patient.",
      user_id: prescriberId,
      timestamp: "2026-06-29T11:42:00.000Z",
    },
    {
      id: randomUUID(),
      prescription_id: rx3Id,
      drug_id: "drug_amoxicillin",
      verdict_overridden: "blocked",
      reason_code: "other",
      reason_text:
        "Re-tested patient's penicillin allergy status with skin test on 2026-06-30, negative. Proceeding under allergist supervision.",
      user_id: prescriberId,
      timestamp: "2026-07-01T14:08:00.000Z",
    },
  ];
  const { error: overrideError } = await supabase.from("override_logs").insert(overrideRows);
  if (overrideError) {
    console.error("  FAILED to insert override logs:", overrideError.message);
  } else {
    console.log(`  ${overrideRows.length} override logs seeded`);
  }

  // 5. A demo Patient Self-Check — an anonymous patient bought Ciprofloxacin
  // over the counter, ran a self-check, and shared the result with a pharmacy.
  const checkProfile = {
    ageYears: 34,
    weightKg: 60,
    allergies: [] as Patient["allergies"],
    activeMedications: [{ drugId: "drug_warfarin", startedAt: "2026-05-01" }],
  };
  const syntheticCheckPatient: Patient = {
    id: "patient_check_anonymous",
    name: "Self-check patient",
    dob: `${new Date().getFullYear() - checkProfile.ageYears}-01-01`,
    sex: "other",
    weightKg: checkProfile.weightKg,
    renalStatus: "unknown",
    hepaticStatus: "unknown",
    allergies: checkProfile.allergies,
    activeMedications: checkProfile.activeMedications,
  };
  const checkLines: PrescriptionDrugLine[] = [
    { id: randomUUID(), drugId: "drug_ciprofloxacin", form: "tablet", strengthMg: 500, route: "oral", doseMg: 500, frequencyPerDay: 2, durationDays: 5 },
  ];
  const { error: checkError } = await supabase.from("patient_checks").insert({
    id: randomUUID(),
    created_at: "2026-07-02T10:00:00.000Z",
    drugs: checkLines,
    profile: checkProfile,
    verdicts: checkLines.map((l) => screenLine(syntheticCheckPatient, l, checkLines, formulary)),
    share_token: randomUUID(),
  });
  if (checkError) {
    console.error("  FAILED to insert patient check:", checkError.message);
  } else {
    console.log("  1 patient self-check seeded");
  }
}

async function main() {
  console.log(`Seeding ${DEMO_ACCOUNTS.length} demo accounts into ${SUPABASE_URL}...`);
  for (const account of DEMO_ACCOUNTS) {
    await seedAccount(account);
  }
  console.log(`\nDone. Password for all demo accounts: "${DEMO_PASSWORD}" (MFA: any 6 digits, simulated).`);

  await seedClinicalData();
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
