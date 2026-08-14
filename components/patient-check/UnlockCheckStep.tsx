"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Select } from "@/components/ui/Select";
import { useToastStore } from "@/lib/store/toast-store";
import { useCheckQuota, useInitiatePayment, usePaymentStatus } from "@/lib/query/hooks/useCheckQuota";
import { usePaymentTimeout } from "@/lib/hooks/usePaymentTimeout";

type MobileMoneyProvider = "mtn" | "vod" | "atl";

const PROVIDERS: { value: MobileMoneyProvider; label: string }[] = [
  { value: "mtn", label: "MTN Mobile Money" },
  { value: "vod", label: "Vodafone Cash" },
  { value: "atl", label: "AirtelTigo Money" },
];

const CHECK_PRICE_GHS = ((Number(process.env.NEXT_PUBLIC_CHECK_PRICE_PESEWAS) || 200) / 100).toFixed(2);

const PAYMENT_TIMEOUT_MS = 2 * 60 * 1000;

type SubStep = "unlock" | "paying";

interface UnlockCheckStepProps {
  onUnlocked: (phone: string) => void;
  unlocking: boolean;
  /** Already verified by SignInStep before this component is ever reached. */
  phone: string;
}

/**
 * Gates entry into the screening result behind a free/paid check quota.
 * Phone identity is already verified by SignInStep before this is reached —
 * this is purely "do you have a check available, and if not, pay for one."
 * Real enforcement happens server-side in create_patient_check_with_quota
 * (called by the parent once onUnlocked fires) — everything here is UX
 * around getting to an unlockable state, not the enforcement itself.
 */
export function UnlockCheckStep({ onUnlocked, unlocking, phone }: UnlockCheckStepProps) {
  const showToast = useToastStore((s) => s.show);

  const [subStep, setSubStep] = useState<SubStep>("unlock");
  const [provider, setProvider] = useState<MobileMoneyProvider>("mtn");
  const [paymentReference, setPaymentReference] = useState<string | null>(null);

  const quota = useCheckQuota(phone);
  const initiatePayment = useInitiatePayment();
  const paymentStatus = usePaymentStatus(subStep === "paying" ? paymentReference : null);
  const paymentTimedOut = usePaymentTimeout(subStep === "paying" && paymentStatus.data?.status === "pending", PAYMENT_TIMEOUT_MS);

  useEffect(() => {
    if (subStep === "paying" && paymentStatus.data?.status === "success") {
      onUnlocked(phone);
    }
  }, [subStep, paymentStatus.data?.status, phone, onUnlocked]);

  function handlePay() {
    initiatePayment.mutate(
      { phone, provider },
      {
        onSuccess: (res) => {
          setPaymentReference(res.reference);
          setSubStep("paying");
          showToast({ title: "Payment requested", description: res.displayMessage, variant: "default" });
        },
        onError: (err: Error) => showToast({ title: "Couldn't start payment", description: err.message, variant: "error" }),
      }
    );
  }

  if (quota.isFetching || !quota.data) {
    return (
      <div className="space-y-4 text-center">
        <Loader2 className="mx-auto size-8 animate-spin text-patient" aria-hidden="true" />
        <p className="text-sm text-secondary">Checking your account…</p>
      </div>
    );
  }

  if (subStep === "unlock") {
    const freeRemaining = quota.data.freeRemaining ?? 0;
    const paidAvailable = quota.data.paidAvailable ?? 0;
    const hasCredit = freeRemaining > 0 || paidAvailable > 0;

    if (hasCredit) {
      return (
        <div className="space-y-4">
          <Notice tone="safe" icon={ShieldCheck}>
            {freeRemaining > 0
              ? `You have ${freeRemaining} free check${freeRemaining === 1 ? "" : "s"} remaining.`
              : "You have a paid check ready to use."}
          </Notice>
          <Button size="lg" className="w-full" onClick={() => onUnlocked(phone)} disabled={unlocking}>
            {unlocking ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : "See my result"}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pay to see this result</h2>
          <p className="mt-1 text-sm text-secondary">
            You&rsquo;ve used your 3 free checks. Each additional check is GHS {CHECK_PRICE_GHS}.
          </p>
        </div>
        <Select value={provider} onChange={(e) => setProvider(e.target.value as MobileMoneyProvider)} aria-label="Mobile money network">
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Button size="lg" className="w-full" onClick={handlePay} disabled={initiatePayment.isPending}>
          {initiatePayment.isPending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            `Pay GHS ${CHECK_PRICE_GHS}`
          )}
        </Button>
      </div>
    );
  }

  // subStep === "paying"

  // A declined/abandoned/reversed Mobile Money charge resolves to "failed"
  // as soon as the webhook processes it — often within seconds, well before
  // PAYMENT_TIMEOUT_MS. Must be surfaced immediately: the timeout-driven
  // "Try again" below only ever arms while status is "pending", so without
  // this branch a fast decline left the patient stuck on the spinner with
  // no visible retry at all.
  if (paymentStatus.data?.status === "failed") {
    return (
      <div className="space-y-4 text-center">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Payment failed</h2>
          <p className="mt-1 text-sm text-secondary">
            The payment wasn&rsquo;t approved. Nothing was charged — you can try again.
          </p>
        </div>
        <Button variant="secondary" className="w-full" onClick={() => setSubStep("unlock")}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <Loader2 className="mx-auto size-8 animate-spin text-patient" aria-hidden="true" />
      <div>
        <h2 className="text-lg font-semibold text-foreground">Check your phone</h2>
        <p className="mt-1 text-sm text-secondary">Approve the payment request to see your result.</p>
      </div>
      {paymentTimedOut && (
        <div className="space-y-2">
          <p className="text-sm text-caution-fg">Didn&rsquo;t get the prompt?</p>
          <Button variant="secondary" className="w-full" onClick={() => setSubStep("unlock")}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
