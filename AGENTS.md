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

## Migration convention: rewriting an existing RLS policy

`drop policy ... create policy` on a table that already has a policy of that name is not a clean slate — it is a full replacement of every condition the old one enforced, RLS included. Postgres won't warn you if the new `with check`/`using` clause quietly satisfies only your own change's requirement and drops something unrelated a prior migration fixed.

This has happened three times in this project, each time because the migration doing the rewrite was working on something unrelated to the condition it silently dropped:
1. **Pharmacist visibility** — a rogue, never-migration-tracked policy set on `patients`/`prescriptions` re-opened a cross-tenant leak `0004`'s ownership scoping was supposed to close (fixed by `0008`).
2. **Subscription enforcement** — `0006` added an active-subscription requirement to `patients_insert_own`/`prescriptions_insert_own`; `0012`, rewriting the same two policies to add institution scoping, dropped the subscription condition entirely without that being its stated purpose (fixed by `0022`).
3. **Version-chain ownership** — `0017` fixed a shadowing bug in `prescriptions_insert_own`'s `original_prescription_id` check; `0022`, rewriting the same policy again to restore #2's subscription condition, dropped `0017`'s fix in the process (fixed by `0025`).

**Before shipping any migration that does `drop policy` + `create policy` on a table with an existing policy of that name**: read the *current live* policy first (`select pg_get_expr(polwithcheck, polrelid) from pg_policy ...` — not just the most recent migration file, since live state has already been shown to drift from migration text at least once this project independently of this exact issue), list every condition it enforces, and confirm each one that should still apply is explicitly present in the new version — ANDed in, not assumed implicit. If a condition is being deliberately removed, say so in the migration's own comment, the same way every other intentional behavior change in this project's migrations is documented. Don't rely on catching the drop by accident a fourth time.

## Known architectural limitations

Real, deliberately-deferred gaps — each also marked `KNOWN GAP, TRACKED FOLLOW-UP` at its actual code location. Read before assuming a related feature is fully covered.

- **Super Admin's activity feed doesn't surface pharmacist-side inventory actions** (`lib/superadmin/activity.ts`). Dispense activity is now covered (`get_superadmin_dispense_activity`, `0021_superadmin_dispense_activity.sql`, same redacted-at-the-database-layer pattern as prescriptions/overrides — no drug identity, verdict, or override note, just that a dispense happened, to whom, by whom, when, how much). Stock adjustments and other pharmacist actions (`stockAdjustments`, `pharmacistActionRepository`) still live entirely in per-browser Dexie/IndexedDB with no server-side table to query at all, and remain genuinely unreachable from any server-side feed until migrated. Since `0033_independent_physician_self_service.sql`, this equally covers an independent physician's own stock adjustments at `/inventory` (`components/pharmacy/InventoryManager.tsx`, shared unchanged with the pharmacist page) — not just pharmacist-role accounts despite the gap's name.
- **A Patient Self-Check payment that succeeds server-side but whose confirmation the tab never sees still costs the patient a full re-entry of their drug list and profile** (`app/check/new/page.tsx`, `components/patient-check/UnlockCheckStep.tsx`). If the Paystack webhook confirms payment but the tab closes/crashes before the client-side poll observes it, no money is lost — `get_check_quota` correctly reports the unconsumed credit next time the phone is entered — but `create_patient_check_with_quota` (the only place a `patient_checks` row, i.e. the drug list and profile, ever gets written) never ran, so that data is genuinely gone if the patient returns in a fresh tab/session (sessionStorage doesn't survive that). Fixed, and now stronger than the original fix: every patient signs in with their phone (`components/patient-check/SignInStep.tsx`, step 0, mandatory — not an optional "Continuing a check you already paid for?" prompt anymore) before reaching the drug picker, and `app/check/new/page.tsx` does the same `get_check_quota` lookup proactively the moment sign-in completes. A returning patient gets an immediate, reassuring "you have a paid check ready, you won't be charged again" automatically, for free, rather than needing to know an optional prompt exists — and reaching the final step is a single "See my result" click (`components/patient-check/UnlockCheckStep.tsx` now takes an already-verified phone directly; it no longer asks for one). What's NOT fixed, and can't be without persisting drugs/profile server-side mid-attempt (out of scope here): the patient still has to re-pick every drug and re-answer the profile once in the new session — that data itself is unrecoverable, only the anxiety and redundant steps around reaching it are gone.
- **`app/check/new/page.tsx`'s sessionStorage draft-rehydration effect trips the `react-hooks/set-state-in-effect` ESLint rule** (the `useEffect` that resolves `pendingDraftDrugIds` against the loaded formulary and calls `setAddedDrugs`/`setPendingDraftDrugIds` synchronously inside it, around line 131). Confirmed pre-existing — present before the July 2026 UI/UX design pass (verified via `git stash` against commit `d3c395d`) — and left as-is during that pass since it's application logic, not a visual/UX change and outside that pass's mandate. Fixing it properly means restructuring the rehydrate-then-persist handoff between the two adjacent effects (the persist effect immediately below depends on `draftHydrated` flipping only after this one settles), not just silencing the rule.
