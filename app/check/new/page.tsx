"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DrugPicker } from "@/components/patient-check/DrugPicker";
import { ProfileStep } from "@/components/patient-check/ProfileStep";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useCreatePatientCheck } from "@/lib/query/hooks/usePatientChecks";
import { useLocalPatientProfile, useSaveLocalPatientProfile } from "@/lib/query/hooks/usePatientProfile";
import { screenDrugLine } from "@/lib/screening-engine";
import { buildSyntheticPatient } from "@/lib/patient-check/buildSyntheticPatient";
import { buildDefaultLine } from "@/lib/prescription/lineDefaults";
import type { Drug, PatientCheckProfile, PrescriptionDrugLine } from "@/lib/types";

type Step = "add" | "profile";

const EMPTY_PROFILE: PatientCheckProfile = {
  ageYears: null,
  weightKg: null,
  allergies: null,
  activeMedications: null,
};

export default function NewCheckPage() {
  const router = useRouter();
  const { data: formulary } = useFormulary();
  const { data: savedProfile } = useLocalPatientProfile();
  const createCheck = useCreatePatientCheck();
  const saveProfile = useSaveLocalPatientProfile();

  const [step, setStep] = useState<Step>("add");
  const [addedDrugs, setAddedDrugs] = useState<Drug[]>([]);
  const [profile, setProfile] = useState<PatientCheckProfile>(EMPTY_PROFILE);
  const [rememberProfile, setRememberProfile] = useState(true);
  const [profileInitialized, setProfileInitialized] = useState(false);

  if (!profileInitialized && savedProfile) {
    setProfile({
      ageYears: savedProfile.ageYears,
      weightKg: savedProfile.weightKg,
      allergies: savedProfile.allergies,
      activeMedications: savedProfile.activeMedications,
    });
    setProfileInitialized(true);
  }

  function handleSeeResult() {
    if (!formulary || addedDrugs.length === 0) return;

    const lines: PrescriptionDrugLine[] = addedDrugs.map((drug) => buildDefaultLine(drug));
    const syntheticPatient = buildSyntheticPatient(profile);
    const verdicts = lines.map((line) =>
      screenDrugLine({ patient: syntheticPatient, drugLine: line, otherLines: lines, formulary })
    );

    if (rememberProfile) {
      saveProfile.mutate(profile);
    }

    createCheck.mutate(
      {
        // A real UUID, not a prefixed generateId() string: this id and the
        // shareToken below are the entire access-control mechanism for the
        // anonymous get_patient_check_by_id/by_share_token RPCs — anyone who
        // guesses one can read that check's data, so they must be
        // cryptographically unguessable, not just unique.
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        drugs: lines,
        profile,
        verdicts,
        shareToken: crypto.randomUUID(),
      },
      {
        onSuccess: (check) => router.push(`/check/result/${check.id}`),
      }
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => (step === "profile" ? setStep("add") : router.push("/check"))}
          aria-label="Back"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-brand transition-all"
              style={{ width: step === "add" ? "50%" : "100%" }}
            />
          </div>
        </div>
      </div>

      {step === "add" && (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">What did you get?</h1>
            <p className="mt-1 text-sm text-secondary">
              Add every medicine from this prescription or purchase.
            </p>
          </div>
          <DrugPicker
            addedDrugs={addedDrugs}
            onAdd={(drug) => setAddedDrugs((prev) => (prev.some((d) => d.id === drug.id) ? prev : [...prev, drug]))}
            onRemove={(drugId) => setAddedDrugs((prev) => prev.filter((d) => d.id !== drugId))}
          />
          <Button size="lg" className="w-full" disabled={addedDrugs.length === 0} onClick={() => setStep("profile")}>
            Continue
            <ArrowRight className="size-5" aria-hidden="true" />
          </Button>
        </div>
      )}

      {step === "profile" && formulary && (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Tell us a bit about you</h1>
            <p className="mt-1 text-sm text-secondary">
              This is optional, but it makes the check much more accurate.
            </p>
          </div>
          <ProfileStep profile={profile} onChange={setProfile} knownDrugs={formulary.drugs} />
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              checked={rememberProfile}
              onChange={(e) => setRememberProfile(e.target.checked)}
              className="size-4 rounded border-border-strong"
            />
            Save this info on this device for next time
          </label>
          <Button
            size="lg"
            className="w-full"
            onClick={handleSeeResult}
            disabled={createCheck.isPending}
          >
            {createCheck.isPending ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                Checking…
              </>
            ) : (
              "See my result"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
