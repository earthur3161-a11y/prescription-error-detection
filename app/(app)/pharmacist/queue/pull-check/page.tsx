"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { PrescriptionBuilder } from "@/components/prescription/PrescriptionBuilder";
import { QrScanButton } from "@/components/pharmacy/QrScanButton";
import { usePatientCheckByShareToken, useMarkPatientCheckPulled } from "@/lib/query/hooks/usePatientChecks";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useAuth } from "@/lib/auth/useAuth";
import { formatDateTime } from "@/lib/utils/date";

function extractToken(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/check\/shared\/([^/?#]+)/);
  return match ? match[1] : trimmed;
}

function PullPatientCheckInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  // Support arriving from a QR scan with ?token=… — seed the lookup from the URL
  // on first render (no setState-in-effect).
  const initialToken = searchParams.get("token") ?? "";
  const [input, setInput] = useState(initialToken);
  const [lookupToken, setLookupToken] = useState<string | null>(initialToken ? extractToken(initialToken) : null);
  const [confirmed, setConfirmed] = useState(false);

  const { data: check, isLoading, isFetched } = usePatientCheckByShareToken(lookupToken);
  const { data: formulary } = useFormulary();
  const markPulled = useMarkPatientCheckPulled();

  if (!user) return null;

  if (confirmed && check) {
    return (
      <PrescriptionBuilder
        title="Verify patient-submitted check"
        subtitle="Confirm the real patient record — we'll re-check everything against their on-file history."
        prescriberId={user.id}
        source="patient_submitted"
        patientCheckId={check.id}
        initialLines={check.drugs}
        allowPatientCreate
        onSubmitted={(id) => {
          markPulled.mutate({ id: check.id, prescriptionId: id });
          router.push(`/pharmacist/review/${id}`);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6 sm:p-8">
      <button
        onClick={() => router.push("/pharmacist/queue")}
        className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to queue
      </button>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Scan or enter a prescription code</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan the QR from the patient&rsquo;s MediGuard self-check (or an Institution-Mode script), or
          paste the code/link.
        </p>
      </div>

      <QrScanButton onResult={(text) => { setInput(text); setLookupToken(extractToken(text)); }} />

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste the link or code…"
        />
        <Button onClick={() => setLookupToken(extractToken(input))} disabled={!input.trim()}>
          <Search className="size-4" aria-hidden="true" />
          Find
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Looking up…</p>}
      {isFetched && !check && lookupToken && (
        <p className="text-sm text-blocked-fg">No check found for that code — double-check with the patient.</p>
      )}

      {check && formulary && (
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm text-muted-foreground">Submitted {formatDateTime(check.createdAt)}</p>
            <div className="flex flex-wrap gap-2">
              {check.drugs.map((line) => {
                const drug = formulary.drugs.find((d) => d.id === line.drugId);
                return (
                  <Badge key={line.id} tone="neutral">
                    {drug?.generic_name ?? line.drugId}
                  </Badge>
                );
              })}
            </div>
            <p className="text-sm text-secondary">
              Self-reported: age {check.profile.ageYears ?? "unknown"}, weight{" "}
              {check.profile.weightKg ? `${check.profile.weightKg}kg` : "unknown"},{" "}
              {check.profile.allergies === null
                ? "allergy status unknown"
                : `${check.profile.allergies.length} allerg${check.profile.allergies.length === 1 ? "y" : "ies"} reported`}
              .
            </p>
            {check.pulledIntoPrescriptionId && (
              <p className="text-sm text-caution-fg">
                This check has already been pulled into a prescription.
              </p>
            )}
            <Button className="w-full" onClick={() => setConfirmed(true)}>
              Confirm patient identity & continue
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

export default function PullPatientCheckPage() {
  return (
    <Suspense fallback={null}>
      <PullPatientCheckInner />
    </Suspense>
  );
}
