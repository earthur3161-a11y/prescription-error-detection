"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, LogOut, ShieldAlert } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth/useAuth";
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

function InviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/activate/${token}` : "";
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs text-secondary">{url}</code>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        aria-label="Copy invite link"
        className="rounded-lg p-1.5 text-subtle hover:bg-muted"
      >
        {copied ? <Check className="size-4 text-safe-fg" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

function SuperAdminDashboard() {
  const { data: requests, isLoading } = useAccessRequests();
  const approve = useApproveAccessRequest();
  const reject = useRejectAccessRequest();
  const [rejectTarget, setRejectTarget] = useState<AccessRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
        <div className="space-y-3">
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
                    <Button size="sm" onClick={() => approve.mutate(req.id)} disabled={approve.isPending}>
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
        <div className="space-y-3">
          {reviewed.map((req) => (
            <Card key={req.id}>
              <CardBody className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">
                    {req.fullName} <span className="text-subtle">· {ROLE_LABEL[req.requestedRole]}</span>
                  </p>
                  <Badge tone={req.status === "approved" ? "safe" : "blocked"}>{req.status}</Badge>
                </div>
                {req.status === "approved" && req.inviteToken && (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      Secure invite link (would be emailed to {req.email}):
                    </p>
                    <InviteLink token={req.inviteToken} />
                  </div>
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
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
          placeholder="Reason shown to the applicant…"
        />
      </Modal>
    </div>
  );
}

export default function SuperAdminPage() {
  const router = useRouter();
  const { role, hasHydrated, logout } = useAuth();

  useEffect(() => {
    if (!hasHydrated) return;
    if (role !== "superadmin") router.replace("/superadmin/login");
  }, [hasHydrated, role, router]);

  if (!hasHydrated || role !== "superadmin") return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-6 text-foreground" aria-hidden="true" />
          <span className="font-semibold text-foreground">MediGuard Operations</span>
        </div>
        <button
          onClick={() => {
            logout();
            router.replace("/superadmin/login");
          }}
          aria-label="Sign out"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Access requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and approve facility account requests. Approving provisions an account and issues a
            one-time invite link — no plaintext password is ever created or sent.
          </p>
        </div>
        <SuperAdminDashboard />
      </main>
    </div>
  );
}
