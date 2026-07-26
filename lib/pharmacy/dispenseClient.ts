import { supabase } from "../supabase/client";
import type { DispenseRecord } from "../types";

export interface DispenseRequest {
  prescriptionId: string;
  lineId: string;
  batchId: string;
  quantity: number;
  partialDispenseReason?: string;
  overrideNote?: string;
}

export interface DispenseApiError {
  error: string;
  message: string;
  verdict?: string;
  flags?: unknown[];
}

export class DispenseError extends Error {
  constructor(
    public readonly body: DispenseApiError,
    public readonly status: number
  ) {
    super(body.message);
  }
}

/**
 * The only path to creating a dispense record — POSTs to the server route
 * that re-screens fresh and enforces the override-note gate. Throws
 * DispenseError (with the parsed API error body) on any rejection, so
 * callers can distinguish "needs an override note" from "out of stock" etc.
 */
export async function dispenseDrug(req: DispenseRequest): Promise<DispenseRecord> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new DispenseError({ error: "unauthorized", message: "Not signed in." }, 401);

  const res = await fetch("/api/pharmacy/dispense", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(req),
  });
  const body = await res.json();
  if (!res.ok) throw new DispenseError(body as DispenseApiError, res.status);
  return body as DispenseRecord;
}
