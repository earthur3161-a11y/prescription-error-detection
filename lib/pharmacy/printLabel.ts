import { counselingFor, dosageInstruction } from "./counseling";
import type { Batch, Drug, Patient, PrescriptionDrugLine } from "../types";

const PHARMACY_NAME = "MediGuard Community Pharmacy";
const PHARMACY_ADDRESS = "Ring Road, Accra · 0302 000 000";

export interface LabelItem {
  drug: Drug;
  line: PrescriptionDrugLine;
  batch: Batch;
  quantity: number;
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

/**
 * Builds a simple, reliable patient label + counseling handout and opens it in a
 * print window. Kept intentionally plain so it renders on common thermal/label
 * printers used by small pharmacies rather than relying on elaborate layout.
 */
export function printDispenseHandout(patient: Patient | null, items: LabelItem[]): void {
  const today = new Date().toLocaleDateString();
  const labels = items
    .map((item) => {
      const c = counselingFor(item.drug);
      return `
      <section class="label">
        <div class="pharm">${esc(PHARMACY_NAME)}<br/><span class="addr">${esc(PHARMACY_ADDRESS)}</span></div>
        <div class="pt">${esc(patient?.name ?? "Patient")}${patient?.phone ? " · " + esc(patient.phone) : ""}</div>
        <div class="drug">${esc(item.drug.generic_name)} ${item.line.strengthMg}mg</div>
        <div class="dose">${esc(dosageInstruction(item.drug, item.line))}</div>
        <div class="row"><span>Quantity: <b>${item.quantity}</b></span><span>Batch: ${esc(item.batch.batchNumber)}</span></div>
        <div class="row"><span>Expiry: ${esc(item.batch.expiryDate)}</span><span>Dispensed: ${esc(today)}</span></div>
        <div class="counsel">
          <div><b>Advice:</b> ${esc(c.administration)}</div>
          <div><b>Side effects:</b> ${esc(c.sideEffects)}</div>
          <div><b>Storage:</b> ${esc(c.storage)}</div>
          <div><b>Missed dose:</b> ${esc(c.missedDose)}</div>
        </div>
      </section>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Label</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: system-ui, sans-serif; margin: 0; padding: 12px; color: #0f172a; }
      .label { width: 320px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin: 0 auto 14px; }
      .pharm { font-weight: 700; font-size: 13px; }
      .addr { font-weight: 400; font-size: 11px; color: #64748b; }
      .pt { margin-top: 6px; font-size: 12px; color: #334155; }
      .drug { margin-top: 6px; font-size: 15px; font-weight: 700; }
      .dose { margin-top: 2px; font-size: 13px; }
      .row { display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-top: 4px; }
      .counsel { margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 6px; font-size: 11px; line-height: 1.5; }
      @media print { body { padding: 0; } .label { border-color: #000; } }
    </style></head><body>${labels}
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 150); };</script>
    </body></html>`;

  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
