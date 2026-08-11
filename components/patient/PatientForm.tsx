"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, Pill, ShieldAlert, User, X } from "lucide-react";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useDrugSearchFuzzy, useFormulary } from "@/lib/query/hooks/useFormulary";
import { useCreatePatient } from "@/lib/query/hooks/useCreatePatient";
import { useUpdatePatient } from "@/lib/query/hooks/useUpdatePatient";
import { useAuth } from "@/lib/auth/useAuth";
import type { AllergyRecord, AllergySeverity, Patient } from "@/lib/types";

const COMMON_ALLERGENS = [
  "Penicillin",
  "Cephalosporins",
  "Sulfa drugs",
  "NSAIDs/Aspirin",
  "Fluoroquinolones",
  "Macrolides",
];

type TriState = "none" | "yes" | "unsure";

function triOptions(yesLabel: string, noLabel = "No, none", unsureLabel = "Not sure") {
  return [
    { value: "none", label: noLabel },
    { value: "yes", label: yesLabel },
    { value: "unsure", label: unsureLabel },
  ];
}

interface SectionProps {
  icon: typeof User;
  title: string;
  first?: boolean;
  children: ReactNode;
}

function Section({ icon: Icon, title, first, children }: SectionProps) {
  return (
    <section className={first ? "space-y-3" : "space-y-3 border-t border-border pt-7"}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-subtle">
          <Icon className="size-4 text-brand" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="space-y-5 pl-[42px]">{children}</div>
    </section>
  );
}

type DraftPatient = Omit<Patient, "id" | "ownerId">;

const EMPTY_DRAFT: DraftPatient = {
  name: "",
  dob: "",
  sex: "female",
  phone: "",
  weightKg: null,
  renalStatus: "unknown",
  hepaticStatus: "unknown",
  allergies: null,
  activeMedications: null,
  isPregnant: null,
};

function draftFrom(patient: Patient): DraftPatient {
  return {
    name: patient.name,
    dob: patient.dob,
    sex: patient.sex,
    phone: patient.phone ?? "",
    weightKg: patient.weightKg,
    renalStatus: patient.renalStatus,
    hepaticStatus: patient.hepaticStatus,
    allergies: patient.allergies,
    activeMedications: patient.activeMedications,
    isPregnant: patient.isPregnant ?? null,
  };
}

function triFromList<T>(list: T[] | null): TriState {
  if (list === null) return "unsure";
  return list.length > 0 ? "yes" : "none";
}

function triFromBool(value: boolean | null | undefined): TriState {
  if (value === null || value === undefined) return "unsure";
  return value ? "yes" : "none";
}

function triFromStatus(status: Patient["renalStatus"]): TriState {
  if (status === "unknown") return "unsure";
  return status === "impaired" ? "yes" : "none";
}

interface PatientFormProps {
  /** Present = editing this existing patient; absent = creating a new one. */
  patient?: Patient;
}

export function PatientForm({ patient }: PatientFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const { data: formulary } = useFormulary();

  const [draft, setDraft] = useState<DraftPatient>(() => (patient ? draftFrom(patient) : EMPTY_DRAFT));
  const [allergyState, setAllergyState] = useState<TriState>(() => triFromList(patient?.allergies ?? null));
  const [allergenText, setAllergenText] = useState("");
  const [allergenSeverity, setAllergenSeverity] = useState<AllergySeverity>("moderate");
  const [medsState, setMedsState] = useState<TriState>(() => triFromList(patient?.activeMedications ?? null));
  const [medQuery, setMedQuery] = useState("");
  const { data: medResults, isLoading: medsLoading } = useDrugSearchFuzzy(medQuery);
  const [pregnancyState, setPregnancyState] = useState<TriState>(() => triFromBool(patient?.isPregnant));
  const [renalState, setRenalState] = useState<TriState>(() => triFromStatus(patient?.renalStatus ?? "unknown"));
  const [hepaticState, setHepaticState] = useState<TriState>(() => triFromStatus(patient?.hepaticStatus ?? "unknown"));

  const isEditing = !!patient;
  const saving = isEditing ? updatePatient.isPending : createPatient.isPending;

  function setAllergyTriState(v: string) {
    const state = v as TriState;
    setAllergyState(state);
    if (state === "none") setDraft((d) => ({ ...d, allergies: [] }));
    else if (state === "unsure") setDraft((d) => ({ ...d, allergies: null }));
    else if (draft.allergies === null) setDraft((d) => ({ ...d, allergies: [] }));
  }

  function setMedsTriState(v: string) {
    const state = v as TriState;
    setMedsState(state);
    if (state === "none") setDraft((d) => ({ ...d, activeMedications: [] }));
    else if (state === "unsure") setDraft((d) => ({ ...d, activeMedications: null }));
    else if (draft.activeMedications === null) setDraft((d) => ({ ...d, activeMedications: [] }));
  }

  function setPregnancyTriState(v: string) {
    const state = v as TriState;
    setPregnancyState(state);
    setDraft((d) => ({ ...d, isPregnant: state === "yes" ? true : state === "none" ? false : null }));
  }

  function setRenalTriState(v: string) {
    const state = v as TriState;
    setRenalState(state);
    setDraft((d) => ({ ...d, renalStatus: state === "yes" ? "impaired" : state === "none" ? "normal" : "unknown" }));
  }

  function setHepaticTriState(v: string) {
    const state = v as TriState;
    setHepaticState(state);
    setDraft((d) => ({ ...d, hepaticStatus: state === "yes" ? "impaired" : state === "none" ? "normal" : "unknown" }));
  }

  function addAllergen(allergen: string, severity: AllergySeverity) {
    const trimmed = allergen.trim();
    if (!trimmed) return;
    const existing = draft.allergies ?? [];
    if (existing.some((a) => a.allergen.toLowerCase() === trimmed.toLowerCase())) {
      setAllergenText("");
      return;
    }
    const record: AllergyRecord = { allergen: trimmed, severity };
    setDraft((d) => ({ ...d, allergies: [...existing, record] }));
    setAllergenText("");
  }

  function removeAllergen(allergen: string) {
    setDraft((d) => ({ ...d, allergies: (d.allergies ?? []).filter((a) => a.allergen !== allergen) }));
  }

  const canSubmit = draft.name.trim().length > 0 && draft.dob.length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const payload = { ...draft, name: draft.name.trim(), phone: draft.phone?.trim() || undefined };
    if (isEditing) {
      updatePatient.mutate(
        { id: patient.id, patient: payload },
        { onSuccess: () => router.push(`/patients/${patient.id}`) }
      );
      return;
    }
    if (!user) return;
    createPatient.mutate(
      { patient: payload, ownerId: user.id, institutionId: user.institutionId },
      { onSuccess: (created) => router.push(`/patients/${created.id}`) }
    );
  }

  return (
    <div className="space-y-0">
      <Section icon={User} title="Basics" first>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary">
              Full name <span className="text-blocked-fg">*</span>
            </label>
            <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Abena Sarpong" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary">
              Date of birth <span className="text-blocked-fg">*</span>
            </label>
            <Input type="date" value={draft.dob} onChange={(e) => setDraft((d) => ({ ...d, dob: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary">Sex</label>
            <Select value={draft.sex} onChange={(e) => setDraft((d) => ({ ...d, sex: e.target.value as Patient["sex"] }))}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary">
              Weight in kg <span className="text-subtle">(optional)</span>
            </label>
            <Input
              type="number"
              min={0}
              max={300}
              value={draft.weightKg ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, weightKg: e.target.value ? Number(e.target.value) : null }))}
              placeholder="e.g. 60"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary">
              Phone <span className="text-subtle">(optional)</span>
            </label>
            <Input
              type="tel"
              value={draft.phone ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              placeholder="e.g. 024 123 4567"
            />
          </div>
        </div>
      </Section>

      <Section icon={HeartPulse} title="Pregnancy & organ function">
        <div className="sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-secondary">Pregnant or breastfeeding?</p>
            <ChipToggleGroup size="sm" value={pregnancyState} onChange={setPregnancyTriState} options={triOptions("Yes", "No", "Not sure")} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-secondary">Known kidney problems?</p>
            <ChipToggleGroup size="sm" value={renalState} onChange={setRenalTriState} options={triOptions("Yes", "No")} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-secondary">Known liver problems?</p>
            <ChipToggleGroup size="sm" value={hepaticState} onChange={setHepaticTriState} options={triOptions("Yes", "No")} />
          </div>
        </div>
      </Section>

      <Section icon={ShieldAlert} title="Allergies">
        <div>
          <p className="mb-2 text-sm font-medium text-secondary">Any known allergies to medicines?</p>
          <ChipToggleGroup size="sm" value={allergyState} onChange={setAllergyTriState} options={triOptions("Yes, let me add them")} />
          {allergyState === "yes" && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGENS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => addAllergen(a, allergenSeverity)}
                    className="rounded-full border border-border-strong px-3 py-1.5 text-sm text-secondary hover:bg-surface-2"
                  >
                    + {a}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={allergenText}
                  onChange={(e) => setAllergenText(e.target.value)}
                  placeholder="Or type another medicine/allergen…"
                  className="max-w-xs"
                />
                <Select
                  value={allergenSeverity}
                  onChange={(e) => setAllergenSeverity(e.target.value as AllergySeverity)}
                  className="max-w-[140px]"
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </Select>
                <Button type="button" variant="secondary" onClick={() => addAllergen(allergenText, allergenSeverity)}>
                  Add
                </Button>
              </div>
              {(draft.allergies ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {(draft.allergies ?? []).map((a) => (
                    <li key={a.allergen.toLowerCase()} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                      <span>
                        {a.allergen} <span className="text-subtle">· {a.severity}</span>
                      </span>
                      <button onClick={() => removeAllergen(a.allergen)} aria-label={`Remove ${a.allergen}`} className="text-subtle hover:text-blocked-fg">
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Section>

      <Section icon={Pill} title="Current medications">
        <div>
          <p className="mb-2 text-sm font-medium text-secondary">Taking any other medicines right now?</p>
          <ChipToggleGroup size="sm" value={medsState} onChange={setMedsTriState} options={triOptions("Yes, let me add them")} />
          {medsState === "yes" && (
            <div className="mt-3 space-y-3">
              <Combobox
                items={medQuery ? medResults ?? [] : []}
                getKey={(d) => d.id}
                getLabel={(d) => d.generic_name}
                query={medQuery}
                onQueryChange={setMedQuery}
                onSelect={(drug) => {
                  const existing = draft.activeMedications ?? [];
                  if (!existing.some((m) => m.drugId === drug.id)) {
                    setDraft((d) => ({
                      ...d,
                      activeMedications: [...existing, { drugId: drug.id, startedAt: new Date().toISOString() }],
                    }));
                  }
                  setMedQuery("");
                }}
                loading={medsLoading}
                placeholder="Search the medicine…"
              />
              {(draft.activeMedications ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {(draft.activeMedications ?? []).map((m) => (
                    <li key={m.drugId} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                      <span>{formulary?.drugs.find((d) => d.id === m.drugId)?.generic_name ?? m.drugId}</span>
                      <button
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            activeMedications: (d.activeMedications ?? []).filter((x) => x.drugId !== m.drugId),
                          }))
                        }
                        aria-label="Remove medicine"
                        className="text-subtle hover:text-blocked-fg"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Section>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-1 py-4 backdrop-blur">
        <p className="text-sm text-muted-foreground">{!canSubmit ? "Full name and date of birth are required." : " "}</p>
        <Button size="lg" onClick={handleSubmit} disabled={!canSubmit || saving}>
          {saving ? "Saving…" : isEditing ? "Save changes" : "Save patient"}
        </Button>
      </div>
    </div>
  );
}
