// Server-side screening service shared by the REST endpoint (/api/v1/screen)
// and the CDS Hooks endpoint (/cds-services/mediguard-screen).
//
// The screening engine and formulary are pure, framework-agnostic modules with
// no browser/IndexedDB dependency, so the exact same `screenDrugLine` that runs
// in the app also runs here on the server — one screening core, three
// operations, now including live machine-to-machine integration (Operation 3).

import { z } from "zod";
import { DEFAULT_REGION, getBaseFormularyBundle } from "../formulary";
import { mergeCustomDrugs } from "../formulary/mergeCustomDrugs";
import { screenDrugLine } from "../screening-engine";
import { hashApiKey } from "./apiKeys";
import { supabaseService } from "../supabase/serviceClient";
import type { DrugLineVerdict } from "../screening-engine/types";
import type { EnforcementLevel } from "../types";
import type {
  ActiveMedication,
  AllergyRecord,
  Drug,
  FormularyBundle,
  Patient,
  PrescriptionDrugLine,
  Route,
} from "../types";

const VALID_ROUTES: Route[] = ["oral", "IV", "IM", "topical", "inhaled", "rectal", "sublingual", "subcutaneous"];

const allergySchema = z.object({
  allergen: z.string().min(1),
  severity: z.enum(["mild", "moderate", "severe"]).default("moderate"),
  reaction: z.string().optional(),
});

const activeMedSchema = z.object({
  drugId: z.string().min(1),
  startedAt: z.string().optional(),
});

export const patientSchema = z
  .object({
    dob: z.string().optional(),
    sex: z.enum(["male", "female", "other"]).optional(),
    weightKg: z.number().nullable().optional(),
    renalStatus: z.enum(["normal", "impaired", "unknown"]).optional(),
    hepaticStatus: z.enum(["normal", "impaired", "unknown"]).optional(),
    isPregnant: z.boolean().nullable().optional(),
    allergies: z.array(allergySchema).nullable().optional(),
    activeMedications: z.array(activeMedSchema).nullable().optional(),
    /** Feeds checkIndication (lib/screening-engine/checks/indicationCheck.ts) — omitted/empty is "not reported," never treated as "confirmed no condition." Values outside PATIENT_CONDITIONS just won't match any drug class and no-op, same as an unmapped condition from the app's own UI. */
    reportedConditions: z.array(z.string()).nullable().optional(),
  })
  .nullable();

export const drugSchema = z.object({
  drugId: z.string().min(1),
  doseMg: z.number().nonnegative(),
  frequencyPerDay: z.number().nonnegative(),
  durationDays: z.number().nonnegative().optional().default(0),
  route: z.string().optional().default("oral"),
  strengthMg: z.number().optional(),
  form: z.string().optional(),
});

export const screenRequestSchema = z.object({
  patient: patientSchema,
  drug: drugSchema,
  /** Other lines on the same prescription, so interaction/duplicate/cumulative-dose checks are complete. */
  otherDrugs: z.array(drugSchema).optional().default([]),
});

export type ScreenRequest = z.infer<typeof screenRequestSchema>;
type DrugInput = z.infer<typeof drugSchema>;
type PatientInput = z.infer<typeof patientSchema>;

let lineCounter = 0;
function nextLineId(): string {
  lineCounter += 1;
  return `api_line_${Date.now()}_${lineCounter}`;
}

function toRoute(route: string): Route {
  return (VALID_ROUTES as string[]).includes(route) ? (route as Route) : "oral";
}

function toDrugLine(drug: DrugInput): PrescriptionDrugLine {
  return {
    id: nextLineId(),
    drugId: drug.drugId,
    form: drug.form ?? "tablet",
    strengthMg: drug.strengthMg ?? drug.doseMg,
    route: toRoute(drug.route),
    doseMg: drug.doseMg,
    frequencyPerDay: drug.frequencyPerDay,
    durationDays: drug.durationDays,
  };
}

function toPatient(input: PatientInput): Patient | null {
  if (input == null) return null;
  // A field that is omitted (undefined) is treated as null = "not on file",
  // preserving the unknown-vs-confirmed-none safety semantics: undefined never
  // silently becomes "confirmed none".
  const allergies: AllergyRecord[] | null =
    input.allergies == null ? null : input.allergies.map((a) => ({ ...a }));
  const activeMedications: ActiveMedication[] | null =
    input.activeMedications == null
      ? null
      : input.activeMedications.map((m) => ({
          drugId: m.drugId,
          startedAt: m.startedAt ?? new Date().toISOString(),
        }));
  // dob has no nullable representation of its own (every real Patient always
  // has one) — an omitted dob is flagged via ageYearsUnknown instead, same
  // mechanism as the Patient Self-Check flow. The placeholder date below is
  // never meant to be interpreted as real when that flag is set; every
  // age-dependent check looks at ageYearsUnknown before ever reading dob.
  const ageYearsUnknown = input.dob == null;
  return {
    id: "api_patient",
    name: "API Patient",
    dob: input.dob ?? "1970-01-01",
    ageYearsUnknown,
    sex: input.sex ?? "other",
    weightKg: input.weightKg ?? null,
    renalStatus: input.renalStatus ?? "unknown",
    hepaticStatus: input.hepaticStatus ?? "unknown",
    isPregnant: input.isPregnant ?? null,
    allergies,
    activeMedications,
    reportedConditions: input.reportedConditions ?? undefined,
  };
}

export interface ScreenResult {
  verdict: DrugLineVerdict;
  drugName: string;
}

/**
 * Runs the real screening engine over a validated request. Returns null when
 * the drugId isn't in the formulary. `extraDrugs` layers admin-added custom
 * drugs (0026_custom_drugs.sql) on top of the static base set — optional and
 * defaulted to none so every existing caller/test is unaffected; a caller
 * that cares fetches them once via getCustomDrugs() and passes them in,
 * rather than this function doing its own Postgres round-trip per call.
 */
export function runScreen(request: ScreenRequest, extraDrugs: Drug[] = []): ScreenResult | null {
  const formulary = mergeCustomDrugs(getBaseFormularyBundle(DEFAULT_REGION), extraDrugs);
  const drug = formulary.drugs.find((d) => d.id === request.drug.drugId);
  if (!drug) return null;

  const mainLine = toDrugLine(request.drug);
  const otherLines = request.otherDrugs.map(toDrugLine);
  const allLines = [mainLine, ...otherLines];
  const patient = toPatient(request.patient);

  const verdict = screenDrugLine({
    patient,
    drugLine: mainLine,
    otherLines: allLines,
    formulary,
  });
  return { verdict, drugName: drug.generic_name };
}

// --- API-key authentication (real) ---
//
// Looks up the presented Bearer token by its sha256 hash against
// institution_api_keys, then confirms the owning institution is active.
// Replaces the old demo-grade check (a global MEDIGUARD_API_KEYS env-var
// allowlist, with a fallback regex that accepted almost any well-formed
// mg_live_/mg_sandbox_-shaped string) — this is the actual "make it real"
// step: a garbage or revoked key is now genuinely rejected, and a caller is
// now resolved to a real institution identity, not just a live/sandbox mode.

export interface AuthResult {
  ok: boolean;
  institutionId?: string;
  institutionName?: string;
  mode?: "live" | "sandbox";
  enforcementLevel?: EnforcementLevel;
  /** Set (with ok: false) specifically when the key is valid but over its rate limit — distinguishes a 429 from a plain 401. */
  rateLimited?: boolean;
  retryAfterSeconds?: number;
  windowResetAt?: string;
}

// Per API key, not per institution — matches how this function already
// resolves identity (one row per key), and keeps sandbox/live and multiple
// keys on the same institution independently throttled. Confirmed with the
// user: institution API rate limiting was entirely absent before this
// (0018_institution_api_rate_limiting.sql).
const RATE_LIMIT_PER_MINUTE: Record<"live" | "sandbox", number> = {
  live: 120,
  sandbox: 30,
};

export async function authorizeApiKey(request: Request): Promise<AuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false };
  const key = match[1].trim();
  const keyHash = hashApiKey(key);

  const { data: keyRow } = await supabaseService
    .from("institution_api_keys")
    .select("id, institution_id, mode, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (!keyRow || keyRow.revoked_at) return { ok: false };

  const { data: institution } = await supabaseService
    .from("institutions")
    .select("id, name, status, enforcement_level")
    .eq("id", keyRow.institution_id)
    .maybeSingle();
  if (!institution || institution.status !== "active") return { ok: false };

  // Atomic check-and-increment (row-locked inside the RPC) — a plain
  // read-then-write here would let two concurrent requests both read the
  // same pre-increment count and both proceed, silently admitting one
  // request over the limit per race. Same reasoning as dispense_drug()
  // (0010) and create_prescription_version() (0016).
  const { data: rateLimitRows, error: rateLimitError } = await supabaseService.rpc(
    "check_and_increment_api_rate_limit",
    { p_key_id: keyRow.id, p_limit: RATE_LIMIT_PER_MINUTE[keyRow.mode], p_window_seconds: 60 }
  );
  const rateLimitResult = rateLimitRows?.[0];
  if (rateLimitError || !rateLimitResult) {
    // Fail closed on an unexpected RPC error — a broken rate limiter must
    // never silently become "no rate limiting."
    return { ok: false };
  }
  if (!rateLimitResult.allowed) {
    return {
      ok: false,
      rateLimited: true,
      retryAfterSeconds: rateLimitResult.retry_after_seconds,
      windowResetAt: rateLimitResult.window_reset_at,
    };
  }

  // Fire-and-forget — a slow/failed write here shouldn't hold up the actual
  // screening response.
  void supabaseService
    .from("institution_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  return {
    ok: true,
    institutionId: institution.id,
    institutionName: institution.name,
    mode: keyRow.mode,
    enforcementLevel: institution.enforcement_level,
  };
}

/**
 * Who a server-side custom-drug read is on behalf of — required, not
 * optional: supabaseService bypasses RLS entirely, so unlike the client read
 * path (drugRepository.ts, scoped automatically by
 * custom_drugs_select_own_or_institution, 0028_custom_drugs_institution_
 * boundary.sql) there is no database-level fallback here. An omitted scope
 * would have to mean either "everyone's drugs" (the platform-wide leak 0028
 * closed) or "no one's" — making it required forces every call site to say
 * which explicitly, rather than one of those happening by accident.
 *
 * institutionId: an institution API key's own institution (v1/screen,
 * CDS Hooks) or a signed-in staff member's institutionId claim (dispense).
 * ownerId: only meaningful for a signed-in individual (dispense) — an
 * institution API key has no single "owner" to match against.
 */
export interface CustomDrugScope {
  ownerId?: string;
  institutionId: string | null;
}

/**
 * Fetches admin-added / independent-practitioner-added custom drugs
 * (0026_custom_drugs.sql, institution-scoped by 0028) for merging into a
 * server-side screening call — see runScreen's extraDrugs param. Called once
 * per request by each route handler, not once per screened line, so a
 * multi-drug request doesn't do N redundant round-trips for the same small
 * table. Filtered in code, not by RLS (see CustomDrugScope) to exactly the
 * same visibility rule 0028 enforces for the client read path: the scope's
 * own drugs, plus same-institution drugs when institutionId is set.
 */
export async function getCustomDrugs(scope: CustomDrugScope): Promise<Drug[]> {
  const { data, error } = await supabaseService.from("custom_drugs").select("drug, owner_id, institution_id");
  if (error) throw error;
  return (data ?? [])
    .filter(
      (row) =>
        (!!scope.ownerId && row.owner_id === scope.ownerId) ||
        (row.institution_id !== null && row.institution_id === scope.institutionId)
    )
    .map((row) => row.drug as Drug);
}

/**
 * The single, canonical "give me a complete, real formulary" call for any
 * server route that screens exactly once per request (unlike runScreen's
 * multi-order CDS Hooks caller, which pre-fetches extraDrugs itself once and
 * reuses them across several sync runScreen calls to avoid N+1 queries).
 * Fetch + merge in one place, so a server-side screening path never has to
 * remember to do both steps itself — see getBaseFormularyBundle's own
 * comment for why that mattered.
 */
export async function getServerFormularyBundle(scope: CustomDrugScope, region: string = DEFAULT_REGION): Promise<FormularyBundle> {
  const customDrugs = await getCustomDrugs(scope);
  return mergeCustomDrugs(getBaseFormularyBundle(region), customDrugs);
}
