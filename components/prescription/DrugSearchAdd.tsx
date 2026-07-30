"use client";

import { useState } from "react";
import { Combobox } from "@/components/ui/Combobox";
import { useDrugSearch } from "@/lib/query/hooks/useFormulary";
import type { Drug } from "@/lib/types";

interface DrugSearchAddProps {
  onAdd: (drug: Drug) => void;
  /** Focuses the search box on mount — used when this remounts right after a patient is selected, so the next keystroke starts the first drug search with no click needed. */
  autoFocus?: boolean;
}

export function DrugSearchAdd({ onAdd, autoFocus }: DrugSearchAddProps) {
  const [query, setQuery] = useState("");
  const { data: results, isLoading } = useDrugSearch(query);

  return (
    <Combobox
      items={query ? results ?? [] : []}
      getKey={(d) => d.id}
      getLabel={(d) => d.generic_name}
      renderItem={(d) => (
        <span>
          <span className="font-medium">{d.generic_name}</span>
          <span className="text-subtle"> · {d.class}</span>
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
      placeholder="Search drug by generic or brand name to add…"
      emptyMessage="No matching drugs in the formulary."
      autoFocus={autoFocus}
    />
  );
}
