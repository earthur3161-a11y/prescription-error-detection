import { Badge } from "@/components/ui/Badge";
import { pharmacyStateOf, PHARMACY_STATE_META } from "@/lib/pharmacy/status";
import type { PrescriptionStatus } from "@/lib/types";

export function PharmacyStatusBadge({ status }: { status: PrescriptionStatus }) {
  const state = pharmacyStateOf(status);
  if (!state) return <Badge tone="neutral">{status}</Badge>;
  const { label, tone } = PHARMACY_STATE_META[state];
  return <Badge tone={tone}>{label}</Badge>;
}
