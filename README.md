# MediGuard

A clinical decision-support app that screens prescriptions in real time for
Ghana's healthcare context — allergy conflicts, drug-drug interactions,
duplicate therapy, dosing errors, and Ghana Essential Medicines List (EML)
compliance — returning Safe / Caution / Blocked verdicts with mandatory
logged overrides.

This is a frontend-only demo: there is no real backend. All data lives in
IndexedDB (via Dexie) in your browser, seeded on first load. Authentication
is a mock role-switcher — there is no real login server.

## Running it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- `npx vitest run` — unit tests for the screening engine (the one piece of
  this app where a bug is a patient-safety bug).
- `npm run build` — production build / route compilation check.

## Information architecture

- `/` — public landing page. **Check Your Medicine** (patient self-check) is
  the primary, unauthenticated entry point everyone sees first, alongside a
  "How We Operate" section outlining the screening process. A "Health
  Professionals" tab in the header (not the page body) links to `/login`,
  the portal chooser for the three role logins.
- `/check/*` — the patient self-check flow. No login. Plain-language
  results. Always routes Caution/Blocked to "talk to a pharmacist or
  doctor," never "stop" or "ignore."
- **Separate professional login portals**, each with role-appropriate framing
  and distinct iconography:
  - `/physician/login`, `/pharmacy/login`, `/admin/login`
  - `/login` is a lightweight portal chooser linking to the three.
  - `/superadmin/login` is the internal MediGuard Operations sign-in.
- `(app)/*` — the authenticated professional workspace (dashboards,
  prescribing, verification queue, admin tools), organized by role in
  `components/layout/Sidebar.tsx`. Gated by `RoleGuard` to the three clinical
  roles — unauthenticated visitors and the super-admin never see it.
- `/widget/screen` — an embeddable screening widget for institution
  integrations (`postMessage`-based), independent of the main app shell.

## Accounts & access (no demo shortcuts)

There are **no shared/quick-login demo buttons**. Sign-in requires a real,
provisioned account (email + password + a simulated 6-digit MFA code), and the
portal enforces the account's role **in the data layer** (`accountRepository.authenticate`)
— a pharmacy account cannot sign in through `/physician/login` even by visiting
the URL directly. Failed logins return a single generic "Invalid login" that
never reveals whether an account exists.

Getting an account:

1. **Request Access** (`/request-access`) — collects name, role, institution,
   license/registration (physician & pharmacy) or proof of authority (admin),
   email, and phone. Submissions land in a review queue; the requester can
   re-check status ("under review" / approved / rejected).
2. **MediGuard Super Admin** (`/superadmin`) — an internal operator (distinct
   from Facility Admin) reviews requests and approves or rejects them.
   Approval provisions an account and issues a **one-time invite link** (shown
   in-app, simulating a secure invite email — no plaintext password is ever
   generated or sent).
3. **Activate** (`/activate/[token]`) — the requester sets their own password
   via the invite link, which activates the account.

**Dev/staging accounts** are seeded only when `DEV_ACCOUNTS_ENABLED`
(`NODE_ENV !== "production"`, or `NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS=true`), so
they never ship in a production build. In `npm run dev` the seeded logins are
printed to the browser console. They are (shared password `MediGuard!24`, any
6-digit code for MFA):

| Portal | Email |
| --- | --- |
| Physician | `ama.owusu@demo.mediguard.gh` |
| Pharmacy | `kwame.mensah@demo.mediguard.gh` |
| Facility Admin | `efua.boateng@demo.mediguard.gh` |
| Super Admin | `root@demo.mediguard.gh` |

Password hashing (`lib/auth/password.ts`) is a demo-grade one-way hash, not
production cryptography — a real deployment must use a server-side salted KDF.

## Shared screening engine

All three surfaces — Patient Check, Pharmacist, Facility Admin — run the
exact same engine (`lib/screening-engine/orchestrator.ts`), with only the
presentation layer varying: every `Flag` carries an `audience_variant`
(`patient` vs `clinical` text) generated together by `buildFlag()`, so the
underlying rule can never drift between what a patient sees and what a
clinician sees. The six checks run identically everywhere:

1. Allergy conflicts (`checks/allergyCheck.ts`)
2. Drug-drug interactions (`checks/interactionCheck.ts`)
3. Duplicate therapy (`checks/duplicateTherapyCheck.ts`)
4. Dose range / weight-based dosing (`checks/doseRangeCheck.ts`)
5. Ghana Essential Medicines List compliance (`checks/emlCheck.ts`)
6. Data completeness (`checks/dataCompletenessCheck.ts` — guards against
   missing patient data ever silently resolving to "safe")

A verdict can only be "safe" when every check ran against complete data and
found nothing (`lib/screening-engine/severity.ts`).

## Medicines database

The formulary is a **comprehensive drug list**, not just the Essential
Medicines List. EML membership is a per-record flag (`onEssentialMedicinesList`
— the spec's `is_on_eml`), not the boundary of the dataset: non-EML drugs are
present and fully searchable, just tagged, and a non-EML drug surfaces a
Caution flag plus its EML-listed alternative where one is on file.

Drug search across every surface (Patient Check, Pharmacist, Admin) queries the
same full database, with EML shown as a badge rather than used as a filter that
hides non-EML results.

- Core list: `lib/formulary/ghana/drugs.ts` + `drugsExtended.ts`, de-duplicated
  by generic name at merge time (`dedupeByGenericName`) so no drug can appear
  twice under different IDs.
- **Bulk import**: `/admin/formulary/import` accepts a CSV (e.g. a Ghana FDA
  registered-products export), validates and de-duplicates by generic name, and
  shows a review-before-publish preview (`lib/formulary/csvImport.ts`).

> **Sourcing caveat:** the built-in list is an *illustrative* demo set using
> widely-established generics and standard reference dosing — it is **not** the
> authoritative Ghana FDA database. A verified, comprehensive dataset still
> needs to be sourced and loaded via the CSV importer, and dosing must be
> clinician-verified before real-world use. Claude does not fabricate
> authoritative drug/dosing data.

## Three independent products, not one shared workflow

MediGuard is three separately-subscribing offerings, each with its own
isolated data (enforced at the database layer via Row Level Security, not
just in the UI):

- **Physician Portal** — an independent physician's own patients and
  prescriptions (`prescriptions.prescriber_id = auth.uid()`), screened the
  moment they're written.
- **Pharmacy Portal** — an independent pharmacy verifying drugs before
  dispensing, on its own account.
- **Facility Admin** — a clinical institution that integrates MediGuard into
  *its own* prescribing/dispensing system via the API (`/api/v1/screen`,
  CDS Hooks), rather than using MediGuard's own screens directly.

There is no internal Physician → Facility Admin checkpoint → Pharmacist
queue anymore — that shared pipeline (and the co-sign/clinical-alert
machinery around it) has been removed. An institution that wants
prescriptions checked before dispensing does so by calling the API, not by
routing staff through a shared internal queue.

## Error reporting, at each tier

- **Patient** (`/check/result/[id]`) — a "Something seem wrong? Tell us"
  report action, plus their own check history at `/check/history`. Feeds
  MediGuard's own quality review, not clinical governance.
- **Pharmacist** (`/pharmacist/error-log`) — their own flag-back history and
  the overrides they logged while entering walk-in / pulled-up
  prescriptions themselves.
- **Facility Admin** (`/admin/audit-log`) — the full append-only override
  audit trail, EML compliance rate, most common flag types, most-overridden
  drugs, and patient-reported issues, exportable as CSV.
