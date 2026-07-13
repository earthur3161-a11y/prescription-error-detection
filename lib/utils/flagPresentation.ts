import { AlertTriangle, HelpCircle, XCircle, type LucideIcon } from "lucide-react";
import type { Severity } from "@/lib/screening-engine";

/** Icon per flag severity — shared across every screen that renders a Flag list. */
export const FLAG_ICON: Record<Severity, LucideIcon> = {
  none: AlertTriangle,
  minor: AlertTriangle,
  moderate: AlertTriangle,
  major: XCircle,
  severe: XCircle,
  unknown: HelpCircle,
};

/** Text color per flag severity, for the clinical (non-patient) audience. */
export const FLAG_COLOR_CLASS: Record<Severity, string> = {
  none: "text-subtle",
  minor: "text-caution-fg",
  moderate: "text-caution-fg",
  major: "text-blocked-fg",
  severe: "text-blocked-fg",
  unknown: "text-muted-foreground",
};
