import "server-only";
import { supabaseService } from "../supabase/serviceClient";

/**
 * The check_payments equivalent of resolveSubscriptionPayment.ts — simpler,
 * since a check_payments row has no separate "activation" step to perform.
 * Flipping status to "success" is the whole resolution; a paid credit is
 * consumed lazily, later, whenever create_patient_check_with_quota next runs
 * for this phone and finds a success/unconsumed row (0003_self_check_quota.sql).
 *
 * Guarded by .eq("status", "pending") so this is safe to call more than once
 * for the same reference (webhook retry, or webhook and verify racing each
 * other) — whichever caller gets there first wins.
 */
export async function resolveCheckPayment(reference: string, succeeded: boolean): Promise<{ resolved: boolean }> {
  const { data: rows, error } = await supabaseService
    .from("check_payments")
    .update(succeeded ? { status: "success", verified_at: new Date().toISOString() } : { status: "failed" })
    .eq("provider_reference", reference)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  return { resolved: !!rows && rows.length > 0 };
}
