<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Test / verification data convention

Any account, patient, request, or institution created for manual testing or automated verification (i.e. not real seed data from `scripts/seed-supabase.ts`) must be marked so a later cleanup pass is a single filtered query, not manual recognition:

- **Names** (`profiles.name`, `patients.name`, `access_requests.full_name`, `institutions.name`): prefix with `ZZTEST_` — e.g. `ZZTEST_Verify Flow Patient`.
- **Emails**: `zztest_<flow>-<timestamp>@mediguard.test`.
- **Phone numbers** (self-check/patient-check flows only — no free-text field to prefix): use the reserved block `+233 24 400 0XXX`.

Cleanup query set:

```sql
select * from profiles where name like 'ZZTEST_%';
select * from patients where name like 'ZZTEST_%';
select * from access_requests where full_name like 'ZZTEST_%';
select * from institutions where name like 'ZZTEST_%';
select * from self_check_accounts where phone like '+233244000%';
```

## Known architectural limitations

Real, deliberately-deferred gaps — each also marked `KNOWN GAP, TRACKED FOLLOW-UP` at its actual code location. Read before assuming a related feature is fully covered.

- **`dispense_records`/`batches`/`override_logs` have no direct institution_id** (`supabase/migrations/0012_institution_boundary.sql`). The real institution boundary (added in 0012) scopes `patients`/`prescriptions`/`profiles` directly, but these three tables are reachable only indirectly — through `prescription_id`/`patient_id`, which are themselves already institution-scoped (a pharmacist can only load a `dispense_records` row for a prescription they can already see). A direct `institution_id` column on these tables would close that indirection layer but wasn't required to make the boundary itself hold, and is deferred rather than done blind.
- **Allergy screening silently skips unrecognized allergens** (`lib/screening-engine/checks/allergyCheck.ts`). A patient-reported allergen with no matching `AllergyRule` (i.e. not one of the curated categories in `allergyRules.ts` — Penicillin, NSAIDs/Aspirin, Sulfa drugs, Fluoroquinolones, Cephalosporins, Macrolides) is unscreened with no "not recognized, verify manually" fallback flag. Missing/sparse *reference* data, not the null-vs-normal unknown-patient-data pattern already fixed elsewhere in the engine — worth its own fallback flag eventually.
- **Super Admin's activity feed doesn't surface dispense activity or pharmacist-side inventory actions** (`lib/superadmin/activity.ts`). `dispense_records`/`batches` moved to Supabase in `0010_pharmacy_dispense_gate.sql`, but the feed was never extended to query them (small addition when needed). Stock adjustments and other pharmacist actions (`stockAdjustments`, `pharmacistActionRepository`) still live entirely in per-browser Dexie/IndexedDB and remain genuinely unreachable from any server-side feed until migrated.
