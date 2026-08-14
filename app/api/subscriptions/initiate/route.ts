import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";
import type { Database } from "@/lib/supabase/types";
import { toE164Gh } from "@/lib/utils/phone";

type SubscriptionPaymentInsert = Database["public"]["Tables"]["subscription_payments"]["Insert"];

const bodySchema = z.object({
  phone: z.string().min(6),
  provider: z.enum(["mtn", "vod", "atl"]),
});

const ROLE_PRODUCT: Record<"prescriber" | "pharmacist", "physician_portal" | "pharmacy_portal"> = {
  prescriber: "physician_portal",
  pharmacist: "pharmacy_portal",
};

const PRODUCT_PRICE_ENV: Record<"physician_portal" | "pharmacy_portal", string> = {
  physician_portal: "NEXT_PUBLIC_PHYSICIAN_PORTAL_PRICE_PESEWAS",
  pharmacy_portal: "NEXT_PUBLIC_PHARMACY_PORTAL_PRICE_PESEWAS",
};

const PERIOD_DAYS = 30;

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error("[subscriptions/initiate] Missing PAYSTACK_SECRET_KEY.");
    return Response.json({ error: "not_configured", message: "Payments are not fully configured yet." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return Response.json({ error: "unauthorized", message: "Missing bearer token." }, { status: 401 });
  }
  const { data: callerData, error: callerError } = await supabaseService.auth.getUser(token);
  if (callerError || !callerData.user) {
    return Response.json({ error: "unauthorized", message: "Invalid or expired session." }, { status: 401 });
  }
  const role = callerData.user.app_metadata?.role as "prescriber" | "pharmacist" | undefined;
  if (role !== "prescriber" && role !== "pharmacist") {
    return Response.json(
      { error: "forbidden", message: "Only Physician and Pharmacy Portal accounts subscribe here." },
      { status: 403 }
    );
  }
  const product = ROLE_PRODUCT[role];

  const priceStr = process.env[PRODUCT_PRICE_ENV[product]];
  const amountPesewas = Number(priceStr);
  if (!priceStr || !Number.isFinite(amountPesewas) || amountPesewas <= 0) {
    console.error(`[subscriptions/initiate] Missing/invalid ${PRODUCT_PRICE_ENV[product]}:`, priceStr);
    return Response.json({ error: "not_configured", message: "Payments are not fully configured yet." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request", message: "A phone number and mobile money provider (mtn/vod/atl) are required." },
      { status: 422 }
    );
  }
  // Its sibling, payments/initiate, normalizes for the same reason: Paystack's
  // mobile_money charge needs E.164 to route correctly. This route never did,
  // sending whatever raw shape the client typed (e.g. "0244 123 456")
  // straight through.
  const phone = toE164Gh(parsed.data.phone);
  const { provider } = parsed.data;

  // Re-check current status server-side — never trust the client's cached
  // subscription state before charging real money.
  const { data: existing } = await supabaseService
    .from("subscriptions")
    .select("status, period_end")
    .eq("owner_id", callerData.user.id)
    .eq("product", product)
    .maybeSingle();
  if (existing?.status === "active" && existing.period_end && new Date(existing.period_end) > new Date()) {
    return Response.json({ error: "already_active", message: "Your subscription is already active." }, { status: 409 });
  }

  // Paystack's charge endpoint requires an email even for Mobile Money
  // charges — the account's own login email doubles for this (unlike the
  // anonymous Patient Self-Check flow, an authenticated caller always has one).
  const email = callerData.user.email ?? `${callerData.user.id}@subscriber.mediguard.app`;

  const paystackRes = await fetch("https://api.paystack.co/charge", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amountPesewas,
      currency: "GHS",
      mobile_money: { phone, provider },
    }),
  });

  const paystackBody = (await paystackRes.json()) as {
    status?: boolean;
    message?: string;
    data?: { reference?: string; display_text?: string };
  };

  if (!paystackRes.ok || !paystackBody.status || !paystackBody.data?.reference) {
    console.error("[subscriptions/initiate] Paystack charge failed:", paystackRes.status, paystackBody);
    return Response.json(
      { error: "charge_failed", message: paystackBody.message ?? "Couldn't start the payment. Try again." },
      { status: 502 }
    );
  }

  const insert: SubscriptionPaymentInsert = {
    owner_id: callerData.user.id,
    product,
    amount_pesewas: amountPesewas,
    period_days: PERIOD_DAYS,
    provider: "paystack",
    provider_reference: paystackBody.data.reference,
    status: "pending",
  };
  const { error: insertError } = await supabaseService.from("subscription_payments").insert(insert);
  if (insertError) {
    console.error("[subscriptions/initiate] Failed to record pending payment:", insertError);
    return Response.json({ error: "internal_error", message: "Couldn't start the payment. Try again." }, { status: 500 });
  }

  return Response.json({
    reference: paystackBody.data.reference,
    displayMessage: paystackBody.data.display_text ?? "Check your phone to approve the payment.",
  });
}
