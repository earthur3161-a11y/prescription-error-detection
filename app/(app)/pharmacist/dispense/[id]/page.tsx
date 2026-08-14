"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Home, Printer, ShieldAlert } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { FlagSeverityChip } from "@/components/ui/FlagSeverityChip";
import { CounselingSheet } from "@/components/pharmacy/CounselingSheet";
import { PageShell } from "@/components/layout/PageShell";
import { usePrescription } from "@/lib/query/hooks/usePrescriptions";
import { usePatient } from "@/lib/query/hooks/usePatient";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useBatches, useCreateDispenseRecord, usePharmacySettings, useAppendPharmacistAction } from "@/lib/query/hooks/usePharmacy";
import { useAuth } from "@/lib/auth/useAuth";
import { useToastStore } from "@/lib/store/toast-store";
import { effectiveBatchStatus, isDispensable, suggestFefoBatch, totalDispensableStock } from "@/lib/pharmacy/inventory";
import { suggestSubstitutes } from "@/lib/pharmacy/substitution";
import { printDispenseHandout, type LabelItem } from "@/lib/pharmacy/printLabel";
import { printVerificationProof, type VerificationItem } from "@/lib/pharmacy/printVerification";
import { isGenuineOverrideNote } from "@/lib/pharmacy/overrideValidation";
import { DispenseError } from "@/lib/pharmacy/dispenseClient";
import { pharmacyStateOf } from "@/lib/pharmacy/status";
import { screenDrugLine, type Verdict } from "@/lib/screening-engine";
import { cn } from "@/lib/utils/cn";
import type { Batch } from "@/lib/types";

interface LineState {
  batchId: string;
  quantity: number;
  partialReason: string;
  overrideNote: string;
}

// Only ever indexed for caution/blocked (c.flagged excludes safe by
// definition) — safe included for type completeness, never rendered.
const FLAGGED_BOX_CLASS: Record<Verdict, string> = {
  safe: "bg-safe-bg text-safe-fg",
  caution: "bg-caution-bg text-caution-fg",
  blocked: "bg-blocked-bg text-blocked-fg",
};

export default function DispensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const showToast = useToastStore((s) => s.show);

  const { data: prescription, isLoading } = usePrescription(id);
  const { data: patient } = usePatient(prescription?.patientId ?? null);
  const { data: formulary } = useFormulary();
  const { data: batches } = useBatches();
  const { data: settings } = usePharmacySettings();

  const createDispense = useCreateDispenseRecord();
  const appendAction = useAppendPharmacistAction();

  const [lineState, setLineState] = useState<Record<string, LineState>>({});
  const [finalized, setFinalized] = useState(false);
  const [dispensedItems, setDispensedItems] = useState<LabelItem[]>([]);
  const [verificationItems, setVerificationItems] = useState<VerificationItem[]>([]);
  const [dispenseErrors, setDispenseErrors] = useState<Record<string, string>>({});
  const initedRef = useRef(false);

  const nearExpiryDays = settings?.nearExpiryDays ?? 60;

  const batchesByDrug = useMemo(() => {
    const map = new Map<string, Batch[]>();
    for (const b of batches ?? []) {
      const list = map.get(b.drugId) ?? [];
      list.push(b);
      map.set(b.drugId, list);
    }
    return map;
  }, [batches]);

  // Screened fresh here too, for the pharmacist to see before committing —
  // this is informational only. The actual gate is server-side in POST
  // /api/pharmacy/dispense, which re-screens again against the same live
  // patient/prescription data and does not trust anything computed here.
  const verdictsByLineId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof screenDrugLine>>();
    if (!prescription || !formulary) return map;
    for (const line of prescription.drugs) {
      map.set(line.id, screenDrugLine({ patient: patient ?? null, drugLine: line, otherLines: prescription.drugs, formulary }));
    }
    return map;
  }, [prescription, patient, formulary]);

  // Initialise each line with the FEFO batch + suggested quantity, once data is in.
  useEffect(() => {
    if (initedRef.current || !prescription || !batches || !settings) return;
    initedRef.current = true;
    const init: Record<string, LineState> = {};
    for (const line of prescription.drugs) {
      const drugBatches = batchesByDrug.get(line.drugId) ?? [];
      const fefo = suggestFefoBatch(drugBatches, settings.nearExpiryDays);
      const suggestedQty = Math.max(1, line.frequencyPerDay * line.durationDays);
      const available = fefo?.quantityRemaining ?? 0;
      init[line.id] = {
        batchId: fefo?.id ?? "",
        quantity: Math.min(suggestedQty, available || suggestedQty),
        partialReason: "",
        overrideNote: "",
      };
    }
    setLineState(init);
  }, [prescription, batches, settings, batchesByDrug]);

  if (isLoading || !formulary || !prescription || !batches || !settings) {
    return (
      <PageShell className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </PageShell>
    );
  }

  const state = pharmacyStateOf(prescription.status);

  // Guard: only dispensable once Approved (Cleared).
  if (!finalized && state !== "cleared") {
    return (
      <PageShell maxWidth="2xl" className="space-y-4">
        <Link href={`/pharmacist/review/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to review
        </Link>
        <Card>
          <CardBody className="space-y-2 text-center">
            <AlertTriangle className="mx-auto size-8 text-caution-fg" aria-hidden="true" />
            <p className="font-medium text-foreground">Not ready to dispense</p>
            <p className="text-sm text-muted-foreground">This prescription must be Approved in Review before it can be dispensed.</p>
            <Link href={`/pharmacist/review/${id}`}>
              <Button className="mt-2">Go to review</Button>
            </Link>
          </CardBody>
        </Card>
      </PageShell>
    );
  }

  function setLine(lineId: string, patch: Partial<LineState>) {
    setLineState((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));
  }

  // Validation across all lines.
  const lineChecks = prescription.drugs.map((line) => {
    const drug = formulary.drugs.find((d) => d.id === line.drugId);
    const drugBatches = batchesByDrug.get(line.drugId) ?? [];
    const dispensable = drugBatches.filter((b) => isDispensable(b, nearExpiryDays));
    const totalStock = totalDispensableStock(drugBatches, nearExpiryDays);
    const suggestedQty = Math.max(1, line.frequencyPerDay * line.durationDays);
    const ls = lineState[line.id] ?? { batchId: "", quantity: 0, partialReason: "", overrideNote: "" };
    const batch = drugBatches.find((b) => b.id === ls.batchId) ?? null;
    const batchOk = !!batch && isDispensable(batch, nearExpiryDays);
    const qtyOk = ls.quantity > 0 && !!batch && ls.quantity <= batch.quantityRemaining;
    const isPartial = ls.quantity < suggestedQty;
    const partialReasonOk = !isPartial || ls.partialReason.trim().length > 0;
    const verdictResult = verdictsByLineId.get(line.id);
    const flagged = !!verdictResult && verdictResult.verdict !== "safe";
    const overrideOk = !flagged || isGenuineOverrideNote(ls.overrideNote);
    return { line, drug, drugBatches, dispensable, totalStock, suggestedQty, ls, batch, batchOk, qtyOk, isPartial, partialReasonOk, verdictResult, flagged, overrideOk };
  });

  const canDispense = lineChecks.every((c) => c.drug && c.batchOk && c.qtyOk && c.partialReasonOk && c.overrideOk);

  async function handleFinalize() {
    if (!prescription || !user) return;
    setDispenseErrors({});
    const items: LabelItem[] = [];
    const verifications: VerificationItem[] = [];
    for (const c of lineChecks) {
      if (!c.drug || !c.batch) continue;
      try {
        const rec = await createDispense.mutateAsync({
          prescriptionId: id,
          lineId: c.line.id,
          batchId: c.batch.id,
          quantity: c.ls.quantity,
          ...(c.isPartial ? { partialDispenseReason: c.ls.partialReason.trim() } : {}),
          ...(c.flagged ? { overrideNote: c.ls.overrideNote.trim() } : {}),
        });
        items.push({ drug: c.drug, line: c.line, batch: c.batch, quantity: c.ls.quantity });
        verifications.push({ drug: c.drug, line: c.line, record: rec });
      } catch (e) {
        const message = e instanceof DispenseError ? e.body.message : "Dispense failed.";
        setDispenseErrors((prev) => ({ ...prev, [c.line.id]: message }));
        showToast({ title: "Dispense failed", description: `${c.drug.generic_name}: ${message}`, variant: "error" });
        return;
      }
    }
    await appendAction.mutateAsync({ prescriptionId: id, pharmacistId: user.id, action: "dispense" });
    // No separate status update here — dispense_drug() now flips
    // prescriptions.status to "dispensed" itself, atomically, as of
    // 0015_close_raw_dispense_status_bypass.sql. A pharmacist's own RLS-gated
    // session can no longer set that status via a raw update at all.
    setDispensedItems(items);
    setVerificationItems(verifications);
    setFinalized(true);
    showToast({ title: "Dispensed", description: "Inventory updated and verification recorded.", variant: "success" });
  }

  if (finalized) {
    return (
      <PageShell className="space-y-5">
        <Card>
          <CardBody className="space-y-2 text-center">
            <CheckCircle2 className="mx-auto size-10 text-safe-fg" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-foreground">Dispensed to {patient?.name ?? "patient"}</h1>
            <p className="text-sm text-muted-foreground">Inventory decremented and the transaction logged. Print the label &amp; counseling handout for the patient, and the verification record for the pharmacy file.</p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Button onClick={() => printDispenseHandout(patient ?? null, dispensedItems)}>
                <Printer className="size-5" aria-hidden="true" />
                Print label &amp; handout
              </Button>
              <Button
                variant="secondary"
                onClick={() => printVerificationProof(patient ?? null, verificationItems, { name: user?.name ?? "Unknown", id: user?.id ?? "" })}
              >
                <ShieldAlert className="size-5" aria-hidden="true" />
                Print verification record
              </Button>
              <Link href="/prescriptions">
                <Button variant="secondary">
                  <Home className="size-5" aria-hidden="true" />
                  Back to prescriptions
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Patient counseling</h2>
            <div className="stagger">
              {dispensedItems.map((item) => (
                <div key={item.line.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <CounselingSheet drug={item.drug} line={item.line} />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-5">
      <Link href={`/pharmacist/review/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to review
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dispense — {patient?.name ?? "patient"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Batch defaults to First-Expiry-First-Out. Expired stock is excluded and cannot be dispensed. Every line is re-screened at the moment of dispense.</p>
      </div>

      <div className="stagger space-y-3">
        {lineChecks.map((c) => {
          if (!c.drug) return null;
          const noStock = c.dispensable.length === 0;
          return (
            <Card key={c.line.id}>
              <CardBody className="space-y-3">
                <div className="flex items-start gap-4">
                  {c.verdictResult && (
                    <VerdictMark verdict={c.verdictResult.verdict} flags={c.verdictResult.flags} size="seal" className="mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{c.drug.generic_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Prescribed: {c.line.doseMg}mg · {c.line.frequencyPerDay}×/day · {c.line.durationDays} days → suggest {c.suggestedQty} units
                        </p>
                      </div>
                      <Badge tone={c.totalStock === 0 ? "blocked" : c.totalStock < 20 ? "caution" : "safe"}>
                        {c.totalStock} dispensable in stock
                      </Badge>
                    </div>

                    {c.flagged && c.verdictResult && (
                      <div className={cn("space-y-2 rounded-lg px-4 py-3 text-sm", FLAGGED_BOX_CLASS[c.verdictResult.verdict])}>
                        <p className="flex items-center gap-1.5 font-medium">
                          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
                          Screening flagged this drug — dispensing is blocked without a genuine override note.
                        </p>
                        <ul className="space-y-1.5">
                          {c.verdictResult.flags.map((f, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <FlagSeverityChip severity={f.severity} />
                              <div>
                                <span className="text-secondary">{f.audience_variant.clinical}</span>
                                {f.referenceSource && (
                                  <p className="mt-0.5 text-xs opacity-80">Source: {f.referenceSource}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-secondary">
                            Override note <span className="text-blocked-fg">*</span>
                          </label>
                          <Textarea
                            value={c.ls.overrideNote}
                            onChange={(e) => setLine(c.line.id, { overrideNote: e.target.value })}
                            rows={3}
                            placeholder="Explain why you're proceeding despite this flag — this will be printed verbatim on the verification record."
                          />
                          {c.ls.overrideNote.trim().length > 0 && !isGenuineOverrideNote(c.ls.overrideNote) && (
                            <p className="mt-1 text-xs text-blocked-fg">Too short or too generic — give a real, specific reason.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {noStock ? (
                  <div className="space-y-2 rounded-lg bg-blocked-bg px-4 py-3 text-sm text-blocked-fg">
                    <p>Out of dispensable stock (all batches expired, recalled, or empty).</p>
                    {(() => {
                      const subs = suggestSubstitutes(c.drug, formulary.drugs, batches, nearExpiryDays);
                      if (subs.length === 0) return <p className="text-secondary">No in-stock alternatives found — restock or refer back to the prescriber.</p>;
                      return (
                        <div className="text-secondary">
                          <p className="font-medium">Suggested in-stock alternatives (pharmacist to confirm):</p>
                          <ul className="mt-1 space-y-0.5">
                            {subs.map((s) => (
                              <li key={s.drug.id}>
                                {s.drug.generic_name} — {s.dispensable} in stock{" "}
                                <span className="text-subtle">({s.reason === "eml_alternative" ? "EML alternative" : "same class"})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-secondary">Batch (FEFO)</label>
                      <Select value={c.ls.batchId} onChange={(e) => setLine(c.line.id, { batchId: e.target.value })}>
                        {c.dispensable
                          .slice()
                          .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.batchNumber} · exp {b.expiryDate} · {b.quantityRemaining} left
                              {effectiveBatchStatus(b, nearExpiryDays) === "near_expiry" ? " · near expiry" : ""}
                            </option>
                          ))}
                      </Select>
                      {c.batch && effectiveBatchStatus(c.batch, nearExpiryDays) === "near_expiry" && (
                        <p className="mt-1 text-xs text-caution-fg">Near-expiry batch — prioritised by FEFO.</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-secondary">Quantity to dispense</label>
                      <Input
                        type="number"
                        min={1}
                        max={c.batch?.quantityRemaining ?? undefined}
                        value={c.ls.quantity}
                        onChange={(e) => setLine(c.line.id, { quantity: Number(e.target.value) })}
                      />
                      {c.batch && c.ls.quantity > c.batch.quantityRemaining && (
                        <p className="mt-1 text-xs text-blocked-fg">Exceeds this batch&rsquo;s {c.batch.quantityRemaining} units.</p>
                      )}
                    </div>
                  </div>
                )}

                {!noStock && c.isPartial && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-secondary">
                      Partial dispense reason <span className="text-blocked-fg">*</span>
                    </label>
                    <Input
                      value={c.ls.partialReason}
                      onChange={(e) => setLine(c.line.id, { partialReason: e.target.value })}
                      placeholder="e.g. Only 10 units in stock; patient to collect balance."
                    />
                  </div>
                )}

                {dispenseErrors[c.line.id] && (
                  <p className="text-sm text-blocked-fg">{dispenseErrors[c.line.id]}</p>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-background/80 py-4 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {canDispense ? "Ready to dispense." : "Resolve the highlighted items to continue."}
        </p>
        <Button size="lg" onClick={handleFinalize} disabled={!canDispense || createDispense.isPending}>
          Dispense &amp; finalize
        </Button>
      </div>
    </PageShell>
  );
}
