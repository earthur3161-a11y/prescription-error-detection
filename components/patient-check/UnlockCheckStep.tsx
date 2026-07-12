"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToastStore } from "@/lib/store/toast-store";
import { useCheckQuota, useInitiatePayment, usePaymentStatus } from "@/lib/query/hooks/useCheckQuota";
import { useSendOtp, useVerifyOtp } from "@/lib/query/hooks/usePhoneVerification";

type MobileMoneyProvider = "mtn" | "vod" | "atl";

const PROVIDERS: { value: MobileMoneyProvider; label: string }[] = [
  { value: "mtn", label: "MTN Mobile Money" },
  { value: "vod", label: "Vodafone Cash" },
  { value: "atl", label: "AirtelTigo Money" },
];

const CHECK_PRICE_GHS = ((Number(process.env.NEXT_PUBLIC_CHECK_PRICE_PESEWAS) || 200) / 100).toFixed(2);

const PAYMENT_TIMEOUT_MS = 2 * 60 * 1000;

function isValidGhPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return /^0\d{9}$/.test(digits) || /^233\d{9}$/.test(digits);
}

type SubStep = "phone" | "otp" | "unlock" | "paying";

interface UnlockCheckStepProps {
  onUnlocked: (phone: string) => void;
  unlocking: boolean;
}

/**
 * Gates entry into the screening result behind phone verification and a
 * free/paid check quota. Real enforcement happens server-side in
 * create_patient_check_with_quota (called by the parent once onUnlocked
 * fires) — everything here is UX around getting a phone into an unlockable
 * state, not the enforcement itself.
 */
export function UnlockCheckStep({ onUnlocked, unlocking }: UnlockCheckStepProps) {
  const showToast = useToastStore((s) => s.show);

  const [phoneInput, setPhoneInput] = useState("");
  const [confirmedPhone, setConfirmedPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [provider, setProvider] = useState<MobileMoneyProvider>("mtn");
  const [subStep, setSubStep] = useState<SubStep>("phone");
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentTimedOut, setPaymentTimedOut] = useState(false);
  const otpAutoSent = useRef(false);

  const quota = useCheckQuota(confirmedPhone);
  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();
  const initiatePayment = useInitiatePayment();
  const paymentStatus = usePaymentStatus(subStep === "paying" ? paymentReference : null);

  // Once quota resolves for a freshly-confirmed phone, route to the right
  // sub-step: already verified with credit -> unlock; verified with none ->
  // still unlock (shows the payment option there); not verified -> OTP.
  useEffect(() => {
    if (!quota.data || subStep !== "phone") return;
    setSubStep(quota.data.phoneVerified ? "unlock" : "otp");
  }, [quota.data, subStep]);

  // A failed lookup must never leave the patient stuck on a "Continue"
  // button that silently does nothing — surface it and let them retry.
  useEffect(() => {
    if (!quota.isError || subStep !== "phone") return;
    showToast({ title: "Couldn't reach the server", description: "Check your connection and try again.", variant: "error" });
    setConfirmedPhone(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quota.isError, subStep]);

  // Auto-send the OTP once when entering that sub-step, so the patient
  // doesn't have to press an extra button for the common case.
  useEffect(() => {
    if (subStep !== "otp" || otpAutoSent.current || !confirmedPhone) return;
    otpAutoSent.current = true;
    sendOtp.mutate(confirmedPhone, {
      onSuccess: (res) => {
        if (res.alreadyVerified) setSubStep("unlock");
      },
      onError: (err: Error) => showToast({ title: "Couldn't send code", description: err.message, variant: "error" }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subStep, confirmedPhone]);

  useEffect(() => {
    if (subStep !== "paying" || paymentStatus.data?.status !== "pending") return;
    const timer = setTimeout(() => setPaymentTimedOut(true), PAYMENT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [subStep, paymentStatus.data?.status]);

  useEffect(() => {
    if (subStep === "paying" && paymentStatus.data?.status === "success" && confirmedPhone) {
      onUnlocked(confirmedPhone);
    }
  }, [subStep, paymentStatus.data?.status, confirmedPhone, onUnlocked]);

  function handlePhoneSubmit() {
    if (!isValidGhPhone(phoneInput)) {
      showToast({ title: "Enter a valid Ghana phone number", variant: "error" });
      return;
    }
    otpAutoSent.current = false;
    setConfirmedPhone(phoneInput.trim());
  }

  function handleVerifyCode() {
    if (!confirmedPhone) return;
    verifyOtp.mutate(
      { phone: confirmedPhone, code: code.trim() },
      {
        onSuccess: (res) => {
          if (res.verified) {
            setSubStep("unlock");
            quota.refetch();
          } else {
            showToast({ title: "Incorrect code", description: "Check the code and try again.", variant: "error" });
          }
        },
        onError: (err: Error) => showToast({ title: "Couldn't verify code", description: err.message, variant: "error" }),
      }
    );
  }

  function handlePay() {
    if (!confirmedPhone) return;
    initiatePayment.mutate(
      { phone: confirmedPhone, provider },
      {
        onSuccess: (res) => {
          setPaymentReference(res.reference);
          setPaymentTimedOut(false);
          setSubStep("paying");
          showToast({ title: "Payment requested", description: res.displayMessage, variant: "default" });
        },
        onError: (err: Error) => showToast({ title: "Couldn't start payment", description: err.message, variant: "error" }),
      }
    );
  }

  if (subStep === "phone") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">What's your phone number?</h2>
          <p className="mt-1 text-sm text-secondary">
            You get 3 free checks. After that, a small payment unlocks each additional check.
          </p>
        </div>
        <Input
          type="tel"
          inputMode="tel"
          placeholder="0244 123 456"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          aria-label="Phone number"
        />
        <Button size="lg" className="w-full" onClick={handlePhoneSubmit} disabled={quota.isFetching}>
          {quota.isFetching ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : "Continue"}
        </Button>
      </div>
    );
  }

  if (subStep === "otp") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Enter the code we texted you</h2>
          <p className="mt-1 text-sm text-secondary">Sent to {confirmedPhone}.</p>
        </div>
        <Input
          type="text"
          inputMode="numeric"
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Verification code"
        />
        <Button size="lg" className="w-full" onClick={handleVerifyCode} disabled={verifyOtp.isPending || code.trim().length < 3}>
          {verifyOtp.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : "Verify"}
        </Button>
        <button
          onClick={() => confirmedPhone && sendOtp.mutate(confirmedPhone)}
          disabled={sendOtp.isPending}
          className="w-full text-center text-sm font-medium text-brand hover:underline disabled:opacity-50"
        >
          Resend code
        </button>
      </div>
    );
  }

  if (subStep === "unlock") {
    const freeRemaining = quota.data?.freeRemaining ?? 0;
    const paidAvailable = quota.data?.paidAvailable ?? 0;
    const hasCredit = freeRemaining > 0 || paidAvailable > 0;

    if (hasCredit) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-safe-bg px-4 py-3 text-sm text-safe-fg">
            <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
            {freeRemaining > 0
              ? `You have ${freeRemaining} free check${freeRemaining === 1 ? "" : "s"} remaining.`
              : "You have a paid check ready to use."}
          </div>
          <Button
            size="lg"
            className="w-full"
            onClick={() => confirmedPhone && onUnlocked(confirmedPhone)}
            disabled={unlocking}
          >
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
            You've used your 3 free checks. Each additional check is GHS {CHECK_PRICE_GHS}.
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
  return (
    <div className="space-y-4 text-center">
      <Loader2 className="mx-auto size-8 animate-spin text-brand" aria-hidden="true" />
      <div>
        <h2 className="text-lg font-semibold text-foreground">Check your phone</h2>
        <p className="mt-1 text-sm text-secondary">Approve the payment request to see your result.</p>
      </div>
      {paymentTimedOut && (
        <div className="space-y-2">
          <p className="text-sm text-caution-fg">Didn't get the prompt?</p>
          <Button variant="secondary" className="w-full" onClick={() => setSubStep("unlock")}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
