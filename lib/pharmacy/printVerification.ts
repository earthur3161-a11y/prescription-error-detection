import { getVerdictBasis, getVerdictColorToken, getVerdictShape, type VerdictBasis } from "../design/verdictVisuals";
import type { Drug, DispenseRecord, Patient, PrescriptionDrugLine } from "../types";
import type { Severity, Verdict } from "../screening-engine";

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

// Light-mode design tokens, resolved to plain hex. This print window is a
// bare document opened via window.open()/document.write() — it has no
// access to app/globals.css's :root custom properties (separate document,
// no stylesheet inherited), so the values are duplicated here rather than
// referenced. Print output always uses the light palette regardless of the
// pharmacist's on-screen theme, same as any printed document would.
// Keep in sync with app/globals.css's :root block if the palette changes.
const COLOR = {
  ink: "#34383D",
  foreground: "#0f172a",
  secondary: "#475569",
  subtle: "#64748b",
  border: "#cbd5e1",
  surface2: "#f1f5f9",
  safeFg: "#1E7A4C",
  safeBg: "#E3F5EA",
  cautionFg: "#B5750A",
  cautionBg: "#FBF0DC",
  blockedFg: "#B3261E",
  blockedBg: "#FBE4E2",
  unknownFg: "#5B4B8A",
  unknownBg: "#EDEAF7",
};

const TONE_FG: Record<ReturnType<typeof getVerdictColorToken>, string> = {
  safe: COLOR.safeFg,
  caution: COLOR.cautionFg,
  blocked: COLOR.blockedFg,
  unknown: COLOR.unknownFg,
  neutral: COLOR.subtle,
};
const TONE_BG: Record<ReturnType<typeof getVerdictColorToken>, string> = {
  safe: COLOR.safeBg,
  caution: COLOR.cautionBg,
  blocked: COLOR.blockedBg,
  unknown: COLOR.unknownBg,
  neutral: COLOR.surface2,
};

// The IBM Plex Serif masthead, self-hosted as a base64 data: URI rather than
// a Google Fonts <link> — this window opens from a live print action at a
// pharmacy counter, and printing a legal/audit record shouldn't depend on a
// network request succeeding at that exact moment. Subsetted to only the
// characters the masthead actually uses (pharmacy name + document title),
// which keeps this under 5KB instead of the ~30-80KB a full-weight family
// file would cost.
const PLEX_SERIF_MASTHEAD_BASE64 =
  "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";

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
 * Logic unchanged from the previous version — only the markup/classes it
 * emits were restyled.
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

// --- Vector shape markup, mirroring components/ui/shapes.tsx exactly (same
// path data) so the printed record uses the identical shape language as the
// screen — a pharmacist reading the paper copy later sees the same seal/
// triangle/octagon/ring vocabulary they saw at the counter. Duplicated
// rather than shared because this file generates a raw HTML string for a
// separate popup document, not JSX rendered into the app's own DOM; there's
// no runtime bridge between the two without a much bigger refactor than
// this warrants. Keep the `d` attributes in sync if shapes.tsx changes.
function shapeSvg(shape: ReturnType<typeof getVerdictShape>, colorHex: string, sizePx: number): string {
  const svgOpen = `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 24 24" aria-hidden="true">`;
  if (shape === "seal") {
    return `${svgOpen}<circle cx="12" cy="12" r="11" fill="${colorHex}"/><path d="M7 12.5l3.2 3.2L17 9" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
  }
  if (shape === "triangle") {
    return `${svgOpen}<path d="M12 2.2c.5 0 1 .28 1.27.76l9 16.2A1.45 1.45 0 0 1 21 21.4H3a1.45 1.45 0 0 1-1.27-2.24l9-16.2A1.46 1.46 0 0 1 12 2.2Z" fill="${colorHex}"/><rect x="11" y="9" width="2" height="6" rx="1" fill="white"/><circle cx="12" cy="17.3" r="1.15" fill="white"/></svg>`;
  }
  if (shape === "octagon") {
    return `${svgOpen}<path d="M8 2h8L22 8v8L16 22h-8L2 16v-8L8 2Z" fill="${colorHex}"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="white" stroke-width="2.1" stroke-linecap="round"/></svg>`;
  }
  // ring
  return `${svgOpen}<circle cx="12" cy="12" r="9.5" fill="none" stroke="${colorHex}" stroke-width="2.4" stroke-dasharray="4.2 3.6" stroke-linecap="round"/><text x="12" y="16.2" text-anchor="middle" font-size="11" font-weight="700" fill="${colorHex}">?</text></svg>`;
}

/** The document-level authenticity mark — not tied to any one drug's verdict, just "this is a real MediGuard verification record." Rendered in ink, not a verdict color, since it asserts the pharmacy's own record-keeping, not a clinical result. */
function documentStamp(): string {
  return `<svg width="76" height="76" viewBox="0 0 76 76" class="doc-stamp" aria-hidden="true">
    <circle cx="38" cy="38" r="35" fill="none" stroke="${COLOR.ink}" stroke-width="2"/>
    <circle cx="38" cy="38" r="29" fill="none" stroke="${COLOR.ink}" stroke-width="1"/>
    <path d="M24 38l9 9 18-18" stroke="${COLOR.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <text x="38" y="60" text-anchor="middle" font-size="7" font-weight="700" letter-spacing="1.5" fill="${COLOR.ink}">VERIFIED</text>
  </svg>`;
}

/**
 * Basis-aware result text — same confirmed/unknown-only/mixed distinction
 * VerdictMark shows on screen (lib/design/verdictVisuals.ts), spelled out
 * explicitly in words here since a printed page has no hover state and
 * should never rely on shape/color alone to make this legible on paper.
 */
function resultLabel(verdict: Verdict, basis: VerdictBasis): string {
  if (verdict === "safe") return "SAFE";
  const base = verdict === "caution" ? "CAUTION" : "BLOCKED";
  if (basis === "unknown-only") return `UNVERIFIED — OVERRIDDEN (no confirmed ${base.toLowerCase()} finding; missing data only)`;
  if (basis === "mixed") return `${base} — OVERRIDDEN (some contributing data also unverified)`;
  return `${base} — OVERRIDDEN`;
}

const SEVERITY_TAG_TONE: Record<Severity, ReturnType<typeof getVerdictColorToken>> = {
  none: "neutral",
  minor: "caution",
  moderate: "caution",
  major: "blocked",
  severe: "blocked",
  unknown: "unknown",
};

function itemBlock(item: VerificationItem, pharmacist: PharmacistRef): string {
  const { drug, line, record } = item;
  const verdict = record.screeningVerdict;
  const flagged = verdict !== "safe";
  const basis = getVerdictBasis(verdict, record.screeningFlags);
  const shape = getVerdictShape(verdict, basis);
  const tone = getVerdictColorToken(verdict, basis);
  const label = resultLabel(verdict, basis);

  const flagsHtml = flagged
    ? `<div class="flags">
        <p class="flags-title">Flags that triggered this result:</p>
        <ul>${record.screeningFlags
          .map((f) => {
            const t = SEVERITY_TAG_TONE[f.severity];
            return `<li><span class="sev-tag" style="background:${TONE_BG[t]};color:${TONE_FG[t]}">${esc(f.severity)}</span> ${esc(f.audience_variant.clinical)}</li>`;
          })
          .join("")}</ul>
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
      <div class="item-head">
        <div class="item-mark">${shapeSvg(shape, TONE_FG[tone], 34)}</div>
        <div class="item-head-text">
          <div class="drug-name">${esc(drug.generic_name)} ${line.strengthMg}mg</div>
          <div class="result-label" style="background:${TONE_BG[tone]};color:${TONE_FG[tone]}">${esc(label)}</div>
        </div>
      </div>
      <div class="field"><b>Prescribed:</b> ${line.doseMg}mg ${esc(line.route)} · ${line.frequencyPerDay}×/day · ${line.durationDays} days</div>
      <div class="field"><b>Dispensed:</b> <span class="mono">${record.quantityDispensed} units</span>${record.partialDispenseReason ? ` (partial — ${esc(record.partialDispenseReason)})` : ""}</div>
      <div class="field mono"><b>Screened at:</b> ${esc(fmt(record.screenedAt))}</div>
      <div class="field mono"><b>Dispensed at:</b> ${esc(fmt(record.dispensedAt))}</div>
      <div class="checks"><b>Checks run:</b> ${CHECKS_RUN.join(", ")}</div>
      ${flagsHtml}
      ${overrideHtml}
    </section>`;
}

/**
 * Separate from printDispenseHandout (the patient-facing counseling label,
 * deliberately small and plain for thermal printers). This is the pharmacy's
 * own audit/proof record — full detail, meant for the pharmacy file, not the
 * patient's hand — so it gets a full-page letterhead layout instead of a
 * label form factor, and prints the honest record of what happened
 * (including any override, and the confirmed/unverified distinction behind
 * it), not a sanitized "verified safe" summary.
 */
export function printVerificationProof(patient: Patient | null, items: VerificationItem[], pharmacist: PharmacistRef): void {
  const now = new Date().toLocaleString();
  const patientBlock = `
    <div class="patient-card">
      <div class="field"><b>Patient:</b> ${esc(patient?.name ?? "Unknown")}</div>
      <div class="field"><b>Patient ID:</b> <span class="mono">${esc(patient?.id ?? "Unknown")}</span></div>
      <div class="field"><b>DOB:</b> ${esc(patient?.dob ?? "Unknown")}</div>
      ${patientStatusBlock(patient)}
    </div>`;

  const itemsHtml = items.map((item) => itemBlock(item, pharmacist)).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Dispense Verification Record</title>
    <style>
      @font-face {
        font-family: 'IBM Plex Serif Masthead';
        font-style: normal;
        font-weight: 600;
        src: url(data:font/woff2;base64,${PLEX_SERIF_MASTHEAD_BASE64}) format('woff2');
        font-display: block;
      }
      * { box-sizing: border-box; }
      html {
        /* Without this, most browsers drop background colors when printing
           by default (to save ink) — the result-label pills, severity tags,
           and unknownAware() highlighting all depend on their background
           color to read correctly, on-screen preview or on paper, so this
           isn't optional here the way it would be on a page where color is
           decorative. Three variants because support for the unprefixed
           spec name has been inconsistent across engines and versions, and
           a pharmacy counter's actual browser isn't something we control:
           -webkit- for older Safari/Chrome/Edge, bare color-adjust for the
           original (pre-rename) Firefox implementation, and
           print-color-adjust for the current standard name every modern
           engine now recognizes. */
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        font-family: ui-sans-serif, "Segoe UI", system-ui, sans-serif;
        margin: 0; padding: 28px; color: ${COLOR.foreground}; max-width: 720px; margin-inline: auto;
      }
      .mono { font-family: ui-monospace, "SF Mono", Consolas, monospace; }

      .masthead { position: relative; padding-right: 90px; margin-bottom: 4px; }
      .doc-stamp { position: absolute; top: -6px; right: 0; }
      .pharmacy-name { font-family: 'IBM Plex Serif Masthead', ui-serif, Georgia, serif; font-size: 21px; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
      .doc-title { font-family: 'IBM Plex Serif Masthead', ui-serif, Georgia, serif; font-size: 13px; font-weight: 600; color: ${COLOR.secondary}; margin: 2px 0 0; }
      .pharm-addr { font-size: 11px; color: ${COLOR.subtle}; margin-top: 6px; }
      .doc-meta { font-size: 11px; color: ${COLOR.subtle}; margin-top: 2px; }
      .rule { border: none; border-top: 1.5px solid ${COLOR.ink}; margin: 14px 0 18px; }

      .patient-card { border: 1px solid ${COLOR.border}; border-radius: 6px; padding: 12px 14px; margin-bottom: 16px; }
      .item { border: 1px solid ${COLOR.border}; border-radius: 6px; padding: 14px 16px; margin-bottom: 14px; page-break-inside: avoid; }
      .item-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
      .item-mark { flex-shrink: 0; }
      .drug-name { font-size: 15px; font-weight: 700; }
      .result-label { display: inline-block; margin-top: 3px; font-weight: 700; font-size: 11px; letter-spacing: 0.02em; padding: 2px 8px; border-radius: 4px; }
      .field { font-size: 12px; margin-top: 4px; color: ${COLOR.foreground}; }
      .field.unknown { background: ${COLOR.unknownBg}; color: ${COLOR.unknownFg}; padding: 3px 7px; border-radius: 4px; }
      .unk-tag { font-weight: 700; font-size: 10px; margin-left: 4px; }
      .checks { font-size: 11px; color: ${COLOR.secondary}; margin-top: 8px; }
      .flags { margin-top: 8px; font-size: 12px; }
      .flags-title { font-weight: 700; margin: 0 0 5px; }
      .flags ul { margin: 0; padding-left: 0; list-style: none; }
      .flags li { margin-top: 4px; }
      .sev-tag { font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 1.5px 6px; border-radius: 4px; margin-right: 5px; }
      .override { margin-top: 10px; border-top: 1px dashed ${COLOR.border}; padding-top: 8px; }
      .override-title { font-weight: 700; font-size: 12px; margin: 0 0 4px; }
      blockquote { margin: 0; padding: 8px 10px; background: ${COLOR.surface2}; border-left: 3px solid ${COLOR.subtle}; font-size: 12px; font-style: italic; }
      .override-meta { font-size: 11px; color: ${COLOR.subtle}; margin-top: 4px; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <div class="masthead">
      ${documentStamp()}
      <h1 class="pharmacy-name">${esc(PHARMACY_NAME)}</h1>
      <p class="doc-title">Dispense Verification Record</p>
      <div class="pharm-addr">${esc(PHARMACY_ADDRESS)}</div>
      <div class="doc-meta mono">Printed ${esc(now)} · Pharmacist: ${esc(pharmacist.name)} (${esc(pharmacist.id)})</div>
    </div>
    <hr class="rule" />
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
