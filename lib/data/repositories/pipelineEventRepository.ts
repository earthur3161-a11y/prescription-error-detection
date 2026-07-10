import { db, ensureSeeded } from "../db";
import { generateId } from "../../utils/id";
import type { PipelineEvent } from "../../types";

/**
 * Append-only trace of Admin-checkpoint pipeline steps. Mirrors
 * overrideLogRepository's shape: no update/delete export, since this is
 * part of the immutable audit trail.
 */
export async function appendPipelineEvent(entry: Omit<PipelineEvent, "id" | "timestamp">): Promise<PipelineEvent> {
  await ensureSeeded();
  const event: PipelineEvent = {
    ...entry,
    id: generateId("pev"),
    timestamp: new Date().toISOString(),
  };
  await db.pipelineEvents.put(event);
  return event;
}

export async function listPipelineEvents(prescriptionId: string): Promise<PipelineEvent[]> {
  await ensureSeeded();
  const all = await db.pipelineEvents.where("prescriptionId").equals(prescriptionId).toArray();
  return all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function listAllPipelineEvents(): Promise<PipelineEvent[]> {
  await ensureSeeded();
  const all = await db.pipelineEvents.toArray();
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
