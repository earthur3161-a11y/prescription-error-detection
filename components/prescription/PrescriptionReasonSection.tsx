"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { useUpdatePatient } from "@/lib/query/hooks/useUpdatePatient";
import { useToastStore } from "@/lib/store/toast-store";
import { PATIENT_CONDITIONS } from "@/lib/patient-check/conditions";
import type { Patient } from "@/lib/types";

const CONDITION_OPTIONS = PATIENT_CONDITIONS.map((c) => ({ value: c, label: c }));

interface PrescriptionReasonSectionProps {
  patient: Patient;
  /** Only the owning prescriber can persist this (patients_update_own, 0004) — everyone else sees it read-only. */
  editable: boolean;
}

/**
 * Captures why this patient is being prescribed to, feeding directly into
 * the screening engine's existing indication check (lib/screening-engine/
 * checks/indicationCheck.ts) — that check has always cross-referenced
 * patient.reportedConditions against each drug line's class, but nothing in
 * the Physician Portal's own patient intake ever populated the field (only
 * the separate Patient Self-Check flow did), so it silently never fired for
 * a physician's own patients. No engine change needed — just closing the
 * data-capture gap. Reuses the exact same condition list and component the
 * self-check flow already uses, so "diabetes" means the same thing whichever
 * door a patient came through.
 *
 * Saved straight to the patient record (not held as local prescription
 * state) so it's on file for every future prescription too, not just this
 * one — matches how the self-check flow treats it as a stable profile
 * attribute rather than a one-off form field.
 *
 * Chip selection is tracked in local state and updated the instant a chip
 * is clicked, rather than reading `patient.reportedConditions` straight off
 * the query cache — the save round-trips to Supabase before that prop
 * updates, so without this a click visibly did nothing until the mutation
 * resolved (and reverted back to "unselected" if it failed). Reset from the
 * server value whenever a *different* patient's record loads (the `patient.id
 * !== loadedPatientId` check below, adjusted during render per
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
 * rather than in a useEffect) — a failed save for the *current* patient is
 * reverted explicitly in handleChange's onError instead, since a successful
 * one already leaves `selected` matching what was just persisted.
 */
export function PrescriptionReasonSection({ patient, editable }: PrescriptionReasonSectionProps) {
  const updatePatient = useUpdatePatient();
  const showToast = useToastStore((s) => s.show);
  const [loadedPatientId, setLoadedPatientId] = useState(patient.id);
  const [selected, setSelected] = useState<string[]>(patient.reportedConditions ?? []);

  if (patient.id !== loadedPatientId) {
    setLoadedPatientId(patient.id);
    setSelected(patient.reportedConditions ?? []);
  }

  function handleChange(values: string[]) {
    setSelected(values);
    updatePatient.mutate(
      {
        id: patient.id,
        patient: {
          name: patient.name,
          dob: patient.dob,
          sex: patient.sex,
          phone: patient.phone,
          weightKg: patient.weightKg,
          renalStatus: patient.renalStatus,
          hepaticStatus: patient.hepaticStatus,
          allergies: patient.allergies,
          activeMedications: patient.activeMedications,
          isPregnant: patient.isPregnant,
          reportedConditions: values,
        },
      },
      {
        onError: (err: Error) => {
          setSelected(patient.reportedConditions ?? []);
          showToast({ title: "Couldn't save reason", description: err.message, variant: "error" });
        },
      }
    );
  }

  if (!editable) {
    if (!patient.reportedConditions || patient.reportedConditions.length === 0) return null;
    return (
      <div className="rounded-xl border border-border bg-surface-2 px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-secondary">
          <ClipboardList className="size-4 text-subtle" aria-hidden="true" />
          Reason on file
        </p>
        <p className="mt-1 text-sm text-foreground">{patient.reportedConditions.join(", ")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 px-4 py-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-secondary">
        <ClipboardList className="size-4 text-subtle" aria-hidden="true" />
        Reason for this prescription
        <span className="font-normal text-subtle">
          {updatePatient.isPending ? "— saving…" : "— checked against what you prescribe"}
        </span>
      </p>
      <ChipToggleGroup
        type="multiple"
        size="sm"
        options={CONDITION_OPTIONS}
        values={selected}
        onChange={handleChange}
      />
    </div>
  );
}
