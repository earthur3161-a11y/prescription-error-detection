// CDS Hooks mapping layer. Turns a CDS Hooks service request (from an EHR, on
// order-select / order-sign) into MediGuard screening inputs, and turns the
// resulting verdicts back into CDS Hooks "cards" — the interruptive alert the
// physician sees inside their EHR (Operation 3, channel-specific output).
//
// Full FHIR parsing is intentionally pragmatic: we accept both a simplified
// draftOrders array (easy to test / integrate) and a FHIR Bundle of
// MedicationRequest resources, mapping the common fields defensively.

import { z } from "zod";
import {
  drugSchema,
  patientSchema,
  runScreen,
  type ScreenRequest,
} from "./screenService";
import type { Flag } from "../screening-engine/types";
import type { Verdict } from "../screening-engine/types";

type DrugInput = z.infer<typeof drugSchema>;
type PatientInput = z.infer<typeof patientSchema>;

/** The override reasons an EHR can present when a prescriber proceeds past a card. Mirrors the app's OverrideReasonCode. */
export const OVERRIDE_REASONS = [
  { code: "benefit_outweighs_risk", display: "Benefit outweighs risk" },
  { code: "verified_with_pharmacist", display: "Verified with pharmacist" },
  { code: "patient_tolerates_combination", display: "Patient already tolerates this combination" },
  { code: "other", display: "Other (documented)" },
];

const INDICATOR: Record<Verdict, "info" | "warning" | "critical"> = {
  safe: "info",
  caution: "warning",
  blocked: "critical",
};

const SEVERITY_RANK: Record<Flag["severity"], number> = {
  severe: 5,
  major: 4,
  moderate: 3,
  minor: 2,
  unknown: 1,
  none: 0,
};

export interface CdsCard {
  summary: string;
  indicator: "info" | "warning" | "critical";
  detail: string;
  source: { label: string };
  overrideReasons: typeof OVERRIDE_REASONS;
}

// --- Request parsing ---

/** Minimal FHIR Bundle shape we read MedicationRequest resources out of. */
interface FhirBundle {
  resourceType?: string;
  entry?: { resource?: Record<string, unknown> }[];
}

function extractDrugFromMedicationRequest(res: Record<string, unknown>): DrugInput | null {
  const concept = (res.medicationCodeableConcept ?? {}) as {
    coding?: { code?: string }[];
    text?: string;
  };
  const drugId = concept.coding?.[0]?.code ?? (typeof res.id === "string" ? res.id : undefined);
  if (!drugId) return null;

  const dosage = (res.dosageInstruction as unknown[] | undefined)?.[0] as
    | { doseAndRate?: { doseQuantity?: { value?: number } }[]; timing?: { repeat?: { frequency?: number } }; route?: { text?: string } }
    | undefined;
  const doseMg = dosage?.doseAndRate?.[0]?.doseQuantity?.value ?? 0;
  const frequencyPerDay = dosage?.timing?.repeat?.frequency ?? 1;
  const route = dosage?.route?.text ?? "oral";

  return { drugId, doseMg, frequencyPerDay, durationDays: 0, route };
}

function ordersFromDraft(draft: unknown): DrugInput[] {
  if (Array.isArray(draft)) {
    // Simplified array form: each entry is a MediGuard drug object.
    return draft
      .map((d) => drugSchema.safeParse(d))
      .filter((r): r is { success: true; data: DrugInput } => r.success)
      .map((r) => r.data);
  }
  const bundle = draft as FhirBundle | undefined;
  if (bundle?.entry) {
    return bundle.entry
      .map((e) => e.resource)
      .filter((r): r is Record<string, unknown> => !!r && r.resourceType === "MedicationRequest")
      .map(extractDrugFromMedicationRequest)
      .filter((d): d is DrugInput => d !== null);
  }
  return [];
}

const cdsRequestSchema = z.object({
  hook: z.string().optional(),
  hookInstance: z.string().optional(),
  context: z
    .object({
      patientId: z.string().optional(),
      patient: patientSchema.optional(),
      draftOrders: z.unknown().optional(),
      medications: z.unknown().optional(),
    })
    .optional(),
  prefetch: z
    .object({
      patient: patientSchema.optional(),
    })
    .optional(),
});

export interface CdsParseResult {
  orders: DrugInput[];
  patient: PatientInput;
}

export function parseCdsRequest(body: unknown): CdsParseResult | null {
  const parsed = cdsRequestSchema.safeParse(body);
  if (!parsed.success) return null;
  const ctx = parsed.data.context;
  const orders = ordersFromDraft(ctx?.draftOrders ?? ctx?.medications);
  const patient = ctx?.patient ?? parsed.data.prefetch?.patient ?? null;
  return { orders, patient };
}

// --- Card building ---

export function buildCards(parsed: CdsParseResult): CdsCard[] {
  const cards: CdsCard[] = [];

  parsed.orders.forEach((order, index) => {
    const request: ScreenRequest = {
      patient: parsed.patient,
      drug: order,
      otherDrugs: parsed.orders.filter((_, i) => i !== index),
    };
    const result = runScreen(request);
    if (!result) return;

    const { verdict, flags } = result.verdict;
    if (verdict === "safe" || flags.length === 0) return;

    const worst = [...flags].sort(
      (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    )[0];

    const summaryBase = `${result.drugName}: ${worst.message}`;
    const summary = summaryBase.length > 138 ? summaryBase.slice(0, 137) + "…" : summaryBase;

    const detail = flags
      .map((f) => `- **${f.type.replace(/_/g, " ")}** (${f.severity}): ${f.message}`)
      .join("\n");

    cards.push({
      summary,
      indicator: INDICATOR[verdict],
      detail,
      source: { label: "MediGuard — Ghana STG screening" },
      overrideReasons: OVERRIDE_REASONS,
    });
  });

  return cards;
}
