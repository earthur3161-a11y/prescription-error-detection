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

- **`dispense_records`/`batches`/`override_logs` have no direct institution_id** (`supabase/migrations/0012_institution_boundary.sql`). The real institution boundary (added in 0012) scopes `patients`/`prescriptions`/`profiles` directly, but these three tables are reachable only indirectly — through `prescription_id`/`patient_id`, which are themselves already institution-scoped (a pharmacist can only load a `dispense_records` row for a prescription they can already see). A direct `institution_id` column on these tables would close that indirection layer but wasn't required to make the boundary itself hold, and is deferred rather than done blind. `override_logs` now also has a direct RLS SELECT policy built on that same indirection (`override_logs_select_institution_staff`, `0019_reporting_module.sql`, admin/pharmacist only) — added because the original owner-only policy (`user_id = auth.uid()`) was silently hiding an institution's own override history from its own admin/pharmacist staff; `dispense_records`/`batches` still have no equivalent policy and remain reachable only through the app's own queries, not a general RLS grant.
- **`/admin/compliance`'s audit stream shows every patient self-check system-wide, not just this institution's** (`lib/query/hooks/useAuditEvents.ts`, `patient_checks_select_authenticated` in `supabase/migrations/0002_phase2_clinical_data.sql`). Self-checks have no institution_id at all by original design (Patient Self-Check is the sole no-institution exception), and the `using (true)` SELECT policy is broad on purpose — a patient can walk into any facility with a QR/share-token result, so any staff member must be able to look one up. The reporting module (item 6, `0019_reporting_module.sql`) deliberately excludes self-checks entirely until pulled into a real prescription, which sidesteps this for aggregate KPIs, but `/admin/compliance`'s per-event stream still surfaces every institution's self-check activity mixed into any admin's feed. Noticed while auditing the reporting module's scoping; not fixed here since the right fix (exclude un-pulled self-checks from the compliance stream, matching the reporting module's own rule) is a visible behavior change to an already-shipped page, deferred for its own sign-off rather than folded in silently.
- **Super Admin's activity feed doesn't surface dispense activity or pharmacist-side inventory actions** (`lib/superadmin/activity.ts`). `dispense_records`/`batches` moved to Supabase in `0010_pharmacy_dispense_gate.sql`, but the feed was never extended to query them (small addition when needed). Stock adjustments and other pharmacist actions (`stockAdjustments`, `pharmacistActionRepository`) still live entirely in per-browser Dexie/IndexedDB and remain genuinely unreachable from any server-side feed until migrated.
- **A Patient Self-Check payment that succeeds server-side but whose confirmation the tab never sees still costs the patient a full re-entry** (`app/check/new/page.tsx`, `components/patient-check/UnlockCheckStep.tsx`). If the Paystack webhook confirms payment but the browser tab closes/crashes before the client-side poll observes `status: "success"` and calls `handleUnlocked`, no money is lost — the paid credit sits unconsumed in `check_payments` and `get_check_quota` correctly surfaces it next time the same phone number is entered — but `create_patient_check_with_quota` (the only place `patient_checks` rows, i.e. the drug list and profile, ever get written) never ran, so the patient must re-pick every drug and re-answer the profile from scratch despite having already paid. The sessionStorage draft (added alongside this note) covers refresh/close-reopen data loss in general, but doesn't solve this specific case on its own, since the patient may return in a fresh tab/session where sessionStorage is gone too. A real fix would mean proactively checking for an unconsumed paid credit on page load (not just when quota is looked up after phone entry) — a bigger change than client-side persistence, deliberately deferred to its own pass rather than folded into this one.
