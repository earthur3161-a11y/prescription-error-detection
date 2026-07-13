"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DrugPicker } from "@/components/patient-check/DrugPicker";
import { ProfileStep } from "@/components/patient-check/ProfileStep";
import { UnlockCheckStep } from "@/components/patient-check/UnlockCheckStep";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useCreatePatientCheck } from "@/lib/query/hooks/usePatientChecks";
import { useLocalPatientProfile, useSaveLocalPatientProfile } from "@/lib/query/hooks/usePatientProfile";
import { useToastStore } from "@/lib/store/toast-store";
import { screenDrugLine } from "@/lib/screening-engine";
import { buildSyntheticPatient } from "@/lib/patient-check/buildSyntheticPatient";
import { buildDefaultLine } from "@/lib/prescription/lineDefaults";
import type { Drug, PatientCheckProfile, PrescriptionDrugLine } from "@/lib/types";

type Step = "add" | "profile" | "unlock";

const STEP_PROGRESS: Record<Step, string> = { add: "33%", profile: "66%", unlock: "100%" };
const STEP_NUMBER: Record<Step, number> = { add: 1, profile: 2, unlock: 3 };

const EMPTY_PROFILE: PatientCheckProfile = {
  ageYears: null,
  weightKg: null,
  allergies: null,
  activeMedications: null,
  isPregnant: null,
  renalStatus: "unknown",
  hepaticStatus: "unknown",
  reportedConditions: [],
  complaintNote: null,
};

export default function NewCheckPage() {
  const router = useRouter();
  const { data: formulary } = useFormulary();
  const { data: savedProfile } = useLocalPatientProfile();
  const createCheck = useCreatePatientCheck();
  const saveProfile = useSaveLocalPatientProfile();
  const showToast = useToastStore((s) => s.show);

  const [step, setStep] = useState<Step>("add");
  const [addedDrugs, setAddedDrugs] = useState<Drug[]>([]);
  const [profile, setProfile] = useState<PatientCheckProfile>(EMPTY_PROFILE);
  const [rememberProfile, setRememberProfile] = useState(true);
  const [profileInitialized, setProfileInitialized] = useState(false);
  // Stable per attempt so a payment-poll retry replays the same
  // create_patient_check_with_quota call instead of spending a second
  // credit; regenerated whenever the patient goes back and could change
  // what's being screened.
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());

  if (!profileInitialized && savedProfile) {
    setProfile({
      ageYears: savedProfile.ageYears,
      weightKg: savedProfile.weightKg,
      allergies: savedProfile.allergies,
      activeMedications: savedProfile.activeMedications,
      isPregnant: savedProfile.isPregnant,
      renalStatus: savedProfile.renalStatus,
      hepaticStatus: savedProfile.hepaticStatus,
      reportedConditions: savedProfile.reportedConditions,
      complaintNote: savedProfile.complaintNote,
    });
    setProfileInitialized(true);
  }

  function goBack() {
    if (step === "unlock") {
      setClientRequestId(crypto.randomUUID());
      setStep("profile");
    } else if (step === "profile") {
      setStep("add");
    } else {
      router.push("/check");
    }
  }

  function handleUnlocked(phone: string) {
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
      { phone, drugs: lines, profile, verdicts, clientRequestId },
      {
        onSuccess: (result) => {
          if (result.allowed) {
            router.push(`/check/result/${result.check.id}`);
            return;
          }
          showToast({
            title: result.reason === "not_verified" ? "Verification expired" : "No check available",
            description:
              result.reason === "not_verified"
                ? "Please verify your phone number again."
                : "This phone number doesn't have a free or paid check available.",
            variant: "error",
          });
        },
        onError: (err: Error) => showToast({ title: "Couldn't complete your check", description: err.message, variant: "error" }),
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" aria-label="Back" className="px-1.5" onClick={goBack}>
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Button>
        <div className="flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-brand transition-all" style={{ width: STEP_PROGRESS[step] }} />
          </div>
          <p className="mt-1.5 hidden text-xs font-medium text-subtle sm:block">Step {STEP_NUMBER[step]} of 3</p>
        </div>
      </div>

      {step === "add" && (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">What did you get?</h1>
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
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Tell us a bit about you</h1>
            <p className="mt-1 text-sm text-secondary">
              This is optional, but it makes the check much more accurate.
            </p>
          </div>
          <ProfileStep profile={profile} onChange={setProfile} knownDrugs={formulary.drugs} />
          <label className="flex items-center gap-2 text-sm text-secondary">
            <Checkbox checked={rememberProfile} onChange={(e) => setRememberProfile(e.target.checked)} />
            Save this info on this device for next time
          </label>
          <Button size="lg" className="w-full" onClick={() => setStep("unlock")}>
            Continue
            <ArrowRight className="size-5" aria-hidden="true" />
          </Button>
        </div>
      )}

      {step === "unlock" && <UnlockCheckStep onUnlocked={handleUnlocked} unlocking={createCheck.isPending} />}
    </div>
  );
}
