"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, UserRound, X } from "lucide-react";
import { Combobox } from "@/components/ui/Combobox";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DataIncompleteBanner } from "@/components/patient/DataIncompleteBanner";
import { usePatients } from "@/lib/query/hooks/usePatients";
import { usePatient } from "@/lib/query/hooks/usePatient";
import { useCreatePatient } from "@/lib/query/hooks/useCreatePatient";
import { useAuth } from "@/lib/auth/useAuth";
import { calculateAgeYears } from "@/lib/utils/date";
import type { AllergySeverity } from "@/lib/types";

interface PatientContextBarProps {
  patientId: string | null;
  onSelect: (patientId: string) => void;
  onClear: () => void;
  /** Shows a "quick-add new patient" option — used for walk-in / patient-submitted intake where the patient may not be in the system yet. */
  allowCreate?: boolean;
}

const allergySeverityTone: Record<AllergySeverity, "safe" | "caution" | "blocked"> = {
  mild: "safe",
  moderate: "caution",
  severe: "blocked",
};

function QuickAddPatientForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const createPatient = useCreatePatient();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [ageYears, setAgeYears] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "other">("other");
  const [weightKg, setWeightKg] = useState("");

  function handleCreate() {
    if (!name.trim() || !user) return;
    const birthYear = new Date().getFullYear() - (ageYears ? Number(ageYears) : 30);
    createPatient.mutate(
      {
        patient: {
          name: name.trim(),
          dob: `${birthYear}-01-01`,
          sex,
          weightKg: weightKg ? Number(weightKg) : null,
          renalStatus: "unknown",
          hepaticStatus: "unknown",
          allergies: null,
          activeMedications: null,
        },
        ownerId: user.id,
        institutionId: user.institutionId,
      },
      { onSuccess: (patient) => onCreated(patient.id) }
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-surface-2 p-4">
      <p className="text-sm font-medium text-secondary">New patient record</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="sm:col-span-3" />
        <Input
          type="number"
          placeholder="Age (yrs)"
          value={ageYears}
          onChange={(e) => setAgeYears(e.target.value)}
        />
        <Select value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}>
          <option value="other">Sex: other</option>
          <option value="male">Sex: male</option>
          <option value="female">Sex: female</option>
        </Select>
        <Input
          type="number"
          placeholder="Weight (kg)"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Allergy and medication history will be marked unknown until confirmed on their profile.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleCreate} disabled={!name.trim() || createPatient.isPending}>
          Create & select
        </Button>
      </div>
    </div>
  );
}

export function PatientContextBar({ patientId, onSelect, onClear, allowCreate }: PatientContextBarProps) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: results, isLoading } = usePatients(query);
  const { data: patient } = usePatient(patientId);

  if (!patientId || !patient) {
    return (
      <div className="border-b border-border bg-surface px-4 py-3">
        <label htmlFor="patient-search" className="mb-1.5 block text-sm font-medium text-secondary">
          Patient
        </label>
        <Combobox
          items={results ?? []}
          getKey={(p) => p.id}
          getLabel={(p) => p.name}
          query={query}
          onQueryChange={setQuery}
          onSelect={(p) => onSelect(p.id)}
          loading={isLoading}
          placeholder="Search patient by name…"
          className="max-w-sm"
          emptyMessage="No matching patients."
        />
        {allowCreate && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="mt-2 flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            <Plus className="size-4" aria-hidden="true" />
            Patient not found — create a new record
          </button>
        )}
        {allowCreate && creating && (
          <QuickAddPatientForm onCreated={onSelect} onCancel={() => setCreating(false)} />
        )}
      </div>
    );
  }

  const worstAllergy = (patient.allergies ?? []).reduce<AllergySeverity | null>((worst, a) => {
    const order: Record<AllergySeverity, number> = { mild: 0, moderate: 1, severe: 2 };
    if (!worst || order[a.severity] > order[worst]) return a.severity;
    return worst;
  }, null);

  return (
    <div className="space-y-2.5 border-b border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-brand-subtle text-brand">
            <UserRound className="size-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/patients/${patient.id}`} className="font-semibold text-foreground hover:text-brand">
                {patient.name}
              </Link>
              <span className="text-sm text-muted-foreground">
                {calculateAgeYears(patient.dob)} yrs · {patient.sex} ·{" "}
                {patient.weightKg !== null ? `${patient.weightKg}kg` : "weight unknown"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {patient.allergies === null && (
                <Badge tone="unknown">Allergy data unknown</Badge>
              )}
              {worstAllergy && (
                <Badge tone={allergySeverityTone[worstAllergy]}>
                  {patient.allergies?.length} allerg{patient.allergies?.length === 1 ? "y" : "ies"}
                </Badge>
              )}
              {patient.allergies?.length === 0 && <Badge tone="neutral">No known allergies</Badge>}
              {patient.activeMedications === null && (
                <Badge tone="unknown">Medication data unknown</Badge>
              )}
              {patient.activeMedications && patient.activeMedications.length > 0 && (
                <Badge tone="neutral">{patient.activeMedications.length} active medication(s)</Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-4" aria-hidden="true" />
          Change patient
        </Button>
      </div>
      <DataIncompleteBanner patient={patient} />
    </div>
  );
}
