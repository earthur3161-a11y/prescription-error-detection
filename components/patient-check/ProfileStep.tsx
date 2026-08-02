"use client";

import { useState, type ReactNode } from "react";
import { HeartPulse, Pill, ShieldAlert, Stethoscope, User, X } from "lucide-react";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useDrugSearchFuzzy } from "@/lib/query/hooks/useFormulary";
import { PATIENT_CONDITIONS } from "@/lib/patient-check/conditions";
import type { AllergyRecord, AllergySeverity, Drug, PatientCheckProfile } from "@/lib/types";

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

interface ProfileStepProps {
  profile: PatientCheckProfile;
  onChange: (profile: PatientCheckProfile) => void;
  knownDrugs: Drug[];
}

export function ProfileStep({ profile, onChange, knownDrugs }: ProfileStepProps) {
  const [allergyState, setAllergyState] = useState<TriState>(
    profile.allergies === null ? "unsure" : profile.allergies.length > 0 ? "yes" : "none"
  );
  const [medsState, setMedsState] = useState<TriState>(
    profile.activeMedications === null ? "unsure" : profile.activeMedications.length > 0 ? "yes" : "none"
  );
  const [medQuery, setMedQuery] = useState("");
  const { data: medResults, isLoading: medsLoading } = useDrugSearchFuzzy(medQuery);
  const [allergenText, setAllergenText] = useState("");
  const [pregnancyState, setPregnancyState] = useState<TriState>(
    profile.isPregnant === true ? "yes" : profile.isPregnant === false ? "none" : "unsure"
  );
  const [renalState, setRenalState] = useState<TriState>(
    profile.renalStatus === "impaired" ? "yes" : profile.renalStatus === "normal" ? "none" : "unsure"
  );
  const [hepaticState, setHepaticState] = useState<TriState>(
    profile.hepaticStatus === "impaired" ? "yes" : profile.hepaticStatus === "normal" ? "none" : "unsure"
  );

  function setAllergyTriState(v: string) {
    const state = v as TriState;
    setAllergyState(state);
    if (state === "none") onChange({ ...profile, allergies: [] });
    else if (state === "unsure") onChange({ ...profile, allergies: null });
    else if (profile.allergies === null) onChange({ ...profile, allergies: [] });
  }

  function setMedsTriState(v: string) {
    const state = v as TriState;
    setMedsState(state);
    if (state === "none") onChange({ ...profile, activeMedications: [] });
    else if (state === "unsure") onChange({ ...profile, activeMedications: null });
    else if (profile.activeMedications === null) onChange({ ...profile, activeMedications: [] });
  }

  function setPregnancyTriState(v: string) {
    const state = v as TriState;
    setPregnancyState(state);
    onChange({ ...profile, isPregnant: state === "yes" ? true : state === "none" ? false : null });
  }

  function setRenalTriState(v: string) {
    const state = v as TriState;
    setRenalState(state);
    onChange({ ...profile, renalStatus: state === "yes" ? "impaired" : state === "none" ? "normal" : "unknown" });
  }

  function setHepaticTriState(v: string) {
    const state = v as TriState;
    setHepaticState(state);
    onChange({ ...profile, hepaticStatus: state === "yes" ? "impaired" : state === "none" ? "normal" : "unknown" });
  }

  function toggleConditions(values: string[]) {
    onChange({ ...profile, reportedConditions: values });
  }

  function addAllergen(allergen: string, severity: AllergySeverity) {
    const trimmed = allergen.trim();
    if (!trimmed) return;
    const existing = profile.allergies ?? [];
    // Guard against duplicates (e.g. tapping the "+ Penicillin" chip twice, or a
    // saved profile already containing it) — a repeat would otherwise collide on
    // the React key and double-count the allergen in screening.
    if (existing.some((a) => a.allergen.toLowerCase() === trimmed.toLowerCase())) {
      setAllergenText("");
      return;
    }
    const record: AllergyRecord = { allergen: trimmed, severity };
    onChange({ ...profile, allergies: [...existing, record] });
    setAllergenText("");
  }

  function removeAllergen(allergen: string) {
    onChange({
      ...profile,
      allergies: (profile.allergies ?? []).filter((a) => a.allergen !== allergen),
    });
  }

  return (
    <div className="space-y-0">
      <Section icon={User} title="Basics" first>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary">
              Your age <span className="text-subtle">(optional)</span>
            </label>
            <Input
              type="number"
              min={0}
              max={120}
              value={profile.ageYears ?? ""}
              onChange={(e) =>
                onChange({ ...profile, ageYears: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="e.g. 34"
              className="max-w-[140px]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary">
              Weight in kg <span className="text-subtle">(optional)</span>
            </label>
            <Input
              type="number"
              min={0}
              max={300}
              value={profile.weightKg ?? ""}
              onChange={(e) =>
                onChange({ ...profile, weightKg: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="e.g. 60"
              className="max-w-[140px]"
            />
          </div>
        </div>
      </Section>

      <Section icon={Stethoscope} title="What's this for?">
        <div>
          <p className="mb-2 text-xs text-subtle">
            Optional, but it helps us flag if a medicine looks like the wrong one for your condition. Select all that apply.
          </p>
          <ChipToggleGroup
            type="multiple"
            size="sm"
            options={PATIENT_CONDITIONS.map((c) => ({ value: c, label: c }))}
            values={profile.reportedConditions ?? []}
            onChange={toggleConditions}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-secondary">
            Anything else about why you&rsquo;re taking this?{" "}
            <span className="text-subtle">(optional, for your pharmacist&rsquo;s context)</span>
          </label>
          <Input
            value={profile.complaintNote ?? ""}
            onChange={(e) => onChange({ ...profile, complaintNote: e.target.value || null })}
            placeholder="e.g. persistent cough for 3 days"
          />
        </div>
      </Section>

      <Section icon={HeartPulse} title="Pregnancy & organ function">
        <div className="sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-secondary">Pregnant or breastfeeding?</p>
            <ChipToggleGroup
              size="sm"
              value={pregnancyState}
              onChange={setPregnancyTriState}
              options={triOptions("Yes", "No", "Not sure")}
            />
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
          <ChipToggleGroup
            size="sm"
            value={allergyState}
            onChange={setAllergyTriState}
            options={triOptions("Yes, let me add them")}
          />
          {allergyState === "yes" && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGENS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => addAllergen(a, "moderate")}
                    className="rounded-full border border-border-strong px-3 py-1.5 text-sm text-secondary hover:bg-surface-2"
                  >
                    + {a}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={allergenText}
                  onChange={(e) => setAllergenText(e.target.value)}
                  placeholder="Or type another medicine/allergen…"
                />
                <Button type="button" variant="secondary" onClick={() => addAllergen(allergenText, "moderate")}>
                  Add
                </Button>
              </div>
              {(profile.allergies ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {(profile.allergies ?? []).map((a) => (
                    <li
                      key={a.allergen.toLowerCase()}
                      className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"
                    >
                      <span>{a.allergen}</span>
                      <button
                        onClick={() => removeAllergen(a.allergen)}
                        aria-label={`Remove ${a.allergen}`}
                        className="-m-2.5 p-2.5 text-subtle hover:text-blocked-fg"
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

      <Section icon={Pill} title="Other medicines">
        <div>
          <p className="mb-2 text-sm font-medium text-secondary">Taking any other medicines right now?</p>
          <ChipToggleGroup
            size="sm"
            value={medsState}
            onChange={setMedsTriState}
            options={triOptions("Yes, let me add them")}
          />
          {medsState === "yes" && (
            <div className="mt-3 space-y-3">
              <Combobox
                items={medQuery ? medResults ?? [] : []}
                getKey={(d) => d.id}
                getLabel={(d) => d.generic_name}
                query={medQuery}
                onQueryChange={setMedQuery}
                onSelect={(drug) => {
                  const existing = profile.activeMedications ?? [];
                  // Skip if this drug is already in the list, so we never render
                  // two rows keyed by the same drugId.
                  if (!existing.some((m) => m.drugId === drug.id)) {
                    onChange({
                      ...profile,
                      activeMedications: [
                        ...existing,
                        { drugId: drug.id, startedAt: new Date().toISOString() },
                      ],
                    });
                  }
                  setMedQuery("");
                }}
                loading={medsLoading}
                placeholder="Search the other medicine…"
              />
              {(profile.activeMedications ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {(profile.activeMedications ?? []).map((m) => (
                    <li
                      key={m.drugId}
                      className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"
                    >
                      <span>{knownDrugs.find((d) => d.id === m.drugId)?.generic_name ?? m.drugId}</span>
                      <button
                        onClick={() =>
                          onChange({
                            ...profile,
                            activeMedications: (profile.activeMedications ?? []).filter(
                              (x) => x.drugId !== m.drugId
                            ),
                          })
                        }
                        aria-label="Remove medicine"
                        className="-m-2.5 p-2.5 text-subtle hover:text-blocked-fg"
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
    </div>
  );
}
