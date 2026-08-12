"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/lib/store/toast-store";
import { useSendOtp, useVerifyOtp } from "@/lib/query/hooks/usePhoneVerification";
import { isValidGhPhone, toE164Gh } from "@/lib/utils/phone";

type SubStep = "phone" | "otp";

interface SignInStepProps {
  onSignedIn: (phone: string) => void;
}

/**
 * The front door to Patient Self-Check: every patient signs in with their
 * phone number before doing anything else. This is identity verification
 * only (send/verify OTP) — quota and payment are a separate concern, shown
 * later in UnlockCheckStep once there's actually a result to gate.
 */
export function SignInStep({ onSignedIn }: SignInStepProps) {
  const showToast = useToastStore((s) => s.show);

  const [phoneInput, setPhoneInput] = useState("");
  const [confirmedPhone, setConfirmedPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [subStep, setSubStep] = useState<SubStep>("phone");

  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  function handlePhoneSubmit() {
    if (!isValidGhPhone(phoneInput)) {
      showToast({ title: "Enter a valid Ghana phone number", variant: "error" });
      return;
    }
    // Normalized once here, at the single point a phone number enters this
    // flow — onSignedIn threads this exact string through every downstream
    // quota/payment/patient_checks lookup, so this is the only place that
    // needs to get it right for the whole flow to stay consistent.
    const phone = toE164Gh(phoneInput.trim());
    setConfirmedPhone(phone);
    setSubStep("otp");
    sendOtp.mutate(phone, {
      onSuccess: (res) => {
        if (res.alreadyVerified) onSignedIn(phone);
      },
      onError: (err: Error) => showToast({ title: "Couldn't send code", description: err.message, variant: "error" }),
    });
  }

  function handleVerifyCode() {
    if (!confirmedPhone) return;
    verifyOtp.mutate(
      { phone: confirmedPhone, code: code.trim() },
      {
        onSuccess: (res) => {
          if (res.verified) {
            onSignedIn(confirmedPhone);
          } else {
            showToast({ title: "Incorrect code", description: "Check the code and try again.", variant: "error" });
          }
        },
        onError: (err: Error) => showToast({ title: "Couldn't verify code", description: err.message, variant: "error" }),
      }
    );
  }

  if (subStep === "phone") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-brand-subtle">
            <ShieldCheck className="size-7 text-brand" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Sign in to check your medicine</h1>
          <p className="mt-1.5 text-sm text-secondary">
            Signing in gives you <span className="font-medium text-foreground">3 free prescription checks</span> as an
            individual patient. No password, no account to set up — just your phone number.
          </p>
        </div>
        <div>
          <Input
            type="tel"
            inputMode="tel"
            placeholder="0244 123 456"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            aria-label="Phone number"
          />
          <Button size="lg" className="mt-3 w-full" onClick={handlePhoneSubmit} disabled={sendOtp.isPending}>
            {sendOtp.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : "Sign in"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Enter the code we texted you</h2>
        {/*
          Reads demoMode off the actual send response, not
          NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS directly — that flag is also on for
          the real production deployment (it separately gates the seeded
          professional demo logins there), but lib/utils/otpDemoMode.ts's
          isOtpDemoModeAllowed() additionally requires VERCEL_ENV !==
          "production" before the OTP bypass activates. Checking the raw flag
          here showed "enter any digits" to real patients on production, who
          then correctly got "Incorrect code" back for doing exactly that —
          this component has to reflect what the server actually did, not
          re-derive its own guess at the same gate.
        */}
        <p className="mt-1 text-sm text-secondary">
          {sendOtp.data?.demoMode ? "Simulated in this demo — enter any digits." : `Sent to ${confirmedPhone}.`}
        </p>
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
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() => confirmedPhone && sendOtp.mutate(confirmedPhone)}
        disabled={sendOtp.isPending}
      >
        Resend code
      </Button>
    </div>
  );
}
