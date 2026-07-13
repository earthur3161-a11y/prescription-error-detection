import Dexie, { type Table } from "dexie";
import { DEFAULT_REGION, getFormularyBundle } from "../formulary";
import type {
  AccessRequest,
  Account,
  AllergyRule,
  Batch,
  ClinicalAlert,
  DispenseRecord,
  Drug,
  FacilityPolicy,
  IntegrationConfig,
  InteractionRule,
  OutboxItem,
  OverrideLog,
  Patient,
  PatientCheck,
  PatientFeedbackReport,
  PatientProfile,
  PharmacistAction,
  PharmacySettings,
  PipelineEvent,
  Prescription,
  StockAdjustment,
  User,
} from "../types";
import { seedPatients } from "./seed/patients";
import { buildSeedPatientChecks } from "./seed/patientChecks";
import { buildSeedData } from "./seed/prescriptions";
import { seedUsers } from "./seed/users";
import { buildDevAccounts, DEV_ACCOUNT_PASSWORD, DEV_ACCOUNTS_ENABLED } from "./seed/accounts";
import { buildSeedBatches, DEFAULT_PHARMACY_SETTINGS } from "./seed/pharmacyInventory";
import {
  buildSeedClinicalAlerts,
  buildSeedPharmacistActions,
  buildSeedPipelineEvents,
} from "./seed/auditTrail";

export class MediGuardDB extends Dexie {
  patients!: Table<Patient, string>;
  users!: Table<User, string>;
  drugs!: Table<Drug, string>;
  interactionRules!: Table<InteractionRule, string>;
  allergyRules!: Table<AllergyRule, string>;
  prescriptions!: Table<Prescription, string>;
  overrideLogs!: Table<OverrideLog, string>;
  outbox!: Table<OutboxItem, number>;
  patientChecks!: Table<PatientCheck, string>;
  patientProfile!: Table<PatientProfile, string>;
  integrationConfig!: Table<IntegrationConfig, string>;
  clinicalAlerts!: Table<ClinicalAlert, string>;
  facilityPolicy!: Table<FacilityPolicy, string>;
  pipelineEvents!: Table<PipelineEvent, string>;
  patientFeedbackReports!: Table<PatientFeedbackReport, string>;
  accounts!: Table<Account, string>;
  accessRequests!: Table<AccessRequest, string>;
  meta!: Table<{ id: string; version: string }, string>;
  batches!: Table<Batch, string>;
  dispenseRecords!: Table<DispenseRecord, string>;
  pharmacistActions!: Table<PharmacistAction, string>;
  stockAdjustments!: Table<StockAdjustment, string>;
  pharmacySettings!: Table<PharmacySettings, string>;

  constructor() {
    super("mediguard");
    const v1Stores = {
      patients: "id, name",
      users: "id, role",
      drugs: "id, generic_name, class",
      interactionRules: "id, drug_a, drug_b",
      allergyRules: "id, allergen",
      prescriptions: "id, patientId, prescriberId, status, createdAt, source",
      overrideLogs: "id, prescriptionId, drugId, userId, timestamp",
      outbox: "++id, type, status, createdAt",
      patientChecks: "id, createdAt, shareToken",
      patientProfile: "id",
      integrationConfig: "id",
    };
    this.version(1).stores(v1Stores);
    const v2Stores = {
      ...v1Stores,
      clinicalAlerts: "id, prescriptionId, prescriberId, status, createdAt",
      facilityPolicy: "id",
      pipelineEvents: "id, prescriptionId, timestamp",
      patientFeedbackReports: "id, createdAt",
    };
    this.version(2).stores(v2Stores);
    const v4Stores = {
      ...v2Stores,
      accounts: "id, &email, role, status",
      accessRequests: "id, email, status, createdAt, inviteToken",
    };
    this.version(4).stores(v4Stores);
    const v5Stores = { ...v4Stores, meta: "id" };
    this.version(5).stores(v5Stores);
    this.version(6).stores({
      ...v5Stores,
      batches: "id, drugId, expiryDate, status",
      dispenseRecords: "id, prescriptionId, patientId, pharmacistId, dispensedAt",
      pharmacistActions: "id, prescriptionId, pharmacistId, action, timestamp",
      stockAdjustments: "id, batchId, drugId, timestamp",
      pharmacySettings: "id",
    });
  }
}

/**
 * Bump whenever the bundled formulary data changes (new drugs, interaction or
 * allergy rules, EML flags, dosing). The cached reference tables in existing
 * browsers are refreshed from source when this differs from what's stored, so
 * data changes propagate without a manual cache clear.
 */
const FORMULARY_VERSION = "2026-07-13-allergy-reaction-text-v1";

export const db = new MediGuardDB();

let bootstrapPromise: Promise<void> | null = null;

/**
 * Seeds IndexedDB from the static formulary/demo data on first load. This is
 * what makes the app read from a genuine offline cache rather than the
 * static arrays directly, and is idempotent across reloads.
 */
async function runBootstrap(): Promise<void> {
      const formulary = getFormularyBundle(DEFAULT_REGION);

      // Keep the static reference tables (drugs, interaction & allergy rules) in
      // sync with the bundled formulary. These are source-authoritative reference
      // data, so refreshing them when FORMULARY_VERSION changes lets data updates
      // (new drugs, interactions, EML flags) reach existing browsers without a
      // manual IndexedDB clear — the fix for stale on/off-EML labels.
      const storedVersion = (await db.meta.get("formulary"))?.version;
      if (storedVersion !== FORMULARY_VERSION) {
        await db.transaction("rw", [db.drugs, db.interactionRules, db.allergyRules, db.meta], async () => {
          await db.drugs.bulkPut(formulary.drugs);
          await db.interactionRules.bulkPut(formulary.interactionRules);
          await db.allergyRules.bulkPut(formulary.allergyRules);
          await db.meta.put({ id: "formulary", version: FORMULARY_VERSION });
        });
      }

      // One-time demo/user data seed (keyed off patients, so it never re-runs
      // over data the user has since created).
      const patientCount = await db.patients.count();
      if (patientCount === 0) {
        const { prescriptions, overrideLogs } = buildSeedData(formulary);
        const patientChecks = buildSeedPatientChecks(formulary);

        await db.transaction(
          "rw",
          [db.patients, db.users, db.prescriptions, db.overrideLogs, db.patientChecks],
          async () => {
            await db.patients.bulkPut(seedPatients);
            await db.users.bulkPut(seedUsers);
            await db.prescriptions.bulkPut(prescriptions);
            await db.overrideLogs.bulkPut(overrideLogs);
            await db.patientChecks.bulkPut(patientChecks);
          }
        );
      }

      const policyCount = await db.facilityPolicy.count();
      if (policyCount === 0) {
        await db.facilityPolicy.put({ id: "local", requireAdminCosignOnBlocked: true });
      }

      // Demo alerts + decisions for the Audit & Compliance Center. Each is
      // gated on its own table so the unified trail shows all three categories
      // even in browsers that seeded before these were added.
      if ((await db.clinicalAlerts.count()) === 0) {
        await db.clinicalAlerts.bulkPut(buildSeedClinicalAlerts());
      }
      if ((await db.pipelineEvents.count()) === 0) {
        await db.pipelineEvents.bulkPut(buildSeedPipelineEvents());
      }
      if ((await db.pharmacistActions.count()) === 0) {
        await db.pharmacistActions.bulkPut(buildSeedPharmacistActions());
      }

      // Independent pharmacy inventory + alerting config (one-time seed).
      const settingsCount = await db.pharmacySettings.count();
      if (settingsCount === 0) {
        await db.pharmacySettings.put(DEFAULT_PHARMACY_SETTINGS);
      }
      const batchCount = await db.batches.count();
      if (batchCount === 0) {
        await db.batches.bulkPut(buildSeedBatches(formulary));
      }

      // Dev/staging accounts are gated so they never ship in a production build.
      // In production the only path to an account is Request Access -> Super Admin
      // approval -> invite link.
      if (DEV_ACCOUNTS_ENABLED) {
        const accountCount = await db.accounts.count();
        if (accountCount === 0) {
          await db.accounts.bulkPut(buildDevAccounts());
          console.info(
            `[MediGuard] Dev accounts seeded (password: "${DEV_ACCOUNT_PASSWORD}", any 6-digit MFA):\n` +
              "  Physician  → ama.owusu@demo.mediguard.gh\n" +
              "  Pharmacy   → kwame.mensah@demo.mediguard.gh\n" +
              "  Admin      → efua.boateng@demo.mediguard.gh\n" +
              "  Super Admin→ root@demo.mediguard.gh"
          );
        }
      }
}

/**
 * Seeds IndexedDB on first load, and — critically — self-heals if the local
 * database can't open or upgrade (e.g. a half-migrated store left over from an
 * older schema version, or a corrupt IndexedDB). Rather than letting every
 * data-driven page fail to open, it deletes and recreates the database once and
 * re-seeds, so a bad local cache can never brick the app.
 */
export function ensureSeeded(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch(async (err) => {
      console.error("[MediGuard] Local database failed to open — recreating it from scratch.", err);
      try {
        await db.delete();
        await db.open();
        await runBootstrap();
      } catch (retryErr) {
        console.error("[MediGuard] Recreating the local database also failed.", retryErr);
        throw retryErr;
      }
    });
  }
  return bootstrapPromise;
}

/** Wipes all local MediGuard data (IndexedDB + session) so the app can start clean. Used by the error-recovery UI. */
export async function resetLocalData(): Promise<void> {
  bootstrapPromise = null;
  try {
    await db.delete();
  } catch {
    /* ignore — deleting a broken DB can itself fail; the reload still helps */
  }
  try {
    localStorage.removeItem("mediguard-session");
  } catch {
    /* ignore */
  }
}
