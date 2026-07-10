"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useDrugSearchFuzzy } from "@/lib/query/hooks/useFormulary";
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

function TriToggle({
  value,
  onChange,
  yesLabel,
}: {
  value: TriState;
  onChange: (v: TriState) => void;
  yesLabel: string;
}) {
  const options: { value: TriState; label: string }[] = [
    { value: "none", label: "No, none" },
    { value: "yes", label: yesLabel },
    { value: "unsure", label: "Not sure" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            value === opt.value
              ? "border-brand bg-brand-subtle text-brand"
              : "border-border-strong text-secondary hover:bg-surface-2"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
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

  function setAllergyTriState(v: TriState) {
    setAllergyState(v);
    if (v === "none") onChange({ ...profile, allergies: [] });
    else if (v === "unsure") onChange({ ...profile, allergies: null });
    else if (profile.allergies === null) onChange({ ...profile, allergies: [] });
  }

  function setMedsTriState(v: TriState) {
    setMedsState(v);
    if (v === "none") onChange({ ...profile, activeMedications: [] });
    else if (v === "unsure") onChange({ ...profile, activeMedications: null });
    else if (profile.activeMedications === null) onChange({ ...profile, activeMedications: [] });
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
    <div className="space-y-7">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-secondary">
          Your age <span className="text-subtle">(optional, helps us check the dose)</span>
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
          Your weight in kg <span className="text-subtle">(optional, only needed for some medicines)</span>
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

      <div>
        <p className="mb-2 text-sm font-medium text-secondary">Do you have any known allergies to medicines?</p>
        <TriToggle value={allergyState} onChange={setAllergyTriState} yesLabel="Yes, let me add them" />
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

      <div>
        <p className="mb-2 text-sm font-medium text-secondary">Are you taking any other medicines right now?</p>
        <TriToggle value={medsState} onChange={setMedsTriState} yesLabel="Yes, let me add them" />
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
    </div>
  );
}
