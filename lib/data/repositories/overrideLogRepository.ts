import { db, ensureSeeded } from "../db";
import { generateId } from "../../utils/id";
import type { OverrideLog } from "../../types";

export interface OverrideLogFilters {
  prescriptionId?: string;
  userId?: string;
  from?: string;
  to?: string;
}

/**
 * The only write path for override logs. There is deliberately no update or
 * delete export here — once logged, an override is permanent, per the
 * append-only audit trail requirement.
 */
export async function appendOverrideLog(
  entry: Omit<OverrideLog, "id" | "timestamp">
): Promise<OverrideLog> {
  await ensureSeeded();
  const log: OverrideLog = {
    ...entry,
    id: generateId("ovr"),
    timestamp: new Date().toISOString(),
  };
  await db.overrideLogs.put(log);
  return log;
}

export async function listOverrideLogs(filters: OverrideLogFilters = {}): Promise<OverrideLog[]> {
  await ensureSeeded();
  let all = await db.overrideLogs.toArray();
  if (filters.prescriptionId) all = all.filter((l) => l.prescriptionId === filters.prescriptionId);
  if (filters.userId) all = all.filter((l) => l.userId === filters.userId);
  if (filters.from) all = all.filter((l) => l.timestamp >= filters.from!);
  if (filters.to) all = all.filter((l) => l.timestamp <= filters.to!);
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
