"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/lib/auth/useAuth";
import { ROLE_HOME_ROUTE } from "@/lib/auth/roles";
import { useToastStore } from "@/lib/store/toast-store";
import {
  useInitiateSubscriptionPayment,
  useSubscriptionPaymentStatus,
  useSubscriptionStatus,
} from "@/lib/query/hooks/useSubscriptionStatus";
import { usePaymentTimeout } from "@/lib/hooks/usePaymentTimeout";
import { isValidGhPhone } from "@/lib/utils/phone";
import type { SubscriptionProduct } from "@/lib/supabase/types";

const PAYMENT_TIMEOUT_MS = 2 * 60 * 1000;

type MobileMoneyProvider = "mtn" | "vod" | "atl";

const PROVIDERS: { value: MobileMoneyProvider; label: string }[] = [
  { value: "mtn", label: "MTN Mobile Money" },
  { value: "vod", label: "Vodafone Cash" },
  { value: "atl", label: "AirtelTigo Money" },
];

const ROLE_PRODUCT: Partial<Record<string, SubscriptionProduct>> = {
  prescriber: "physician_portal",
  pharmacist: "pharmacy_portal",
};

const PRODUCT_LABEL: Record<SubscriptionProduct, string> = {
  physician_portal: "Physician Portal",
  pharmacy_portal: "Pharmacy Portal",
};

const PRODUCT_PRICE_GHS: Record<SubscriptionProduct, string> = {
  physician_portal: ((Number(process.env.NEXT_PUBLIC_PHYSICIAN_PORTAL_PRICE_PESEWAS) || 0) / 100).toFixed(2),
  pharmacy_portal: ((Number(process.env.NEXT_PUBLIC_PHARMACY_PORTAL_PRICE_PESEWAS) || 0) / 100).toFixed(2),
};

export default function BillingPage() {
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  const { role, hasHydrated, logout } = useAuth();
  const product = role ? ROLE_PRODUCT[role] : undefined;

  const [paying, setPaying] = useState(false);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<MobileMoneyProvider>("mtn");

  const subscription = useSubscriptionStatus(product ?? null, paying);
  const initiatePayment = useInitiateSubscriptionPayment();
  // Distinct from `subscription` above: that only ever tells us "active" or
  // not (the webhook never touches it on failure — 0006_subscriptions.sql),
  // so it alone can't tell "still pending" apart from "definitively failed."
  // This is what makes a declined/abandoned/reversed charge visible at all.
  const paymentStatus = useSubscriptionPaymentStatus(paying ? paymentReference : null);
  const paymentTimedOut = usePaymentTimeout(paying && paymentStatus.data?.status === "pending", PAYMENT_TIMEOUT_MS);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!role || !product) router.replace("/login");
  }, [hasHydrated, role, product, router]);

  useEffect(() => {
    if (paying && subscription.data?.isActive) {
      setPaying(false);
      showToast({ title: "Subscription active", description: "You're all set.", variant: "success" });
    }
  }, [paying, subscription.data?.isActive, showToast]);

  if (!hasHydrated || !role || !product) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-subtle" aria-hidden="true" />
      </div>
    );
  }

  function handlePay() {
    if (!isValidGhPhone(phone)) {
      showToast({ title: "Enter a valid Ghana phone number", variant: "error" });
      return;
    }
    initiatePayment.mutate(
      { phone: phone.trim(), provider },
      {
        onSuccess: (res) => {
          setPaymentReference(res.reference);
          setPaying(true);
          showToast({ title: "Payment requested", description: res.displayMessage, variant: "default" });
        },
        onError: (err: Error) => showToast({ title: "Couldn't start payment", description: err.message, variant: "error" }),
      }
    );
  }

  // Shared by "Cancel" (immediate, user-initiated) and "Try again" (after a
  // detected failure or timeout) — both mean the same thing: abandon this
  // attempt and return to the form. A fresh handlePay() call always gets a
  // brand-new reference from the server, so there's no risk of this stale
  // one being reused or confused with a later attempt.
  function resetToForm() {
    setPaying(false);
    setPaymentReference(null);
  }

  const isActive = subscription.data?.isActive ?? false;
  const paymentFailed = paying && paymentStatus.data?.status === "failed";

  return (
    <div className="bg-hero flex min-h-screen flex-col items-center justify-center px-4 py-10">
      {/*
        Not a plain link to "/": every role has a ROLE_HOME_ROUTE, and "/"
        immediately redirects any signed-in user straight back into it
        (app/page.tsx) — which SubscriptionGuard then bounces right back
        here, since that's exactly why this user is on /billing in the
        first place. A still-authenticated user has no reachable "home"
        while unsubscribed, so leaving has to mean signing out (same
        action as Topbar's/Super Admin's "Sign out"), not just navigating.
      */}
      <button
        type="button"
        onClick={() => {
          logout();
          router.replace("/");
        }}
        className="mb-6 text-sm font-medium text-muted-foreground transition-colors hover:text-brand"
      >
        ← Sign out
      </button>
      <Card className="w-full max-w-md animate-fade-up shadow-md">
        <CardBody className="space-y-5">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground">{PRODUCT_LABEL[product]} subscription</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              GHS {PRODUCT_PRICE_GHS[product]} / month via Mobile Money.
            </p>
          </div>

          {subscription.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-5 animate-spin text-subtle" aria-hidden="true" />
            </div>
          ) : isActive ? (
            <div className="space-y-4">
              <Notice tone="safe" icon={ShieldCheck}>
                Active until {subscription.data?.periodEnd ? new Date(subscription.data.periodEnd).toLocaleDateString() : "—"}.
              </Notice>
              <Button size="lg" className="w-full" onClick={() => router.push(ROLE_HOME_ROUTE[role])}>
                Continue to {PRODUCT_LABEL[product]}
              </Button>
            </div>
          ) : paymentFailed ? (
            <div className="space-y-4 text-center">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Payment failed</h2>
                <p className="mt-1 text-sm text-secondary">
                  The payment wasn&rsquo;t approved. Nothing was charged — you can try again.
                </p>
              </div>
              <Button variant="secondary" className="w-full" onClick={resetToForm}>
                Try again
              </Button>
            </div>
          ) : paying ? (
            <div className="space-y-3 text-center">
              <Loader2 className="mx-auto size-8 animate-spin text-brand" aria-hidden="true" />
              <p className="text-sm text-secondary">Approve the payment request on your phone to activate.</p>
              {paymentTimedOut && <p className="text-sm text-caution-fg">Didn&rsquo;t get the prompt?</p>}
              <Button variant="secondary" className="w-full" onClick={resetToForm}>
                {paymentTimedOut ? "Try again" : "Cancel"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-secondary">Mobile Money number</label>
                <Input
                  type="tel"
                  inputMode="tel"
                  placeholder="0244 123 456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-secondary">Network</label>
                <Select value={provider} onChange={(e) => setProvider(e.target.value as MobileMoneyProvider)}>
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
              <Button size="lg" className="w-full" onClick={handlePay} disabled={initiatePayment.isPending}>
                {initiatePayment.isPending ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  `Pay GHS ${PRODUCT_PRICE_GHS[product]}`
                )}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
