import type { AllergyRecord, AllergySeverity } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

const severityTone: Record<AllergySeverity, "safe" | "caution" | "blocked"> = {
  mild: "safe",
  moderate: "caution",
  severe: "blocked",
};

interface AllergyListProps {
  allergies: AllergyRecord[] | null;
}

export function AllergyList({ allergies }: AllergyListProps) {
  if (allergies === null) {
    return <p className="text-sm text-caution-fg">Not on file — verify manually.</p>;
  }
  if (allergies.length === 0) {
    return <p className="text-sm text-muted-foreground">No known allergies recorded.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {allergies.map((a, i) => (
        <li key={`${a.allergen.toLowerCase()}-${i}`} className="flex items-center gap-2 text-sm">
          <Badge tone={severityTone[a.severity]}>{a.severity}</Badge>
          <span className="text-secondary">
            {a.allergen}
            {a.reaction ? ` — ${a.reaction}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
