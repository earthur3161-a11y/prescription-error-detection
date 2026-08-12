"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/lib/auth/useAuth";
import { ROLE_HOME_ROUTE, ROLE_LABELS, ROLE_PRODUCT } from "@/lib/auth/roles";
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
  const { user, role, hasHydrated, logout } = useAuth();
  const product = role ? ROLE_PRODUCT[role] : undefined;

  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<MobileMoneyProvider>("mtn");

  // Distinct from `subscription` below: that only ever tells us "active" or
  // not (the webhook never touches it on failure — 0006_subscriptions.sql),
  // so it alone can't tell "still pending" apart from "definitively failed."
  // This is what makes a declined/abandoned/reversed charge visible at all.
  const paymentStatus = useSubscriptionPaymentStatus(paymentReference);
  // A payment is "in flight" from the moment it's initiated until we know it
  // succeeded — derived every render, not tracked as its own state that has
  // to be manually reset back to false once activation is observed. Once
  // paymentStatus settles to "success" it stays "success" (a historical fact
  // about that payment, independent of whatever the subscription does
  // later), so this needs no reset step and nothing ever goes stale.
  const isPaying = paymentReference !== null && paymentStatus.data?.status !== "success";
  const subscription = useSubscriptionStatus(product ?? null, isPaying);
  const initiatePayment = useInitiateSubscriptionPayment();
  const paymentTimedOut = usePaymentTimeout(paymentStatus.data?.status === "pending", PAYMENT_TIMEOUT_MS);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!role || !product) router.replace("/login");
  }, [hasHydrated, role, product, router]);

  // Fires exactly once per activation: paymentReference is only set once a
  // real payment was initiated, and isActive only transitions false -> true
  // once per reference, so this effect's own dependencies don't repeat.
  useEffect(() => {
    if (paymentReference && subscription.data?.isActive) {
      showToast({ title: "Subscription active", description: "You're all set.", variant: "success" });
    }
  }, [paymentReference, subscription.data?.isActive, showToast]);

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
    setPaymentReference(null);
  }

  const isActive = subscription.data?.isActive ?? false;
  const paymentFailed = paymentReference !== null && paymentStatus.data?.status === "failed";

  return (
    <div className="bg-hero flex min-h-screen flex-col items-center justify-center px-4 py-10">
      {/*
        A plain link, not a sign-out action: app/page.tsx knows to hold a
        signed-in, unsubscribed professional on the public homepage instead
        of bouncing them straight to ROLE_HOME_ROUTE (which SubscriptionGuard
        would just send right back here) — see the comment there. That's
        what makes a simple "/" href work without looping.
      */}
      <Link href="/" className="mb-6 text-sm font-medium text-muted-foreground transition-colors hover:text-brand">
        ← Return home
      </Link>
      <Card className="w-full max-w-md animate-fade-up shadow-md">
        <CardBody className="space-y-5">
          {/*
            Landing here doesn't always mean "I want to pay" — an already
            signed-in-but-unsubscribed account reaches this page automatically
            (SubscriptionGuard, arrived at via /login's own "already signed
            in, skip the chooser" redirect) with no chance to pick a
            different portal first. Put front and center, above the fold,
            not a small link a returning user can miss — that's what a
            reported "Health Professionals only shows one portal" bug traces
            back to almost every time.
          */}
          <Notice tone="neutral">
            Signed in as <span className="font-semibold">{user?.name}</span> — {ROLE_LABELS[role]}.{" "}
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="font-semibold underline underline-offset-2 hover:text-foreground"
            >
              Not you? Sign out
            </button>
          </Notice>

          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground">{PRODUCT_LABEL[product]} subscription</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              GHS {PRODUCT_PRICE_GHS[product]} / month via Mobile Money.
            </p>
          </div>

          {/*
            Each branch below is keyed and carries animate-scale-in — without
            an explicit key, React can leave a structurally-similar branch
            mounted across a state change (e.g. isPaying -> paymentFailed are
            both "space-y-*, text-center") and the CSS animation, which only
            plays on mount, silently never replays. The polling that drives
            these transitions (useSubscriptionStatus/useSubscriptionPaymentStatus,
            both refetch every 3s while in flight) is exactly the kind of
            background update that used to hard-cut from one branch to the
            next with zero transition.
          */}
          {subscription.isLoading ? (
            <div key="loading" className="flex justify-center py-4">
              <Loader2 className="size-5 animate-spin text-subtle" aria-hidden="true" />
            </div>
          ) : isActive ? (
            <div key="active" className="animate-scale-in space-y-4">
              <Notice tone="safe" icon={ShieldCheck}>
                Active until {subscription.data?.periodEnd ? new Date(subscription.data.periodEnd).toLocaleDateString() : "—"}.
              </Notice>
              <Button size="lg" className="w-full" onClick={() => router.push(ROLE_HOME_ROUTE[role])}>
                Continue to {PRODUCT_LABEL[product]}
              </Button>
            </div>
          ) : paymentFailed ? (
            <div key="failed" className="animate-scale-in space-y-4 text-center">
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
          ) : isPaying ? (
            <div key="paying" className="animate-scale-in space-y-3 text-center">
              <Loader2 className="mx-auto size-8 animate-spin text-brand" aria-hidden="true" />
              <p className="text-sm text-secondary">Approve the payment request on your phone to activate.</p>
              {paymentTimedOut && <p className="text-sm text-caution-fg">Didn&rsquo;t get the prompt?</p>}
              <Button variant="secondary" className="w-full" onClick={resetToForm}>
                {paymentTimedOut ? "Try again" : "Cancel"}
              </Button>
            </div>
          ) : (
            <div key="form" className="animate-scale-in space-y-3">
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
