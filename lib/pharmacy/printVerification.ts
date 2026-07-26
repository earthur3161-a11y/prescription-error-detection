import type { Drug, DispenseRecord, Patient, PrescriptionDrugLine } from "../types";

const PHARMACY_NAME = "MediGuard Community Pharmacy";
const PHARMACY_ADDRESS = "Ring Road, Accra · 0302 000 000";

export interface VerificationItem {
  drug: Drug;
  line: PrescriptionDrugLine;
  record: DispenseRecord;
}

interface PharmacistRef {
  name: string;
  id: string;
}

const CHECKS_RUN = [
  "Patient data completeness",
  "Prescription completeness",
  "Allergy",
  "Drug interaction",
  "Duplicate therapy",
  "Dose range",
  "Cumulative dose",
  "Contraindication (renal / hepatic / pregnancy)",
  "Essential Medicines List status",
  "Indication match",
];

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

function fmt(ts: string): string {
  return new Date(ts).toLocaleString();
}

/**
 * Renders a value that carries a genuine "unknown" state honestly, rather
 * than defaulting it to something that reads as reassuring — the same
 * unknown-must-never-look-like-safe principle the screening engine itself
 * enforces, extended to what gets printed as proof of what was checked.
 */
function unknownAware(label: string, value: string, isUnknown: boolean): string {
  return isUnknown
    ? `<div class="field unknown"><b>${esc(label)}:</b> ${esc(value)} <span class="unk-tag">NOT ON FILE — not screened</span></div>`
    : `<div class="field"><b>${esc(label)}:</b> ${esc(value)}</div>`;
}

function patientStatusBlock(patient: Patient | null): string {
  if (!patient) {
    return unknownAware("Patient record", "Unavailable", true);
  }
  const renal = unknownAware(
    "Renal function",
    patient.renalStatus === "normal" ? "Normal" : patient.renalStatus === "impaired" ? "Impaired" : "Unknown",
    patient.renalStatus === "unknown"
  );
  const hepatic = unknownAware(
    "Hepatic function",
    patient.hepaticStatus === "normal" ? "Normal" : patient.hepaticStatus === "impaired" ? "Impaired" : "Unknown",
    patient.hepaticStatus === "unknown"
  );
  const pregnancy = unknownAware(
    "Pregnancy status",
    patient.isPregnant === true ? "Pregnant" : patient.isPregnant === false ? "Not pregnant" : "Unknown",
    patient.isPregnant == null
  );
  const allergyText =
    patient.allergies === null
      ? "Unknown"
      : patient.allergies.length === 0
        ? "None recorded (confirmed)"
        : patient.allergies.map((a) => `${a.allergen} (${a.severity})`).join(", ");
  const allergies = unknownAware("Allergies on file", allergyText, patient.allergies === null);
  return `${renal}${hepatic}${pregnancy}${allergies}`;
}

function itemBlock(item: VerificationItem, patient: Patient | null, pharmacist: PharmacistRef): string {
  const { drug, line, record } = item;
  const verdict = record.screeningVerdict;
  const flagged = verdict !== "safe";
  const resultLabel = !flagged ? "SAFE" : verdict === "caution" ? "CAUTION — OVERRIDDEN" : "BLOCKED — OVERRIDDEN";
  const resultClass = !flagged ? "result-safe" : "result-flagged";

  const flagsHtml = flagged
    ? `<div class="flags">
        <p class="flags-title">Flags that triggered this result:</p>
        <ul>${record.screeningFlags.map((f) => `<li>[${esc(f.severity)}] ${esc(f.audience_variant.clinical)}</li>`).join("")}</ul>
      </div>`
    : "";

  const overrideHtml = flagged
    ? `<div class="override">
        <p class="override-title">Override note (verbatim):</p>
        <blockquote>${esc(record.overrideNote ?? "")}</blockquote>
        <p class="override-meta">Authored and dispensed by the same pharmacist: ${esc(pharmacist.name)} (${esc(pharmacist.id)})</p>
      </div>`
    : "";

  return `
    <section class="item">
      <div class="drug-name">${esc(drug.generic_name)} ${line.strengthMg}mg</div>
      <div class="field"><b>Prescribed:</b> ${line.doseMg}mg ${esc(line.route)} · ${line.frequencyPerDay}×/day · ${line.durationDays} days</div>
      <div class="field"><b>Dispensed:</b> ${record.quantityDispensed} units${record.partialDispenseReason ? ` (partial — ${esc(record.partialDispenseReason)})` : ""}</div>
      <div class="field"><b>Screened at:</b> ${esc(fmt(record.screenedAt))}</div>
      <div class="field"><b>Dispensed at:</b> ${esc(fmt(record.dispensedAt))}</div>
      <div class="checks"><b>Checks run:</b> ${CHECKS_RUN.join(", ")}</div>
      <div class="result ${resultClass}">Screening result: ${resultLabel}</div>
      ${flagsHtml}
      ${overrideHtml}
    </section>`;
}

/**
 * Separate from printDispenseHandout (the patient-facing counseling label,
 * deliberately small and plain for thermal printers). This is the pharmacy's
 * own audit/proof record — full detail, meant for the pharmacy file, not the
 * patient's hand — so it gets a full-page layout instead of a label form
 * factor, and prints the honest record of what happened (including any
 * override), not a sanitized "verified safe" summary.
 */
export function printVerificationProof(patient: Patient | null, items: VerificationItem[], pharmacist: PharmacistRef): void {
  const now = new Date().toLocaleString();
  const patientBlock = `
    <div class="patient-card">
      <div class="field"><b>Patient:</b> ${esc(patient?.name ?? "Unknown")}</div>
      <div class="field"><b>Patient ID:</b> ${esc(patient?.id ?? "Unknown")}</div>
      <div class="field"><b>DOB:</b> ${esc(patient?.dob ?? "Unknown")}</div>
      ${patientStatusBlock(patient)}
    </div>`;

  const itemsHtml = items.map((item) => itemBlock(item, patient, pharmacist)).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Dispense Verification Record</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; color: #0f172a; max-width: 720px; margin-inline: auto; }
      h1 { font-size: 16px; margin: 0 0 2px; }
      .pharm-addr { font-size: 11px; color: #64748b; margin-bottom: 4px; }
      .meta { font-size: 11px; color: #64748b; margin-bottom: 16px; }
      .patient-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
      .item { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 14px; page-break-inside: avoid; }
      .drug-name { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
      .field { font-size: 12px; margin-top: 3px; }
      .field.unknown { background: #fef3c7; padding: 3px 6px; border-radius: 4px; }
      .unk-tag { font-weight: 700; color: #92400e; font-size: 10px; margin-left: 4px; }
      .checks { font-size: 11px; color: #475569; margin-top: 6px; }
      .result { margin-top: 8px; font-weight: 700; font-size: 13px; padding: 4px 8px; border-radius: 4px; display: inline-block; }
      .result-safe { background: #dcfce7; color: #166534; }
      .result-flagged { background: #fee2e2; color: #991b1b; }
      .flags { margin-top: 8px; font-size: 12px; }
      .flags-title { font-weight: 700; margin: 0 0 4px; }
      .flags ul { margin: 0; padding-left: 18px; }
      .override { margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
      .override-title { font-weight: 700; font-size: 12px; margin: 0 0 4px; }
      blockquote { margin: 0; padding: 8px 10px; background: #f1f5f9; border-left: 3px solid #64748b; font-size: 12px; font-style: italic; }
      .override-meta { font-size: 11px; color: #64748b; margin-top: 4px; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>${esc(PHARMACY_NAME)} — Dispense Verification Record</h1>
    <div class="pharm-addr">${esc(PHARMACY_ADDRESS)}</div>
    <div class="meta">Printed ${esc(now)} · Pharmacist: ${esc(pharmacist.name)} (${esc(pharmacist.id)})</div>
    ${patientBlock}
    ${itemsHtml}
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 150); };</script>
    </body></html>`;

  const w = window.open("", "_blank", "width=760,height=900");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
