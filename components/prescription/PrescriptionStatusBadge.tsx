import { Badge } from "@/components/ui/Badge";
import type { PrescriptionStatus } from "@/lib/types";

const STATUS_CONFIG: Record<PrescriptionStatus, { label: string; tone: "neutral" | "brand" | "safe" | "caution" | "blocked" }> = {
  draft: { label: "Draft", tone: "neutral" },
  pending_admin_review: { label: "Admin Checkpoint Pending", tone: "caution" },
  pending_admin_cosign: { label: "Held for Admin Co-sign", tone: "blocked" },
  submitted: { label: "Awaiting Verification", tone: "brand" },
  under_review: { label: "Under Review", tone: "caution" },
  held: { label: "Held", tone: "caution" },
  cleared: { label: "Cleared", tone: "safe" },
  rejected: { label: "Rejected", tone: "blocked" },
  verified: { label: "Verified", tone: "safe" },
  dispensed: { label: "Dispensed", tone: "safe" },
  flagged: { label: "Flagged to Prescriber", tone: "blocked" },
};

export function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) {
  const { label, tone } = STATUS_CONFIG[status];
  return <Badge tone={tone}>{label}</Badge>;
}
