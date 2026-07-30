"use client";

import { useMemo, useState } from "react";
import { PatientContextBar } from "@/components/layout/PatientContextBar";
import { DrugSearchAdd } from "@/components/prescription/DrugSearchAdd";
import { DrugLineList } from "@/components/prescription/DrugLineList";
import { SignSubmitBar } from "@/components/prescription/SignSubmitBar";
import { OverrideModal } from "@/components/prescription/OverrideModal";
import { ScreeningCoverageNotice } from "@/components/prescription/ScreeningCoverageNotice";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePatient } from "@/lib/query/hooks/usePatient";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useCreatePrescription } from "@/lib/query/hooks/useCreatePrescription";
import { useCreateOverrideLog } from "@/lib/query/hooks/useCreateOverrideLog";
import { screenDrugLine, type DrugLineVerdict, type Verdict } from "@/lib/screening-engine";
import { buildDefaultLine } from "@/lib/prescription/lineDefaults";
import type {
  Drug,
  OverrideLog,
  OverrideReasonCode,
  Prescription,
  PrescriptionDrugLine,
  PrescriptionSource,
} from "@/lib/types";

interface PrescriptionBuilderProps {
  title: string;
  subtitle: string;
  prescriberId: string;
  /** null = independent practitioner. Stamped onto the created prescription and patient (when created inline) so RLS scopes them correctly — see 0012_institution_boundary.sql. */
  institutionId: string | null;
  source: PrescriptionSource;
  externalPrescriberName?: string;
  patientCheckId?: string;
  initialPatientId?: string | null;
  initialLines?: PrescriptionDrugLine[];
  allowPatientCreate?: boolean;
  onSubmitted: (prescriptionId: string) => void;
}

/**
 * The core live-screening prescription workspace, shared across the
 * hospital New Prescription flow, pharmacist walk-in entry, and pulling a
 * Patient Self-Check into a real verified prescription. Only patient
 * selection affordances and the resulting record's `source` differ between
 * callers — the screening/override/submit logic is identical everywhere.
 */
export function PrescriptionBuilder({
  title,
  subtitle,
  prescriberId,
  institutionId,
  source,
  externalPrescriberName,
  patientCheckId,
  initialPatientId = null,
  initialLines = [],
  allowPatientCreate = false,
  onSubmitted,
}: PrescriptionBuilderProps) {
  const [patientId, setPatientId] = useState<string | null>(initialPatientId);
  // A real UUID, not a prefixed generateId() string: prescriptions.id is a
  // Postgres uuid primary key now, and override logs reference this id
  // before the prescription row itself is ever written.
  const [prescriptionId, setPrescriptionId] = useState(() => crypto.randomUUID());
  const [lines, setLines] = useState<PrescriptionDrugLine[]>(initialLines);
  const [overrideLogs, setOverrideLogs] = useState<Record<string, OverrideLog>>({});
  const [overrideTarget, setOverrideTarget] = useState<{
    lineId: string;
    verdict: Extract<Verdict, "caution" | "blocked">;
  } | null>(null);

  const { data: patient } = usePatient(patientId);
  const { data: formulary, isLoading: formularyLoading } = useFormulary();
  const createPrescription = useCreatePrescription();
  const createOverrideLog = useCreateOverrideLog();

  const verdicts = useMemo<Record<string, DrugLineVerdict>>(() => {
    if (!formulary) return {};
    const map: Record<string, DrugLineVerdict> = {};
    for (const line of lines) {
      map[line.id] = screenDrugLine({
        patient: patient ?? null,
        drugLine: line,
        otherLines: lines,
        formulary,
      });
    }
    return map;
  }, [lines, patient, formulary]);

  const verdictCounts = useMemo(() => {
    const counts: Record<Verdict, number> = { safe: 0, caution: 0, blocked: 0 };
    for (const line of lines) {
      const v = verdicts[line.id]?.verdict;
      if (v) counts[v] += 1;
    }
    return counts;
  }, [lines, verdicts]);

  const pendingOverrideLineIds = lines
    .filter((l) => verdicts[l.id] && verdicts[l.id].verdict !== "safe" && !overrideLogs[l.id])
    .map((l) => l.id);

  let blockingReason: string | undefined;
  if (!patientId) blockingReason = "Select a patient to begin.";
  else if (lines.length === 0) blockingReason = "Add at least one drug to this prescription.";
  else if (pendingOverrideLineIds.length > 0)
    blockingReason = `${pendingOverrideLineIds.length} line${pendingOverrideLineIds.length === 1 ? "" : "s"} require an override before submitting.`;

  const canSubmit = !!patientId && lines.length > 0 && pendingOverrideLineIds.length === 0;

  function handleAddDrug(drug: Drug) {
    setLines((prev) => [...prev, buildDefaultLine(drug)]);
  }

  function handleChangeLine(updated: PrescriptionDrugLine) {
    setLines((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  function handleRemoveLine(lineId: string) {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
    setOverrideLogs((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  }

  function handleOverrideLine(lineId: string) {
    const verdict = verdicts[lineId]?.verdict;
    if (verdict === "caution" || verdict === "blocked") {
      setOverrideTarget({ lineId, verdict });
    }
  }

  function handleConfirmOverride(reasonCode: OverrideReasonCode, reasonText: string) {
    if (!overrideTarget) return;
    const line = lines.find((l) => l.id === overrideTarget.lineId);
    if (!line) return;

    createOverrideLog.mutate(
      {
        prescriptionId,
        drugId: line.drugId,
        verdictOverridden: overrideTarget.verdict,
        reasonCode,
        reasonText,
        userId: prescriberId,
      },
      {
        onSuccess: (log) => {
          setOverrideLogs((prev) => ({ ...prev, [overrideTarget.lineId]: log }));
          setOverrideTarget(null);
        },
      }
    );
  }

  function handleSubmit() {
    if (!canSubmit || !patientId) return;
    const prescription: Prescription = {
      id: prescriptionId,
      patientId,
      prescriberId,
      drugs: lines,
      verdicts: lines.map((l) => verdicts[l.id]),
      status: "submitted",
      createdAt: new Date().toISOString(),
      source,
      institutionId,
      versionNumber: 1, // always the root of a fresh edit chain
      ...(externalPrescriberName ? { externalPrescriberName } : {}),
      ...(patientCheckId ? { patientCheckId } : {}),
    };
    createPrescription.mutate(prescription, {
      onSuccess: () => onSubmitted(prescription.id),
    });
  }

  const overrideLine = overrideTarget ? lines.find((l) => l.id === overrideTarget.lineId) : null;
  const overrideDrug = overrideLine && formulary ? formulary.drugs.find((d) => d.id === overrideLine.drugId) : null;

  return (
    <div className="flex h-full flex-col">
      <PatientContextBar
        patientId={patientId}
        allowCreate={allowPatientCreate}
        onSelect={(id) => {
          setPatientId(id);
          setOverrideLogs({});
          setPrescriptionId(crypto.randomUUID());
        }}
        onClear={() => {
          setPatientId(null);
          setLines([]);
          setOverrideLogs({});
          setPrescriptionId(crypto.randomUUID());
        }}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {formularyLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-11 w-full max-w-lg" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            {formulary && <ScreeningCoverageNotice formulary={formulary} />}
            <DrugSearchAdd key={patientId} onAdd={handleAddDrug} autoFocus={!!patientId} />
            <DrugLineList
              lines={lines}
              drugs={formulary?.drugs ?? []}
              verdicts={verdicts}
              overrideLogs={overrideLogs}
              onChangeLine={handleChangeLine}
              onRemoveLine={handleRemoveLine}
              onOverrideLine={handleOverrideLine}
            />
          </>
        )}
      </div>

      <SignSubmitBar
        verdictCounts={verdictCounts}
        canSubmit={canSubmit}
        blockingReason={blockingReason}
        submitting={createPrescription.isPending}
        onSubmit={handleSubmit}
      />

      {overrideTarget && overrideDrug && (
        <OverrideModal
          open={!!overrideTarget}
          onOpenChange={(open) => !open && setOverrideTarget(null)}
          drugName={overrideDrug.generic_name}
          verdict={overrideTarget.verdict}
          onConfirm={handleConfirmOverride}
          submitting={createOverrideLog.isPending}
        />
      )}
    </div>
  );
}
