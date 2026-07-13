import type { Flag, FlagType, Severity, Verdict } from "./types";

/** Human label per distinct flag type — used to title groups in the findings panel. */
export const FLAG_TYPE_LABEL: Record<FlagType, string> = {
  allergy: "Allergy conflict",
  interaction: "Drug interaction",
  duplicate_therapy: "Duplicate therapy",
  dose_range: "Dosing",
  wrong_dose: "Wrong dose",
  wrong_frequency: "Wrong frequency",
  wrong_duration: "Wrong duration",
  max_daily_dose: "Maximum daily dose exceeded",
  pediatric_geriatric_dosing: "Pediatric / geriatric dosing",
  contraindication: "Contraindication",
  pregnancy_warning: "Pregnancy warning",
  missing_information: "Missing information",
  data_incomplete: "Incomplete patient data",
  eml_compliance: "Formulary (EML)",
  indication_mismatch: "Possible indication mismatch",
};

/** Coarser category for the one-line summary ("2 dosing issues, 1 interaction, 1 missing field"). */
const CATEGORY: Record<FlagType, string> = {
  allergy: "allergy",
  interaction: "interaction",
  duplicate_therapy: "duplicate",
  dose_range: "dosing",
  wrong_dose: "dosing",
  wrong_frequency: "dosing",
  wrong_duration: "dosing",
  max_daily_dose: "dosing",
  pediatric_geriatric_dosing: "dosing",
  contraindication: "contraindication",
  pregnancy_warning: "contraindication",
  missing_information: "missing field",
  data_incomplete: "missing field",
  eml_compliance: "formulary",
  indication_mismatch: "indication note",
};

const CATEGORY_PLURAL: Record<string, string> = {
  allergy: "allergy conflicts",
  interaction: "interactions",
  duplicate: "duplicate-therapy flags",
  dosing: "dosing issues",
  contraindication: "contraindications",
  "missing field": "missing fields",
  formulary: "formulary notes",
  "indication note": "indication notes",
};

export const SEVERITY_RANK: Record<Severity, number> = {
  severe: 5,
  major: 4,
  moderate: 3,
  minor: 2,
  unknown: 1,
  none: 0,
};

export type RiskLevel = "Low" | "Moderate" | "High";

export function riskLevel(verdict: Verdict): RiskLevel {
  return verdict === "blocked" ? "High" : verdict === "caution" ? "Moderate" : "Low";
}

export interface FlagGroup {
  type: FlagType;
  label: string;
  maxSeverity: Severity;
  flags: Flag[];
}

/** Groups flags by their distinct type, each group ordered and the groups sorted by worst severity. */
export function groupFlagsByType(flags: Flag[]): FlagGroup[] {
  const byType = new Map<FlagType, Flag[]>();
  for (const flag of flags) {
    const list = byType.get(flag.type) ?? [];
    list.push(flag);
    byType.set(flag.type, list);
  }
  const groups: FlagGroup[] = [];
  for (const [type, groupFlags] of byType) {
    const maxSeverity = groupFlags.reduce<Severity>(
      (worst, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst] ? f.severity : worst),
      "none"
    );
    groups.push({ type, label: FLAG_TYPE_LABEL[type], maxSeverity, flags: groupFlags });
  }
  return groups.sort((a, b) => SEVERITY_RANK[b.maxSeverity] - SEVERITY_RANK[a.maxSeverity]);
}

/** One-line count summary grouped by coarse category, e.g. "2 dosing issues · 1 interaction". */
export function summariseByCategory(flags: Flag[]): string {
  const counts = new Map<string, number>();
  for (const flag of flags) {
    const cat = CATEGORY[flag.type];
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  if (counts.size === 0) return "No issues found";
  return [...counts.entries()]
    .map(([cat, n]) => `${n} ${n === 1 ? cat.replace("missing field", "missing field") : CATEGORY_PLURAL[cat] ?? cat}`)
    .join(" · ");
}
