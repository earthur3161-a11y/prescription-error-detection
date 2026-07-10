"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { screenDrugLine, type DrugLineVerdict } from "@/lib/screening-engine";
import { generateId } from "@/lib/utils/id";
import type { Patient, PrescriptionDrugLine } from "@/lib/types";

interface HostMessage {
  type: "mediguard:screen";
  patient: Partial<Patient>;
  drug: Pick<PrescriptionDrugLine, "drugId" | "doseMg" | "frequencyPerDay" | "durationDays" | "route">;
}

const DEMO_MESSAGE: HostMessage = {
  type: "mediguard:screen",
  patient: {
    dob: "1988-04-12",
    weightKg: 68,
    allergies: [{ allergen: "Penicillin", severity: "severe" }],
    activeMedications: [],
  },
  drug: { drugId: "drug_amoxicillin", doseMg: 500, frequencyPerDay: 3, durationDays: 7, route: "oral" },
};

export default function WidgetScreenPage() {
  return (
    <Suspense fallback={null}>
      <WidgetInner />
    </Suspense>
  );
}

function WidgetInner() {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "1";
  const { data: formulary, isLoading } = useFormulary();
  const [result, setResult] = useState<DrugLineVerdict | null>(null);
  const [drugName, setDrugName] = useState<string | null>(null);

  useEffect(() => {
    function runScreen(msg: HostMessage, bundle: NonNullable<typeof formulary>) {
      const drugLine: PrescriptionDrugLine = {
        id: generateId("line"),
        drugId: msg.drug.drugId,
        form: "tablet",
        strengthMg: msg.drug.doseMg,
        route: msg.drug.route,
        doseMg: msg.drug.doseMg,
        frequencyPerDay: msg.drug.frequencyPerDay,
        durationDays: msg.drug.durationDays,
      };
      const patient: Patient = {
        id: "widget_patient",
        name: "Patient",
        dob: msg.patient.dob ?? "1990-01-01",
        sex: "other",
        weightKg: msg.patient.weightKg ?? null,
        renalStatus: "unknown",
        hepaticStatus: "unknown",
        allergies: msg.patient.allergies ?? null,
        activeMedications: msg.patient.activeMedications ?? null,
      };
      const verdict = screenDrugLine({ patient, drugLine, otherLines: [drugLine], formulary: bundle });
      setResult(verdict);
      setDrugName(bundle.drugs.find((d) => d.id === msg.drug.drugId)?.generic_name ?? msg.drug.drugId);
      window.parent.postMessage({ type: "mediguard:verdict", verdict }, "*");
    }

    function handleMessage(event: MessageEvent) {
      if (!formulary) return;
      const data = event.data as HostMessage;
      if (data?.type === "mediguard:screen") runScreen(data, formulary);
    }

    window.addEventListener("message", handleMessage);
    if (isDemo && formulary) runScreen(DEMO_MESSAGE, formulary);

    return () => window.removeEventListener("message", handleMessage);
  }, [formulary, isDemo]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ShieldCheck className="size-4 text-brand" aria-hidden="true" />
          MediGuard screening
        </div>
        {isLoading && <Skeleton className="h-16 w-full" />}
        {!isLoading && !result && (
          <p className="text-sm text-subtle">Waiting for prescription data from host system…</p>
        )}
        {result && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{drugName}</p>
            <VerdictBadge verdict={result.verdict} />
            {result.flags.length > 0 && (
              <ul className="space-y-1 pt-1">
                {result.flags.slice(0, 2).map((f, i) => (
                  <li key={i} className="text-xs text-secondary">
                    {f.audience_variant.clinical}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
