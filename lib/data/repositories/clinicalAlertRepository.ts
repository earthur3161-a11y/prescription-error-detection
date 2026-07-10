import { db, ensureSeeded } from "../db";
import { generateId } from "../../utils/id";
import type { ClinicalAlert, ClinicalAlertStatus } from "../../types";

export interface ClinicalAlertFilters {
  prescriberId?: string;
  status?: ClinicalAlertStatus;
  requiresCosign?: boolean;
}

export async function createClinicalAlert(
  entry: Omit<ClinicalAlert, "id" | "createdAt">
): Promise<ClinicalAlert> {
  await ensureSeeded();
  const alert: ClinicalAlert = {
    ...entry,
    id: generateId("alert"),
    createdAt: new Date().toISOString(),
  };
  await db.clinicalAlerts.put(alert);
  return alert;
}

export async function listClinicalAlerts(filters: ClinicalAlertFilters = {}): Promise<ClinicalAlert[]> {
  await ensureSeeded();
  let all = await db.clinicalAlerts.toArray();
  if (filters.prescriberId) all = all.filter((a) => a.prescriberId === filters.prescriberId);
  if (filters.status) all = all.filter((a) => a.status === filters.status);
  if (filters.requiresCosign !== undefined) all = all.filter((a) => a.requiresCosign === filters.requiresCosign);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function resolveClinicalAlert(
  id: string,
  status: Extract<ClinicalAlertStatus, "cosigned" | "sent_back">,
  resolvedBy: string
): Promise<void> {
  await ensureSeeded();
  await db.clinicalAlerts.update(id, {
    status,
    resolvedBy,
    resolvedAt: new Date().toISOString(),
  });
}
