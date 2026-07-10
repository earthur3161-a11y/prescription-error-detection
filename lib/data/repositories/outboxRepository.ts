import { db, ensureSeeded } from "../db";
import type { OutboxItem, OutboxItemType } from "../../types";

export async function enqueueOutboxItem(type: OutboxItemType, payloadId: string): Promise<void> {
  await ensureSeeded();
  await db.outbox.put({
    type,
    payloadId,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}

export async function listPendingOutboxItems(): Promise<OutboxItem[]> {
  await ensureSeeded();
  return db.outbox.where("status").equals("pending").toArray();
}

export async function syncOutbox(): Promise<number> {
  await ensureSeeded();
  const pending = await listPendingOutboxItems();
  await Promise.all(
    pending.map((item) => db.outbox.update(item.id!, { status: "synced" }))
  );
  return pending.length;
}
