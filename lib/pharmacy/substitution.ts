import type { Batch, Drug } from "../types";
import { totalDispensableStock } from "./inventory";

export interface SubstituteSuggestion {
  drug: Drug;
  dispensable: number;
  reason: "same_class" | "eml_alternative";
}

/**
 * Suggests in-stock alternatives for a drug that's out of stock (or being
 * reconsidered) — same therapeutic class first, plus the drug's EML-listed
 * alternative if it has stock. Always a suggestion requiring pharmacist
 * confirmation, never an automatic swap.
 */
export function suggestSubstitutes(
  drug: Drug,
  drugs: Drug[],
  batches: Batch[],
  nearExpiryDays: number
): SubstituteSuggestion[] {
  const batchesByDrug = new Map<string, Batch[]>();
  for (const b of batches) {
    const list = batchesByDrug.get(b.drugId) ?? [];
    list.push(b);
    batchesByDrug.set(b.drugId, list);
  }
  const stockFor = (id: string) => totalDispensableStock(batchesByDrug.get(id) ?? [], nearExpiryDays);

  const out: SubstituteSuggestion[] = [];
  const seen = new Set<string>([drug.id]);

  for (const candidate of drugs) {
    if (candidate.id === drug.id || candidate.class !== drug.class) continue;
    const dispensable = stockFor(candidate.id);
    if (dispensable > 0) {
      out.push({ drug: candidate, dispensable, reason: "same_class" });
      seen.add(candidate.id);
    }
  }

  if (drug.emlAlternativeDrugId && !seen.has(drug.emlAlternativeDrugId)) {
    const alt = drugs.find((d) => d.id === drug.emlAlternativeDrugId);
    const dispensable = alt ? stockFor(alt.id) : 0;
    if (alt && dispensable > 0) out.push({ drug: alt, dispensable, reason: "eml_alternative" });
  }

  return out.sort((a, b) => b.dispensable - a.dispensable);
}
