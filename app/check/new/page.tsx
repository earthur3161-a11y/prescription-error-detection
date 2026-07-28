"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DrugPicker } from "@/components/patient-check/DrugPicker";
import { ProfileStep } from "@/components/patient-check/ProfileStep";
import { ResumeCheckPrompt } from "@/components/patient-check/ResumeCheckPrompt";
import { UnlockCheckStep } from "@/components/patient-check/UnlockCheckStep";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useCheckQuota } from "@/lib/query/hooks/useCheckQuota";
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

// sessionStorage, deliberately not localStorage — this is a same-tab-session
// convenience for surviving an accidental refresh/close-reopen, not a
// permanent record. It must not follow the patient to another device or
// linger indefinitely. Drug objects aren't stored directly (avoids a stale
// duplicate of formulary data); only ids, re-resolved against the loaded
// formulary on rehydrate.
const DRAFT_STORAGE_KEY = "mediguard:self-check-draft:v1";

interface PersistedCheckDraft {
  drugIds: string[];
  profile: PatientCheckProfile;
}

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
  // Drug ids from a rehydrated draft, awaiting resolution against the
  // formulary (which loads asynchronously) — see the effect below.
  const [pendingDraftDrugIds, setPendingDraftDrugIds] = useState<string[] | null>(null);
  // Guards the persist-to-sessionStorage effect: it must never fire before
  // rehydration has had its one chance to run, or it would immediately
  // overwrite a real in-progress draft with the initial empty state.
  const [draftHydrated, setDraftHydrated] = useState(false);
  // Stable per attempt so a payment-poll retry replays the same
  // create_patient_check_with_quota call instead of spending a second
  // credit; regenerated whenever the patient goes back and could change
  // what's being screened.
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());
  // Set once the patient confirms a phone via the "already paid for a
  // check?" prompt (add/profile steps) — lets a returning patient whose
  // payment succeeded but whose tab never saw it skip straight to "See my
  // result" at the unlock step, instead of re-entering phone + OTP again on
  // top of the drug list/profile they already had to redo.
  const [resumePhone, setResumePhone] = useState<string | null>(null);
  const resumeQuota = useCheckQuota(resumePhone);
  const resumeHasCredit = (resumeQuota.data?.paidAvailable ?? 0) > 0 || (resumeQuota.data?.freeRemaining ?? 0) > 0;

  // Priority order: an in-progress draft from THIS abandoned attempt (more
  // recent, sessionStorage) beats a profile saved from an earlier
  // *successful* check (older, Dexie via savedProfile). Runs synchronously
  // during render, same pattern the savedProfile fallback already used, so
  // it resolves before the savedProfile branch below gets a chance to win
  // the race on a render where both are available. `typeof window` guards
  // the SSR pass, where sessionStorage doesn't exist — this block simply
  // no-ops there and re-runs on the first client render instead.
  if (!profileInitialized && typeof window !== "undefined") {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) {
      try {
        const draft = JSON.parse(raw) as PersistedCheckDraft;
        setProfile(draft.profile);
        setPendingDraftDrugIds(draft.drugIds);
      } catch {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      }
      setProfileInitialized(true);
    } else if (savedProfile) {
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
  }

  // Resolves the draft's drug ids against the formulary once it's loaded,
  // then flips draftHydrated — the signal the persist effect below waits
  // on. Runs even when there's no pending draft, so a patient with nothing
  // to rehydrate doesn't block persistence forever.
  useEffect(() => {
    if (draftHydrated || !formulary) return;
    if (pendingDraftDrugIds) {
      const drugs = pendingDraftDrugIds
        .map((id) => formulary.drugs.find((d) => d.id === id))
        .filter((d): d is Drug => !!d);
      setAddedDrugs(drugs);
      setPendingDraftDrugIds(null);
    }
    setDraftHydrated(true);
  }, [draftHydrated, formulary, pendingDraftDrugIds]);

  // Persists on every change, but only once initial hydration has settled
  // (see above) and only once there's actually a drug added — matches the
  // step-"add" Continue button's own gate, so an empty draft (nothing past
  // the first screen) never lingers in sessionStorage.
  useEffect(() => {
    if (!draftHydrated || typeof window === "undefined") return;
    if (addedDrugs.length === 0) {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    const draft: PersistedCheckDraft = { drugIds: addedDrugs.map((d) => d.id), profile };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [draftHydrated, addedDrugs, profile]);

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
            // The check row now exists — this draft's job is done. If it
            // stayed, the sessionStorage entry would rehydrate the NEXT,
            // unrelated check the patient starts in this same tab.
            if (typeof window !== "undefined") sessionStorage.removeItem(DRAFT_STORAGE_KEY);
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
          <ResumeCheckPrompt confirmedPhone={resumePhone} onConfirm={setResumePhone} />
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
          {resumePhone && <ResumeCheckPrompt confirmedPhone={resumePhone} onConfirm={setResumePhone} />}
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

      {step === "unlock" && (
        <UnlockCheckStep
          onUnlocked={handleUnlocked}
          unlocking={createCheck.isPending}
          initialPhone={resumeHasCredit ? resumePhone : null}
        />
      )}
    </div>
  );
}
