import type { Account } from "../../types";
import { hashPassword } from "../../auth/password";

/**
 * Whether dev/staging login accounts should be seeded. Gated so these demo
 * credentials NEVER ship in a production build: enabled automatically outside
 * production, or explicitly via NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS=true. In a real
 * production build with the flag off, the only route to an account is
 * Request Access -> Super Admin approval -> invite link.
 */
export const DEV_ACCOUNTS_ENABLED =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS === "true";

/** Shared demo password for all dev-seeded accounts. Dev-only; see DEV_ACCOUNTS_ENABLED. */
export const DEV_ACCOUNT_PASSWORD = "MediGuard!24";

/**
 * Dev/staging accounts. IDs match the seed clinical users so existing seeded
 * prescriptions/overrides resolve to the same identities. Built lazily so the
 * password hash is only computed when dev seeding actually runs.
 */
export function buildDevAccounts(): Account[] {
  const now = "2026-01-01T00:00:00.000Z";
  const passwordHash = hashPassword(DEV_ACCOUNT_PASSWORD);
  return [
    {
      id: "user_ama_owusu",
      email: "ama.owusu@demo.mediguard.gh",
      passwordHash,
      role: "prescriber",
      name: "Dr. Ama Owusu",
      title: "Physician",
      status: "active",
      institution: "Korle Bu Teaching Hospital",
      createdAt: now,
    },
    {
      id: "user_kwame_mensah",
      email: "kwame.mensah@demo.mediguard.gh",
      passwordHash,
      role: "pharmacist",
      name: "Kwame Mensah",
      title: "Pharmacist",
      status: "active",
      institution: "Korle Bu Teaching Hospital",
      createdAt: now,
    },
    {
      id: "user_efua_boateng",
      email: "efua.boateng@demo.mediguard.gh",
      passwordHash,
      role: "admin",
      name: "Efua Boateng",
      title: "Facility Admin",
      status: "active",
      institution: "Korle Bu Teaching Hospital",
      createdAt: now,
    },
    {
      id: "user_superadmin",
      email: "root@demo.mediguard.gh",
      passwordHash,
      role: "superadmin",
      name: "MediGuard Super Admin",
      title: "MediGuard Operations",
      status: "active",
      createdAt: now,
    },
  ];
}
