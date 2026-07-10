"use client";

import { useState } from "react";
import { Pill, X } from "lucide-react";
import { Combobox } from "@/components/ui/Combobox";
import { ScanLabelButton } from "./ScanLabelButton";
import { useDrugSearchFuzzy } from "@/lib/query/hooks/useFormulary";
import type { Drug } from "@/lib/types";

interface DrugPickerProps {
  addedDrugs: Drug[];
  onAdd: (drug: Drug) => void;
  onRemove: (drugId: string) => void;
}

export function DrugPicker({ addedDrugs, onAdd, onRemove }: DrugPickerProps) {
  const [query, setQuery] = useState("");
  const { data: results, isLoading } = useDrugSearchFuzzy(query);

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="drug-picker" className="mb-1.5 block text-sm font-medium text-secondary">
          What medicine did you get?
        </label>
        <Combobox
          items={query ? results ?? [] : []}
          getKey={(d) => d.id}
          getLabel={(d) => d.generic_name}
          renderItem={(d) => (
            <span>
              <span className="font-medium">{d.generic_name}</span>
              {d.brand_names.length > 0 && (
                <span className="text-subtle"> ({d.brand_names.join(", ")})</span>
              )}
            </span>
          )}
          query={query}
          onQueryChange={setQuery}
          onSelect={(drug) => {
            onAdd(drug);
            setQuery("");
          }}
          loading={isLoading}
          placeholder="Type the name, even if you're not sure of the spelling…"
          emptyMessage="No matches yet — try a different spelling, or the brand name on the box."
        />
      </div>

      <ScanLabelButton onTextExtracted={(text) => setQuery(text)} />

      {addedDrugs.length > 0 && (
        <ul className="space-y-2">
          {addedDrugs.map((drug) => (
            <li
              key={drug.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
            >
              <span className="flex items-center gap-2.5">
                <Pill className="size-4 text-brand" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground">{drug.generic_name}</span>
              </span>
              <button
                onClick={() => onRemove(drug.id)}
                aria-label={`Remove ${drug.generic_name}`}
                className="rounded-lg p-1.5 text-subtle hover:bg-muted hover:text-blocked-fg"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
