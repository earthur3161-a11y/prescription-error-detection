import { db, ensureSeeded } from "../db";
import { hashPassword, verifyPassword } from "../../auth/password";
import type { Account, AccountRole } from "../../types";

/**
 * Authenticates an email/password pair against the accounts table, enforcing
 * the expected portal role SERVER-SIDE-EQUIVALENT — i.e. in the data layer, not
 * merely by which URL was visited. A pharmacy account cannot sign in through the
 * physician portal even if it navigates there directly. Returns null for any
 * failure (no account, wrong password, wrong role, not active) so callers can
 * surface a single generic "Invalid login" that never reveals whether an
 * account exists.
 */
export async function authenticate(
  email: string,
  password: string,
  expectedRole: AccountRole
): Promise<Account | null> {
  await ensureSeeded();
  const normalized = email.trim().toLowerCase();
  const account = await db.accounts.where("email").equals(normalized).first();
  if (!account) return null;
  if (account.status !== "active") return null;
  if (account.role !== expectedRole) return null;
  if (!verifyPassword(password, account.passwordHash)) return null;
  return account;
}

export async function getAccountByEmail(email: string): Promise<Account | null> {
  await ensureSeeded();
  const account = await db.accounts.where("email").equals(email.trim().toLowerCase()).first();
  return account ?? null;
}

export async function getAccountById(id: string): Promise<Account | null> {
  await ensureSeeded();
  return (await db.accounts.get(id)) ?? null;
}

export async function listAccounts(): Promise<Account[]> {
  await ensureSeeded();
  return db.accounts.toArray();
}

export async function createAccount(account: Account): Promise<Account> {
  await ensureSeeded();
  await db.accounts.put(account);
  return account;
}

/** Sets a password on an "invited" account and activates it (invite-link activation flow). */
export async function activateAccount(accountId: string, password: string): Promise<Account | null> {
  await ensureSeeded();
  const account = await db.accounts.get(accountId);
  if (!account) return null;
  const updated: Account = {
    ...account,
    passwordHash: hashPassword(password),
    status: "active",
  };
  await db.accounts.put(updated);
  return updated;
}
