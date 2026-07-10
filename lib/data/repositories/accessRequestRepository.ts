import { db, ensureSeeded } from "../db";
import { generateId } from "../../utils/id";
import { createAccount } from "./accountRepository";
import type { AccessRequest, Account, UserRole } from "../../types";

const ROLE_TITLE: Record<UserRole, string> = {
  prescriber: "Physician",
  pharmacist: "Pharmacist",
  admin: "Facility Admin",
};

export async function createAccessRequest(
  entry: Omit<AccessRequest, "id" | "status" | "createdAt">
): Promise<AccessRequest> {
  await ensureSeeded();
  const request: AccessRequest = {
    ...entry,
    email: entry.email.trim().toLowerCase(),
    id: generateId("req"),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await db.accessRequests.put(request);
  return request;
}

export async function listAccessRequests(): Promise<AccessRequest[]> {
  await ensureSeeded();
  const all = await db.accessRequests.toArray();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Latest request for an email — powers the "Your request is under review" status check. */
export async function getLatestAccessRequestByEmail(email: string): Promise<AccessRequest | null> {
  await ensureSeeded();
  const matches = await db.accessRequests.where("email").equals(email.trim().toLowerCase()).toArray();
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export async function getAccessRequestByInviteToken(token: string): Promise<AccessRequest | null> {
  await ensureSeeded();
  const match = await db.accessRequests.where("inviteToken").equals(token).first();
  return match ?? null;
}

/**
 * Approves a request: provisions an "invited" account (no password yet) and
 * issues a one-time invite token. In a real system the token would be emailed
 * as a secure activation link; here it's surfaced in the Super Admin UI. No
 * plaintext password is ever generated or sent.
 */
export async function approveAccessRequest(
  requestId: string
): Promise<{ request: AccessRequest; account: Account } | null> {
  await ensureSeeded();
  const request = await db.accessRequests.get(requestId);
  if (!request || request.status !== "pending") return null;

  const inviteToken = generateId("invite");
  const account: Account = {
    id: generateId("acct"),
    email: request.email,
    passwordHash: "",
    role: request.requestedRole,
    name: request.fullName,
    title: ROLE_TITLE[request.requestedRole],
    status: "invited",
    institution: request.institution,
    createdAt: new Date().toISOString(),
  };
  await createAccount(account);

  const updated: AccessRequest = {
    ...request,
    status: "approved",
    reviewedAt: new Date().toISOString(),
    inviteToken,
    provisionedAccountId: account.id,
  };
  await db.accessRequests.put(updated);
  return { request: updated, account };
}

export async function rejectAccessRequest(
  requestId: string,
  reason: string
): Promise<AccessRequest | null> {
  await ensureSeeded();
  const request = await db.accessRequests.get(requestId);
  if (!request || request.status !== "pending") return null;
  const updated: AccessRequest = {
    ...request,
    status: "rejected",
    reviewedAt: new Date().toISOString(),
    rejectionReason: reason,
  };
  await db.accessRequests.put(updated);
  return updated;
}
