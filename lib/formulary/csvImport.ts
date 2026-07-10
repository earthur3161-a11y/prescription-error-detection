import type { Drug, Route } from "../types";

const VALID_ROUTES: Route[] = ["oral", "IV", "IM", "topical", "inhaled", "rectal", "sublingual"];

export const CSV_TEMPLATE_HEADERS = [
  "generic_name",
  "brand_names",
  "class",
  "min_mg_per_dose",
  "max_mg_per_dose",
  "max_mg_per_day",
  "frequency",
  "routes",
  "is_on_eml",
  "eml_alternative_generic",
  "contraindications",
] as const;

export const CSV_TEMPLATE_EXAMPLE = `${CSV_TEMPLATE_HEADERS.join(",")}
Metformin,Glucophage,Biguanide (Antidiabetic),500,1000,2000,twice daily,oral,true,,Severe renal impairment
Rosuvastatin,Crestor,Statin,5,20,40,once daily,oral,false,Simvastatin,Active liver disease
Ceftazidime,Fortum,Cephalosporin,1000,2000,6000,every 8h,IV;IM,true,,`;

export interface DrugImportRow {
  generic_name: string;
  drug: Omit<Drug, "emlAlternativeDrugId"> & { emlAlternativeGeneric?: string };
}

export interface DrugImportResult {
  /** Valid, non-duplicate rows ready to publish. */
  toPublish: Drug[];
  /** Rows skipped because the generic name already exists (in the formulary or earlier in the file). */
  duplicates: { generic_name: string; reason: string }[];
  /** Rows that failed validation, with a human-readable reason. */
  errors: { row: number; message: string }[];
  /** Total data rows parsed (excludes header). */
  totalRows: number;
}

/** Minimal RFC-4180-ish CSV line splitter: handles quoted fields containing commas and escaped quotes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

function slugifyId(genericName: string): string {
  return (
    "drug_" +
    genericName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
}

function parseBoolean(value: string): boolean {
  return ["true", "yes", "1", "y"].includes(value.trim().toLowerCase());
}

function parseList(value: string): string[] {
  return value
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Parses a CSV of drug records into a publish-ready set, validating each row and
 * de-duplicating by generic name against the existing formulary and within the
 * file itself. Nothing is written here — callers review the result and publish
 * explicitly (review-before-publish governance).
 */
export function parseDrugCsv(text: string, existingDrugs: Drug[]): DrugImportResult {
  const result: DrugImportResult = { toPublish: [], duplicates: [], errors: [], totalRows: 0 };

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    result.errors.push({ row: 0, message: "The file is empty." });
    return result;
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const requiredCols = ["generic_name", "class", "min_mg_per_dose", "max_mg_per_dose", "max_mg_per_day"];
  const missing = requiredCols.filter((c) => idx(c) === -1);
  if (missing.length > 0) {
    result.errors.push({ row: 0, message: `Missing required column(s): ${missing.join(", ")}.` });
    return result;
  }

  const existingNames = new Set(existingDrugs.map((d) => d.generic_name.trim().toLowerCase()));
  const genericToId = new Map(existingDrugs.map((d) => [d.generic_name.trim().toLowerCase(), d.id]));
  const seenInFile = new Set<string>();

  const dataLines = lines.slice(1);
  result.totalRows = dataLines.length;

  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = i + 2; // 1-indexed + header row
    const cells = splitCsvLine(dataLines[i]);
    const get = (name: string) => (idx(name) >= 0 ? cells[idx(name)] ?? "" : "");

    const generic_name = get("generic_name").trim();
    if (!generic_name) {
      result.errors.push({ row: rowNum, message: "Missing generic_name." });
      continue;
    }

    const key = generic_name.toLowerCase();
    if (existingNames.has(key) || seenInFile.has(key)) {
      result.duplicates.push({
        generic_name,
        reason: existingNames.has(key) ? "Already in the formulary" : "Repeated earlier in this file",
      });
      continue;
    }

    const drugClass = get("class").trim();
    const min = Number(get("min_mg_per_dose"));
    const max = Number(get("max_mg_per_dose"));
    const maxDay = Number(get("max_mg_per_day"));

    if (!drugClass) {
      result.errors.push({ row: rowNum, message: `${generic_name}: missing therapeutic class.` });
      continue;
    }
    if (![min, max, maxDay].every((n) => Number.isFinite(n) && n > 0)) {
      result.errors.push({
        row: rowNum,
        message: `${generic_name}: dose columns must be positive numbers.`,
      });
      continue;
    }
    if (max < min) {
      result.errors.push({ row: rowNum, message: `${generic_name}: max dose is less than min dose.` });
      continue;
    }

    const routesRaw = parseList(get("routes"));
    const routes = routesRaw.filter((r): r is Route => (VALID_ROUTES as string[]).includes(r));
    const invalidRoutes = routesRaw.filter((r) => !(VALID_ROUTES as string[]).includes(r));
    if (invalidRoutes.length > 0) {
      result.errors.push({
        row: rowNum,
        message: `${generic_name}: invalid route(s) ${invalidRoutes.join(", ")}. Allowed: ${VALID_ROUTES.join(", ")}.`,
      });
      continue;
    }

    const drug: Drug = {
      id: slugifyId(generic_name),
      generic_name,
      brand_names: parseList(get("brand_names")),
      class: drugClass,
      standard_dose_range: {
        minMgPerDose: min,
        maxMgPerDose: max,
        maxMgPerDay: maxDay,
        frequency: get("frequency").trim() || "as directed",
        weightBased: false,
      },
      route: routes.length > 0 ? routes : ["oral"],
      region_availability: ["GH"],
      onEssentialMedicinesList: parseBoolean(get("is_on_eml")),
    };

    const altGeneric = get("eml_alternative_generic").trim().toLowerCase();
    if (altGeneric && genericToId.has(altGeneric)) {
      drug.emlAlternativeDrugId = genericToId.get(altGeneric);
    }

    const contraindications = parseList(get("contraindications"));
    if (contraindications.length > 0) drug.contraindications = contraindications;

    result.toPublish.push(drug);
    seenInFile.add(key);
    genericToId.set(key, drug.id);
  }

  return result;
}
