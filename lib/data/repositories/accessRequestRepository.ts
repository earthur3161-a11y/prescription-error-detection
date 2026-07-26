import { supabase } from "../../supabase/client";
import type { AccessRequestRow } from "../../supabase/types";
import type { AccessRequest, AccessRequestStatus } from "../../types";

function mapRow(row: AccessRequestRow): AccessRequest {
  return {
    id: row.id,
    fullName: row.full_name,
    requestedRole: row.requested_role,
    institution: row.institution,
    licenseNumber: row.license_number ?? undefined,
    email: row.email,
    phone: row.phone,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? undefined,
    provisionedAccountId: row.provisioned_account_id ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    // Supabase issues its own invite links via email now — there's no app
    // -level token to expose here.
    inviteToken: undefined,
  };
}

/**
 * Submits a new access request. Inserted without a trailing `.select()` —
 * there's no anonymous SELECT policy on this table (by design, so a public
 * caller can't browse other people's requests), so `.insert().select()`
 * would fail its own read-back. The id is generated client-side and sent
 * explicitly in the insert payload so the returned object's id is
 * guaranteed to match the real row, without needing to read it back.
 */
export async function createAccessRequest(
  entry: Omit<AccessRequest, "id" | "status" | "createdAt">
): Promise<AccessRequest> {
  const id = crypto.randomUUID();
  const email = entry.email.trim().toLowerCase();
  const createdAt = new Date().toISOString();

  const { error } = await supabase.from("access_requests").insert({
    id,
    full_name: entry.fullName,
    requested_role: entry.requestedRole,
    institution: entry.institution,
    license_number: entry.licenseNumber ?? null,
    email,
    phone: entry.phone,
    status: "pending",
    created_at: createdAt,
  });
  if (error) {
    // The actual enforcement is the partial unique index
    // (access_requests_pending_email_idx, 0013) — race-proof against two
    // concurrent submissions in a way a pre-check SELECT here couldn't be.
    // This just turns that constraint violation into a message a submitter
    // can act on, rather than a raw Postgres error.
    if (error.code === "23505" && error.message.includes("access_requests_pending_email_idx")) {
      throw new Error(
        "You already have a request pending review for this email. Check its status above, or wait for a response."
      );
    }
    throw error;
  }

  return {
    id,
    fullName: entry.fullName,
    requestedRole: entry.requestedRole,
    institution: entry.institution,
    licenseNumber: entry.licenseNumber,
    email,
    phone: entry.phone,
    status: "pending",
    createdAt,
  };
}

/** Superadmin-only (enforced by RLS) — every access request, newest first. */
export async function listAccessRequests(): Promise<AccessRequest[]> {
  const { data, error } = await supabase
    .from("access_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/** Narrow status check for the public "check my request" flow — deliberately not a full AccessRequest. */
export interface AccessRequestStatusCheck {
  status: AccessRequestStatus;
  rejectionReason: string | null;
}

/**
 * Powers the anonymous "check my request status" flow via a SECURITY
 * DEFINER Postgres function that returns only {status, rejection_reason}
 * for an exact email match — same privacy exposure as a typical "forgot
 * password" form, and can't be used to browse/enumerate requests.
 */
export async function getLatestAccessRequestByEmail(
  email: string
): Promise<AccessRequestStatusCheck | null> {
  const { data, error } = await supabase.rpc("check_access_request_status", {
    p_email: email.trim().toLowerCase(),
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { status: row.status, rejectionReason: row.rejection_reason };
}

/**
 * Approving a request requires the service-role key (creating a Supabase
 * Auth user via the admin API is not something any RLS policy can grant to
 * a browser client), so this delegates to a server route instead of writing
 * to Supabase directly. Throws with a user-facing message on failure —
 * notably when the email already has an account (409).
 */
export async function approveAccessRequest(
  requestId: string,
  confirmedInstitutionName?: string
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Your session has expired — please sign in again.");

  const res = await fetch(`/api/admin/access-requests/${requestId}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      confirmedInstitutionName ? { confirmedInstitutionName } : {}
    ),
  });
  if (res.ok) return;

  const body = await res.json().catch(() => ({}));
  if (res.status === 409) {
    throw new Error("This email already has an account — nothing more to approve.");
  }
  throw new Error(body?.message ?? "Couldn't approve this request. Please try again.");
}

/** Plain RLS-gated update — superadmin only, matches the table's update policy. */
export async function rejectAccessRequest(
  requestId: string,
  reason: string
): Promise<AccessRequest | null> {
  const { data, error } = await supabase
    .from("access_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select()
    .single();
  if (error || !data) return null;
  return mapRow(data);
}
