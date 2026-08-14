"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { counselingFor } from "@/lib/pharmacy/counseling";
import type { Drug } from "@/lib/types";

export default function DrugInfoPage() {
  const { data: formulary } = useFormulary();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Drug | null>(null);

  const results = useMemo(() => {
    if (!formulary) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return formulary.drugs
      .filter((d) => d.generic_name.toLowerCase().includes(q) || d.brand_names.some((b) => b.toLowerCase().includes(q)) || d.class.toLowerCase().includes(q))
      .slice(0, 12);
  }, [formulary, query]);

  const interactions = useMemo(() => {
    if (!formulary || !selected) return [];
    return formulary.interactionRules
      .filter((r) => r.drug_a === selected.id || r.drug_b === selected.id)
      .map((r) => {
        const otherId = r.drug_a === selected.id ? r.drug_b : r.drug_a;
        const other = formulary.drugs.find((d) => d.id === otherId);
        return { other: other?.generic_name ?? otherId, severity: r.severity, description: r.description };
      });
  }, [formulary, selected]);

  if (!formulary) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 sm:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const counsel = selected ? counselingFor(selected) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Drug information</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quick clinical reference — independent of any active prescription.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
        <Input value={query} onChange={(e) => { setQuery(e.target.value); setSelected(null); }} placeholder="Search by drug, brand, or class…" className="pl-9" />
      </div>

      {query.trim() && !selected && (
        <div className="space-y-2">
          {results.length === 0 && <p className="text-sm text-muted-foreground">No matches.</p>}
          {results.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d)}
              className="block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <Card interactive className="active:scale-[0.98]">
                <CardBody className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-foreground">{d.generic_name}</p>
                    <p className="text-xs text-muted-foreground">{d.class}{d.brand_names.length > 0 ? ` · ${d.brand_names.join(", ")}` : ""}</p>
                  </div>
                  <Badge tone={d.onEssentialMedicinesList ? "safe" : "caution"}>{d.onEssentialMedicinesList ? "EML" : "Non-EML"}</Badge>
                </CardBody>
              </Card>
            </button>
          ))}
        </div>
      )}

      {selected && counsel && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{selected.generic_name}</h2>
                <p className="text-sm text-muted-foreground">{selected.class}{selected.brand_names.length > 0 ? ` · ${selected.brand_names.join(", ")}` : ""}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-sm font-medium text-brand hover:underline">Back to results</button>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">Usual dose: </span>{selected.standard_dose_range.minMgPerDose}–{selected.standard_dose_range.maxMgPerDose}mg, {selected.standard_dose_range.frequency}</div>
              <div><span className="text-muted-foreground">Max/day: </span>{selected.standard_dose_range.maxMgPerDay}mg</div>
              <div><span className="text-muted-foreground">Routes: </span>{selected.route.join(", ")}</div>
              <div><span className="text-muted-foreground">EML: </span>{selected.onEssentialMedicinesList ? "Listed" : "Not listed"}</div>
            </div>

            {selected.contraindications && selected.contraindications.length > 0 && (
              <div>
                <p className="text-sm font-medium text-secondary">Contraindications / cautions</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selected.contraindications.map((c) => <Badge key={c} tone="caution">{c}</Badge>)}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-secondary">Interactions on file</p>
              {interactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">None in the formulary rule set.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm text-secondary">
                  {interactions.map((i, idx) => (
                    <li key={idx}><span className="font-medium">{i.other}</span> ({i.severity}) — {i.description}</li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-secondary">Counseling points</p>
              <ul className="mt-1 space-y-1 text-sm text-secondary">
                <li><span className="font-medium">Administration:</span> {counsel.administration}</li>
                <li><span className="font-medium">Side effects:</span> {counsel.sideEffects}</li>
                <li><span className="font-medium">Storage:</span> {counsel.storage}</li>
                <li><span className="font-medium">Missed dose:</span> {counsel.missedDose}</li>
              </ul>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
