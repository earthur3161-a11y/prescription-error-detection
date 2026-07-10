"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Trash2, User } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProfileStep } from "@/components/patient-check/ProfileStep";
import { getPatientGuidance } from "@/lib/patient-check/guidance";
import { buildSyntheticPatient } from "@/lib/patient-check/buildSyntheticPatient";
import { overallVerdict, screenDrugLine } from "@/lib/screening-engine";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { usePatientChecks } from "@/lib/query/hooks/usePatientChecks";
import {
  useClearLocalPatientProfile,
  useLocalPatientProfile,
  useSaveLocalPatientProfile,
} from "@/lib/query/hooks/usePatientProfile";
import { formatDateTime } from "@/lib/utils/date";
import type { PatientCheckProfile } from "@/lib/types";

const EMPTY_PROFILE: PatientCheckProfile = {
  ageYears: null,
  weightKg: null,
  allergies: null,
  activeMedications: null,
};

export default function CheckHistoryPage() {
  const { data: profile, isLoading: profileLoading } = useLocalPatientProfile();
  const { data: checks, isLoading: checksLoading } = usePatientChecks();
  const { data: formulary } = useFormulary();
  const saveProfile = useSaveLocalPatientProfile();
  const clearProfile = useClearLocalPatientProfile();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PatientCheckProfile>(EMPTY_PROFILE);

  function startEditing() {
    setDraft(
      profile
        ? {
            ageYears: profile.ageYears,
            weightKg: profile.weightKg,
            allergies: profile.allergies,
            activeMedications: profile.activeMedications,
          }
        : EMPTY_PROFILE
    );
    setEditing(true);
  }

  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-xl font-semibold text-foreground">My health profile & checks</h1>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <User className="size-5 text-brand" aria-hidden="true" />
              My health profile
            </h2>
            {!editing && (
              <Button size="sm" variant="secondary" onClick={startEditing}>
                {profile ? "Edit" : "Set up"}
              </Button>
            )}
          </div>

          {profileLoading && <Loader2 className="size-5 animate-spin text-subtle" />}

          {!editing && !profileLoading && !profile && (
            <p className="text-sm text-muted-foreground">
              You haven&rsquo;t saved a profile yet. Setting one up makes future checks faster and more
              accurate.
            </p>
          )}

          {!editing && profile && (
            <div className="space-y-1 text-sm text-secondary">
              <p>Age: {profile.ageYears ?? "not set"}</p>
              <p>Weight: {profile.weightKg ? `${profile.weightKg}kg` : "not set"}</p>
              <p>
                Allergies:{" "}
                {profile.allergies === null
                  ? "not sure / not answered"
                  : profile.allergies.length === 0
                    ? "none known"
                    : profile.allergies.map((a) => a.allergen).join(", ")}
              </p>
              <p>
                Other medicines:{" "}
                {profile.activeMedications === null
                  ? "not sure / not answered"
                  : profile.activeMedications.length === 0
                    ? "none"
                    : `${profile.activeMedications.length} on file`}
              </p>
              <button
                onClick={() => clearProfile.mutate()}
                className="mt-2 flex items-center gap-1.5 text-sm text-blocked-fg hover:underline"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Delete my saved profile
              </button>
            </div>
          )}

          {editing && formulary && (
            <div className="space-y-4">
              <ProfileStep profile={draft} onChange={setDraft} knownDrugs={formulary.drugs} />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    saveProfile.mutate(draft, { onSuccess: () => setEditing(false) });
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-3 font-semibold text-foreground">Past checks on this device</h2>
        {checksLoading && <Loader2 className="size-5 animate-spin text-subtle" />}
        {!checksLoading && (checks?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No checks yet on this device.</p>
        )}
        <div className="space-y-3">
          {(checks ?? []).map((check) => {
            // Re-screen against the current formulary so the headline matches
            // the (also re-screened) result page rather than a stale snapshot.
            const verdict = formulary
              ? overallVerdict(
                  check.drugs.map((line) =>
                    screenDrugLine({
                      patient: buildSyntheticPatient(check.profile),
                      drugLine: line,
                      otherLines: check.drugs,
                      formulary,
                    })
                  )
                )
              : overallVerdict(check.verdicts);
            const guidance = getPatientGuidance(verdict);
            return (
              <Link key={check.id} href={`/check/result/${check.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardBody>
                    <p className="text-sm text-muted-foreground">{formatDateTime(check.createdAt)}</p>
                    <p className="mt-0.5 font-medium text-foreground">{guidance.headline}</p>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
