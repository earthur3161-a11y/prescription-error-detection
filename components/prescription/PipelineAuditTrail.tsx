import { CheckCircle2, ClipboardList, ShieldCheck, ShieldQuestion, Undo2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { usePipelineEvents } from "@/lib/query/hooks/usePipelineEvents";
import { useProfiles } from "@/lib/query/hooks/useProfiles";
import { formatDateTime } from "@/lib/utils/date";
import type { OverrideLog, PipelineEventType } from "@/lib/types";

const EVENT_LABEL: Record<PipelineEventType, string> = {
  admin_checkpoint_cleared: "Cleared the Facility Admin checkpoint",
  admin_checkpoint_held_for_cosign: "Held at the Facility Admin checkpoint for co-sign",
  admin_cosigned: "Co-signed by Facility Admin — released to pharmacy",
  admin_sent_back: "Sent back to prescriber by Facility Admin",
};

const EVENT_ICON: Record<PipelineEventType, typeof ShieldCheck> = {
  admin_checkpoint_cleared: CheckCircle2,
  admin_checkpoint_held_for_cosign: ShieldQuestion,
  admin_cosigned: ShieldCheck,
  admin_sent_back: Undo2,
};

interface TimelineEntry {
  timestamp: string;
  icon: typeof ShieldCheck;
  title: string;
  detail?: string;
}

interface PipelineAuditTrailProps {
  prescriptionId: string;
  overrideLogs: OverrideLog[];
}

/**
 * Merges the append-only pipeline events (Admin checkpoint steps) with the
 * override log into a single chronological trail, so the full path from
 * "Doctor Prescribes" to "Safe Prescription Issued" is visible in one place.
 */
export function PipelineAuditTrail({ prescriptionId, overrideLogs }: PipelineAuditTrailProps) {
  const { data: events } = usePipelineEvents(prescriptionId);
  const { data: profiles } = useProfiles();

  const entries: TimelineEntry[] = [
    ...overrideLogs.map((log) => ({
      timestamp: log.timestamp,
      icon: ClipboardList,
      title: `Override logged by ${profiles?.get(log.userId)?.name ?? log.userId}`,
      detail: log.reasonText || undefined,
    })),
    ...(events ?? []).map((event) => ({
      timestamp: event.timestamp,
      icon: EVENT_ICON[event.type],
      title: event.userId
        ? `${EVENT_LABEL[event.type]} (${profiles?.get(event.userId)?.name ?? event.userId})`
        : EVENT_LABEL[event.type],
      detail: event.note,
    })),
  ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (entries.length === 0) return null;

  return (
    <Card>
      <CardBody className="space-y-1">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-subtle">
          Audit trail
        </h2>
        <ul className="space-y-3">
          {entries.map((entry, i) => {
            const Icon = entry.icon;
            return (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <Icon className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
                <div>
                  <p className="text-secondary">{entry.title}</p>
                  {entry.detail && <p className="text-muted-foreground">{entry.detail}</p>}
                  <p className="text-xs text-subtle">{formatDateTime(entry.timestamp)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
