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
- **A Patient Self-Check payment that succeeds server-side but whose confirmation the tab never sees still costs the patient a full re-entry of their drug list and profile** (`app/check/new/page.tsx`, `components/patient-check/UnlockCheckStep.tsx`, `components/patient-check/ResumeCheckPrompt.tsx`). If the Paystack webhook confirms payment but the tab closes/crashes before the client-side poll observes it, no money is lost — `get_check_quota` correctly reports the unconsumed credit next time the phone is entered — but `create_patient_check_with_quota` (the only place a `patient_checks` row, i.e. the drug list and profile, ever gets written) never ran, so that data is genuinely gone if the patient returns in a fresh tab/session (sessionStorage doesn't survive that). Fixed: an optional "Continuing a check you already paid for?" prompt now sits at the top of the flow (step 1, not just step 3), doing the same `get_check_quota` lookup proactively — a returning patient gets an immediate, reassuring "you have a paid check ready, you won't be charged again" instead of learning that only after redoing both screens, and reaching step 3 becomes a single "See my result" click (phone + OTP + payment-decision skipped, all already confirmed). What's NOT fixed, and can't be without persisting drugs/profile server-side mid-attempt (out of scope here): the patient still has to re-pick every drug and re-answer the profile once in the new session — that data itself is unrecoverable, only the anxiety and redundant steps around reaching it are gone.
