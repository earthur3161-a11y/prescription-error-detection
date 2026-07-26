"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  useAccessRequestStatus,
  useCreateAccessRequest,
} from "@/lib/query/hooks/useAccessRequests";
import type { UserRole } from "@/lib/types";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "prescriber", label: "Physician" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "admin", label: "Facility Admin" },
];

function RequestAccessForm() {
  const createRequest = useCreateAccessRequest();

  const [requestedRole, setRequestedRole] = useState<UserRole>("prescriber");
  const [fullName, setFullName] = useState("");
  const [institution, setInstitution] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createRequest.mutate(
      {
        fullName: fullName.trim(),
        requestedRole,
        institution: institution.trim(),
        licenseNumber: licenseNumber.trim() || undefined,
        email: email.trim(),
        phone: phone.trim(),
      },
      { onSuccess: (req) => setSubmittedEmail(req.email) }
    );
  }

  if (submittedEmail) {
    return (
      <div className="space-y-3 text-center">
        <Clock className="mx-auto size-10 text-caution-fg" aria-hidden="true" />
        <p className="font-medium text-foreground">Your request is under review</p>
        <p className="text-sm text-muted-foreground">
          Thanks — a MediGuard administrator will review your request for{" "}
          <span className="font-medium">{submittedEmail}</span> and issue a secure invite link once
          approved. No password is ever emailed to you.
        </p>
        <p className="text-sm text-muted-foreground">
          You can check back here anytime using the <span className="font-medium">Check status</span> tab.
        </p>
      </div>
    );
  }

  const licenseLabel =
    requestedRole === "admin"
      ? "Proof of authority (official title / staff ID)"
      : "License / professional registration number";

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-secondary">Role</label>
        <Select value={requestedRole} onChange={(e) => setRequestedRole(e.target.value as UserRole)}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-secondary">Full name</label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-secondary">Institution / facility</label>
        <Input value={institution} onChange={(e) => setInstitution(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-secondary">{licenseLabel}</label>
        <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-secondary">Contact email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-secondary">Phone</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={createRequest.isPending}>
        Submit request
      </Button>
    </form>
  );
}

function CheckStatus() {
  const [emailInput, setEmailInput] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const { data: request, isFetching } = useAccessRequestStatus(lookupEmail);

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setLookupEmail(emailInput);
        }}
      >
        <Input
          type="email"
          placeholder="The email you applied with"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          required
        />
        <Button type="submit" variant="secondary">
          Check
        </Button>
      </form>

      {lookupEmail && !isFetching && !request && (
        <p className="text-sm text-muted-foreground">No request found for that email.</p>
      )}

      {request && request.status === "pending" && (
        <div className="flex items-start gap-2.5 rounded-lg bg-caution-bg px-4 py-3 text-sm text-caution-fg">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Your request is under review. We&rsquo;ll email you an invite link once approved.
        </div>
      )}
      {request && request.status === "rejected" && (
        <div className="rounded-lg bg-blocked-bg px-4 py-3 text-sm text-blocked-fg">
          <p className="flex items-center gap-2 font-medium">
            <XCircle className="size-4" aria-hidden="true" /> Request not approved
          </p>
          {request.rejectionReason && <p className="mt-1">{request.rejectionReason}</p>}
        </div>
      )}
      {request && request.status === "approved" && (
        <div className="space-y-1 rounded-lg bg-safe-bg px-4 py-3 text-sm text-safe-fg">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Approved
          </p>
          <p>Check your email for a secure invite link to set your password and activate your account.</p>
        </div>
      )}
    </div>
  );
}

export default function RequestAccessPage() {
  const [tab, setTab] = useState<"request" | "status">("request");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <ShieldCheck className="size-7 text-brand" aria-hidden="true" />
        <span className="text-xl font-semibold text-foreground">MediGuard</span>
      </Link>
      <Card className="w-full max-w-lg">
        <CardBody className="space-y-5">
          <div className="flex rounded-lg bg-muted p-1 text-sm font-medium">
            <button
              onClick={() => setTab("request")}
              className={`flex-1 rounded-md py-1.5 transition-colors ${tab === "request" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              Request access
            </button>
            <button
              onClick={() => setTab("status")}
              className={`flex-1 rounded-md py-1.5 transition-colors ${tab === "status" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              Check status
            </button>
          </div>

          {tab === "request" ? (
            <>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Join an institution</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  For physicians, pharmacists, and facility admins joining a hospital or clinic already
                  using (or adopting) MediGuard. A MediGuard operator reviews and approves your request,
                  then your account is scoped to that institution&rsquo;s patients and staff.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Practicing independently, outside an institution? Register as an independent
                  practitioner instead — no approval wait, instant access, individual subscription:{" "}
                  <Link href="/physician/signup" className="font-medium text-brand hover:underline">
                    /physician/signup
                  </Link>{" "}
                  or{" "}
                  <Link href="/pharmacy/signup" className="font-medium text-brand hover:underline">
                    /pharmacy/signup
                  </Link>
                  .
                </p>
              </div>
              <RequestAccessForm />
            </>
          ) : (
            <>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Check your request status</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter the email you applied with to see where your request stands.
                </p>
              </div>
              <CheckStatus />
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
