"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { useToastStore } from "@/lib/store/toast-store";
import { useCheckQuota } from "@/lib/query/hooks/useCheckQuota";
import { isValidGhPhone } from "@/lib/utils/phone";

interface ResumeCheckPromptProps {
  /** The phone number currently confirmed for this attempt, if any (lifted up so the parent can show a persistent banner and skip ahead at unlock). */
  confirmedPhone: string | null;
  onConfirm: (phone: string | null) => void;
}

/**
 * Collapsed by default — a first-time patient should never have to look at
 * this. Exists for the patient returning after a Paystack webhook confirmed
 * payment but their tab closed before the app ever saw it: the credit is
 * real and unconsumed (get_check_quota already reports it correctly), but
 * without this they wouldn't learn that until after redoing the drug list
 * and profile from scratch. Same lookup UnlockCheckStep already does at
 * step 3 — just offered here too, at step 1, so the reassurance (and the
 * skip-ahead at unlock) comes before the redo, not after.
 */
export function ResumeCheckPrompt({ confirmedPhone, onConfirm }: ResumeCheckPromptProps) {
  const showToast = useToastStore((s) => s.show);
  const [open, setOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const quota = useCheckQuota(confirmedPhone);

  if (confirmedPhone) {
    if (quota.isFetching) {
      return (
        <div className="flex items-center gap-2 text-sm text-subtle">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Checking {confirmedPhone}…
        </div>
      );
    }
    const hasCredit = (quota.data?.paidAvailable ?? 0) > 0 || (quota.data?.freeRemaining ?? 0) > 0;
    if (hasCredit) {
      return (
        <Notice tone="safe" icon={ShieldCheck} className="animate-fade-in">
          {(quota.data?.paidAvailable ?? 0) > 0
            ? "You have a paid check ready — pick your medicines below and you won't be charged again."
            : `You have ${quota.data?.freeRemaining} free check${quota.data?.freeRemaining === 1 ? "" : "s"} remaining.`}
        </Notice>
      );
    }
    return (
      <div className="flex items-center justify-between gap-3 text-sm text-subtle">
        <span>No check waiting for {confirmedPhone}.</span>
        <button type="button" className="font-medium text-brand hover:underline" onClick={() => onConfirm(null)}>
          Try a different number
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="text-sm font-medium text-brand hover:underline" onClick={() => setOpen(true)}>
        Continuing a check you already paid for?
      </button>
    );
  }

  function handleCheck() {
    if (!isValidGhPhone(phoneInput)) {
      showToast({ title: "Enter a valid Ghana phone number", variant: "error" });
      return;
    }
    onConfirm(phoneInput.trim());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="tel"
        inputMode="tel"
        placeholder="0244 123 456"
        value={phoneInput}
        onChange={(e) => setPhoneInput(e.target.value)}
        aria-label="Phone number used for the previous payment"
        className="max-w-[220px]"
      />
      <Button size="sm" variant="secondary" onClick={handleCheck}>
        Check
      </Button>
    </div>
  );
}
