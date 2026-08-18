"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2, ShieldCheck, Stethoscope } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/lib/auth/useAuth";
import { ROLE_HOME_ROUTE, ROLE_LABELS, ROLE_PRODUCT } from "@/lib/auth/roles";
import { useToastStore } from "@/lib/store/toast-store";
import {
  useFindPendingSubscriptionPayment,
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

// Same icon/tint pairing as the /login portal chooser (app/login/page.tsx) —
// this is a returning professional's first visual confirmation they're
// paying for the right portal, so it should read as the same identity they
// picked there, not a new one invented for this page.
const PRODUCT_ICON: Record<SubscriptionProduct, ComponentType<{ className?: string }>> = {
  physician_portal: Stethoscope,
  pharmacy_portal: ClipboardCheck,
};
const PRODUCT_ACCENT: Record<SubscriptionProduct, string> = {
  physician_portal: "bg-brand-subtle text-brand",
  pharmacy_portal: "bg-brand-teal/10 text-brand-teal",
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
  const [paymentMessage, setPaymentMessage] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<MobileMoneyProvider>("mtn");
  // Synchronous re-entry guard for handlePay — iOS Safari has a documented
  // history of firing a synthetic click in addition to touchend for a single
  // tap, which can race ahead of initiatePayment.isPending updating in time
  // to disable the button via React's normal render cycle. A ref check is
  // checked/set before any async work starts, so it can't lose that race.
  const payingRef = useRef(false);

  // Resumes tracking a payment this account already started (a previous page
  // load initiated it, then the tab was refreshed/reopened before it
  // resolved) instead of only ever knowing about a reference held in this
  // one mount's own state — otherwise a refresh mid-payment silently drops
  // back to the plain "Pay" form even though a charge may already be
  // going through, which is exactly what "paid but the portal never opened"
  // looks like from here. Applied once, at render time rather than inside a
  // useEffect (react-hooks/set-state-in-effect), the same pattern already
  // used in PrescriptionReasonSection.tsx for resuming from a prop.
  const pendingPayment = useFindPendingSubscriptionPayment(product ?? null);
  const [checkedForPendingPayment, setCheckedForPendingPayment] = useState(false);
  if (!checkedForPendingPayment && pendingPayment.isSuccess && paymentReference === null) {
    setCheckedForPendingPayment(true);
    if (pendingPayment.data) setPaymentReference(pendingPayment.data);
  }

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
    if (payingRef.current) return;
    payingRef.current = true;
    if (!isValidGhPhone(phone)) {
      payingRef.current = false;
      showToast({ title: "Enter a valid Ghana phone number", variant: "error" });
      return;
    }
    initiatePayment.mutate(
      { phone: phone.trim(), provider },
      {
        onSuccess: (res) => {
          setPaymentReference(res.reference);
          setPaymentMessage(res.displayMessage);
          showToast({ title: "Payment requested", description: res.displayMessage, variant: "default" });
          // If Paystack provides an authorization URL, redirect to it for payment
          if (res.authorizationUrl) {
            window.location.href = res.authorizationUrl;
          }
        },
        onError: (err: Error) => showToast({ title: "Couldn't start payment", description: err.message, variant: "error" }),
        onSettled: () => {
          payingRef.current = false;
        },
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
    setPaymentMessage("");
  }

  const isActive = subscription.data?.isActive ?? false;
  const paymentFailed = paymentReference !== null && paymentStatus.data?.status === "failed";
  const ProductIcon = PRODUCT_ICON[product];

  return (
    <div className="bg-hero flex min-h-screen flex-col items-center px-4 py-10">
      {/*
        A plain link, not a sign-out action: app/page.tsx knows to hold a
        signed-in, unsubscribed professional on the public homepage instead
        of bouncing them straight to ROLE_HOME_ROUTE (which SubscriptionGuard
        would just send right back here) — see the comment there. That's
        what makes a simple "/" href work without looping.
      */}
      <Link
        href="/"
        className="mb-6 flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
          <ShieldCheck className="size-5 text-white" aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold text-foreground">MediGuard</span>
      </Link>
      <div className="flex w-full flex-1 flex-col items-center justify-center">
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

          <div className="flex flex-col items-center text-center">
            <div className={`mb-3 flex size-14 items-center justify-center rounded-2xl shadow-sm ${PRODUCT_ACCENT[product]}`}>
              <ProductIcon className="size-7" />
            </div>
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
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{paymentMessage || "Processing payment..."}</p>
                {!paymentMessage && <p className="text-sm text-secondary">Check your phone.</p>}
              </div>
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
    </div>
  );
}
