"use client";

import { useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import {
  useAccessRequests,
  useApproveAccessRequest,
  useRejectAccessRequest,
} from "@/lib/query/hooks/useAccessRequests";
import { formatDateTime } from "@/lib/utils/date";
import type { AccessRequest, UserRole } from "@/lib/types";

const ROLE_LABEL: Record<UserRole, string> = {
  prescriber: "Physician",
  pharmacist: "Pharmacist",
  admin: "Facility Admin",
};

function SuperAdminDashboard() {
  const { data: requests, isLoading } = useAccessRequests();
  const approve = useApproveAccessRequest();
  const reject = useRejectAccessRequest();
  const [rejectTarget, setRejectTarget] = useState<AccessRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveTarget, setApproveTarget] = useState<AccessRequest | null>(null);
  const [approveInstitutionName, setApproveInstitutionName] = useState("");

  const pending = useMemo(() => (requests ?? []).filter((r) => r.status === "pending"), [requests]);
  const reviewed = useMemo(() => (requests ?? []).filter((r) => r.status !== "pending"), [requests]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-semibold text-foreground">Pending access requests</h2>
        {isLoading && <Skeleton className="h-24 w-full" />}
        {!isLoading && pending.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No requests awaiting review.</p>
        )}
        <div className="stagger space-y-3">
          {pending.map((req) => (
            <Card key={req.id}>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {req.fullName} <span className="text-subtle">· {ROLE_LABEL[req.requestedRole]}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {req.institution} · {req.email} · {req.phone}
                    </p>
                    {req.licenseNumber && (
                      <p className="text-sm text-muted-foreground">Credential: {req.licenseNumber}</p>
                    )}
                    <p className="text-xs text-subtle">Requested {formatDateTime(req.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setApproveTarget(req);
                        setApproveInstitutionName(req.institution);
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setRejectTarget(req);
                        setRejectReason("");
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-foreground">Reviewed</h2>
        {!isLoading && reviewed.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing reviewed yet.</p>
        )}
        <div className="stagger space-y-3">
          {reviewed.map((req) => (
            <Card key={req.id}>
              <CardBody className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">
                    {req.fullName} <span className="text-subtle">· {ROLE_LABEL[req.requestedRole]}</span>
                  </p>
                  <Badge tone={req.status === "approved" ? "safe" : "blocked"}>{req.status}</Badge>
                </div>
                {req.status === "approved" && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="size-4 shrink-0" aria-hidden="true" />
                    Invite email sent to {req.email}.
                  </p>
                )}
                {req.status === "rejected" && req.rejectionReason && (
                  <p className="text-sm text-muted-foreground">Reason: {req.rejectionReason}</p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <Modal
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject access request"
        description={rejectTarget ? `Rejecting ${rejectTarget.fullName}'s request.` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectReason.trim().length === 0 || reject.isPending}
              onClick={() => {
                if (!rejectTarget) return;
                reject.mutate(
                  { id: rejectTarget.id, reason: rejectReason.trim() },
                  { onSuccess: () => setRejectTarget(null) }
                );
              }}
            >
              Reject request
            </Button>
          </>
        }
      >
        <Textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          placeholder="Reason shown to the applicant…"
        />
      </Modal>

      <Modal
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve access request"
        description={
          approveTarget
            ? `${approveTarget.fullName} will be provisioned as ${ROLE_LABEL[approveTarget.requestedRole]} at the institution below.`
            : ""
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproveTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={approveInstitutionName.trim().length === 0 || approve.isPending}
              onClick={() => {
                if (!approveTarget) return;
                approve.mutate(
                  { id: approveTarget.id, confirmedInstitutionName: approveInstitutionName.trim() },
                  { onSuccess: () => setApproveTarget(null) }
                );
              }}
            >
              Confirm & approve
            </Button>
          </>
        }
      >
        <label htmlFor="approve-institution-name" className="mb-1.5 block text-sm font-medium text-secondary">
          Institution name
        </label>
        <Input
          id="approve-institution-name"
          value={approveInstitutionName}
          onChange={(e) => setApproveInstitutionName(e.target.value)}
          placeholder="Institution name"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Matched case-insensitively against existing institutions, or created if none match. Fix typos here
          before confirming — this becomes the institution every staff member at this name shares.
        </p>
      </Modal>
    </div>
  );
}

export default function SuperAdminPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Access requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and approve facility account requests. Approving provisions an account and sends a
          secure invite email — no plaintext password is ever created or sent.
        </p>
      </div>
      <SuperAdminDashboard />
    </div>
  );
}
