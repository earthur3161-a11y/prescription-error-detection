import type { Drug, FormularyBundle } from "../types";

/**
 * Layers admin-added custom drugs (0026_custom_drugs.sql) on top of the
 * static, code-committed base formulary — additive only, never touching
 * base.drugs itself. Filters by region the same way the static registry
 * already is, so a custom drug never leaks into a region it wasn't marked
 * available for.
 */
export function mergeCustomDrugs(base: FormularyBundle, customDrugs: Drug[]): FormularyBundle {
  if (customDrugs.length === 0) return base;
  const regionCustomDrugs = customDrugs.filter((d) => d.region_availability.includes(base.region));
  if (regionCustomDrugs.length === 0) return base;
  return { ...base, drugs: [...base.drugs, ...regionCustomDrugs] };
}
