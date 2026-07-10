// Server-side screening service shared by the REST endpoint (/api/v1/screen)
// and the CDS Hooks endpoint (/cds-services/mediguard-screen).
//
// The screening engine and formulary are pure, framework-agnostic modules with
// no browser/IndexedDB dependency, so the exact same `screenDrugLine` that runs
// in the app also runs here on the server — one screening core, three
// operations, now including live machine-to-machine integration (Operation 3).

import { z } from "zod";
import { DEFAULT_REGION, getFormularyBundle } from "../formulary";
import { screenDrugLine } from "../screening-engine";
import type { DrugLineVerdict } from "../screening-engine/types";
import type {
  ActiveMedication,
  AllergyRecord,
  Patient,
  PrescriptionDrugLine,
  Route,
} from "../types";

const VALID_ROUTES: Route[] = ["oral", "IV", "IM", "topical", "inhaled", "rectal", "sublingual"];

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
  return {
    id: "api_patient",
    name: "API Patient",
    dob: input.dob ?? "1970-01-01",
    sex: input.sex ?? "other",
    weightKg: input.weightKg ?? null,
    renalStatus: input.renalStatus ?? "unknown",
    hepaticStatus: input.hepaticStatus ?? "unknown",
    isPregnant: input.isPregnant ?? null,
    allergies,
    activeMedications,
  };
}

export interface ScreenResult {
  verdict: DrugLineVerdict;
  drugName: string;
}

/** Runs the real screening engine over a validated request. Returns null when the drugId isn't in the formulary. */
export function runScreen(request: ScreenRequest): ScreenResult | null {
  const formulary = getFormularyBundle(DEFAULT_REGION);
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

// --- API-key authentication (demo-grade) ---
//
// Production keys would live server-side (e.g. MEDIGUARD_API_KEYS env var). In
// dev, since keys are minted client-side in the Integration Dashboard, we also
// accept any well-formed mg_live_/mg_sandbox_ key so the sandbox works end to
// end. This is deliberately NOT production authentication.

const DEV_KEY_PATTERN = /^mg_(live|sandbox)_[\w-]{6,}$/;

export interface AuthResult {
  ok: boolean;
  mode?: "live" | "sandbox";
}

export function authorizeApiKey(request: Request): AuthResult {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false };
  const key = match[1].trim();

  const configured = (process.env.MEDIGUARD_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (configured.includes(key)) {
    return { ok: true, mode: key.startsWith("mg_live") ? "live" : "sandbox" };
  }

  const devMatch = key.match(DEV_KEY_PATTERN);
  if (devMatch) return { ok: true, mode: devMatch[1] as "live" | "sandbox" };

  return { ok: false };
}
