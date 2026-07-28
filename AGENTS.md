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

- **Super Admin's activity feed doesn't surface dispense activity or pharmacist-side inventory actions** (`lib/superadmin/activity.ts`). `dispense_records`/`batches` moved to Supabase in `0010_pharmacy_dispense_gate.sql`, but the feed was never extended to query them (small addition when needed). Stock adjustments and other pharmacist actions (`stockAdjustments`, `pharmacistActionRepository`) still live entirely in per-browser Dexie/IndexedDB and remain genuinely unreachable from any server-side feed until migrated.
- **A Patient Self-Check payment that succeeds server-side but whose confirmation the tab never sees still costs the patient a full re-entry** (`app/check/new/page.tsx`, `components/patient-check/UnlockCheckStep.tsx`). If the Paystack webhook confirms payment but the browser tab closes/crashes before the client-side poll observes `status: "success"` and calls `handleUnlocked`, no money is lost — the paid credit sits unconsumed in `check_payments` and `get_check_quota` correctly surfaces it next time the same phone number is entered — but `create_patient_check_with_quota` (the only place `patient_checks` rows, i.e. the drug list and profile, ever get written) never ran, so the patient must re-pick every drug and re-answer the profile from scratch despite having already paid. The sessionStorage draft (added alongside this note) covers refresh/close-reopen data loss in general, but doesn't solve this specific case on its own, since the patient may return in a fresh tab/session where sessionStorage is gone too. A real fix would mean proactively checking for an unconsumed paid credit on page load (not just when quota is looked up after phone entry) — a bigger change than client-side persistence, deliberately deferred to its own pass rather than folded into this one.
