"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { screenDrugLine, type Flag, type Verdict } from "@/lib/screening-engine";
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

type WidgetState =
  | { status: "waiting" }
  | { status: "missing-key" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "result"; drugName: string; verdict: Verdict; flags: Flag[] };

export default function WidgetScreenPage() {
  return (
    <Suspense fallback={null}>
      <WidgetInner />
    </Suspense>
  );
}

// Flags shown before the list collapses behind "Show N more" — a small
// embedded card can't fit an arbitrarily long list, but silently dropping
// flags past this point (the previous behavior) is not acceptable for a
// clinical safety surface: the host page's postMessage payload always had
// the full list, only the on-page card didn't, so a host relying on the
// visible card alone could miss a real finding with no indication anything
// was cut off.
const VISIBLE_FLAGS_COLLAPSED = 2;

function WidgetInner() {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "1";
  const apiKey = searchParams.get("apiKey");
  // Demo mode is a deliberately unauthenticated, zero-config preview (no real
  // institution data, canned example) — it keeps using the engine locally.
  // Every other embed is a real integration and must go through the
  // authenticated /api/v1/screen endpoint, the same one server-to-server
  // callers use, so it gets the same key check and formulary validation.
  const { data: formulary, isLoading: formularyLoading } = useFormulary();
  const [state, setState] = useState<WidgetState>(
    isDemo ? { status: "waiting" } : apiKey ? { status: "waiting" } : { status: "missing-key" }
  );
  // Reset per result (see the two setState({ status: "result", ... }) call
  // sites below) so a second screening request from the host never inherits
  // an expanded state left over from a previous drug's flag list.
  const [showAllFlags, setShowAllFlags] = useState(false);

  useEffect(() => {
    function runDemoScreen(msg: HostMessage, bundle: NonNullable<typeof formulary>) {
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
        id: "widget_demo_patient",
        name: "Patient",
        dob: msg.patient.dob ?? "1990-01-01",
        sex: "other",
        weightKg: msg.patient.weightKg ?? null,
        renalStatus: "unknown",
        hepaticStatus: "unknown",
        allergies: msg.patient.allergies ?? null,
        activeMedications: msg.patient.activeMedications ?? null,
      };
      const result = screenDrugLine({ patient, drugLine, otherLines: [drugLine], formulary: bundle });
      const drugName = bundle.drugs.find((d) => d.id === msg.drug.drugId)?.generic_name ?? msg.drug.drugId;
      setShowAllFlags(false);
      setState({ status: "result", drugName, verdict: result.verdict, flags: result.flags });
      window.parent.postMessage({ type: "mediguard:verdict", verdict: result }, "*");
    }

    async function runAuthenticatedScreen(msg: HostMessage) {
      if (!apiKey) {
        setState({ status: "missing-key" });
        return;
      }
      setState({ status: "loading" });
      let body: Record<string, unknown>;
      try {
        const res = await fetch("/api/v1/screen", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ patient: msg.patient, drug: msg.drug, otherDrugs: [] }),
        });
        body = await res.json();
        if (!res.ok) {
          const message =
            typeof body.message === "string"
              ? body.message
              : "This screening request could not be completed.";
          setState({ status: "error", message });
          window.parent.postMessage({ type: "mediguard:error", error: body.error ?? "unknown_error" }, "*");
          return;
        }
      } catch {
        setState({ status: "error", message: "Couldn't reach the screening service — check your connection and try again." });
        return;
      }
      // /api/v1/screen's response is flat — verdict is the Verdict string,
      // flags is a sibling field, not nested under verdict (unlike the local
      // engine's DrugLineVerdict shape the demo path below uses). Normalize
      // to the same shape posted to the host either way, so an embedding
      // page sees one consistent event contract regardless of demo mode.
      const verdict = body.verdict as Verdict;
      const flags = body.flags as Flag[];
      setShowAllFlags(false);
      setState({ status: "result", drugName: String(body.drug), verdict, flags });
      window.parent.postMessage(
        {
          type: "mediguard:verdict",
          verdict: { drugId: body.drugId, verdict, flags, screenedAt: body.screenedAt },
        },
        "*"
      );
    }

    function handleMessage(event: MessageEvent) {
      const data = event.data as HostMessage;
      if (data?.type !== "mediguard:screen") return;
      if (isDemo) {
        if (formulary) runDemoScreen(data, formulary);
        return;
      }
      void runAuthenticatedScreen(data);
    }

    window.addEventListener("message", handleMessage);
    if (isDemo && formulary) runDemoScreen(DEMO_MESSAGE, formulary);

    return () => window.removeEventListener("message", handleMessage);
  }, [apiKey, isDemo, formulary]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ShieldCheck className="size-4 text-brand" aria-hidden="true" />
          MediGuard screening
        </div>

        {state.status === "missing-key" && (
          <p className="flex items-start gap-2 text-sm text-blocked-fg">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            This widget needs a valid API key — add <code>?apiKey=mg_live_…</code> (or{" "}
            <code>mg_sandbox_…</code>) to the embed URL.
          </p>
        )}

        {state.status === "waiting" && isDemo && formularyLoading && <Skeleton className="h-16 w-full" />}

        {state.status === "waiting" && !isDemo && (
          <p className="text-sm text-subtle">Waiting for prescription data from host system…</p>
        )}

        {state.status === "loading" && <Skeleton className="h-16 w-full" />}

        {state.status === "error" && (
          <p className="flex items-start gap-2 text-sm text-blocked-fg">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.message}
          </p>
        )}

        {state.status === "result" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{state.drugName}</p>
            <VerdictMark verdict={state.verdict} flags={state.flags} />
            {state.flags.length > 0 && (
              <ul className="space-y-1 pt-1">
                {(showAllFlags ? state.flags : state.flags.slice(0, VISIBLE_FLAGS_COLLAPSED)).map((f, i) => (
                  <li key={i} className="text-xs text-secondary">
                    {f.audience_variant.clinical}
                  </li>
                ))}
              </ul>
            )}
            {!showAllFlags && state.flags.length > VISIBLE_FLAGS_COLLAPSED && (
              <button
                type="button"
                onClick={() => setShowAllFlags(true)}
                className="text-xs font-medium text-brand hover:underline"
              >
                Show {state.flags.length - VISIBLE_FLAGS_COLLAPSED} more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
