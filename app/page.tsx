"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  FileCheck,
  ListChecks,
  Lock,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StepBadge } from "@/components/ui/StepBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { useAuth } from "@/lib/auth/useAuth";
import { ROLE_HOME_ROUTE, ROLE_PRODUCT } from "@/lib/auth/roles";
import { useSubscriptionStatus } from "@/lib/query/hooks/useSubscriptionStatus";
import { useCheckQuota } from "@/lib/query/hooks/useCheckQuota";
import { useLastCheckPhone } from "@/lib/utils/lastCheckPhone";

const TRUST_ITEMS = [
  { icon: Clock, label: "Under a minute" },
  { icon: Lock, label: "Just your phone number" },
  { icon: ShieldCheck, label: "Private & confidential" },
];

const OPERATING_STEPS = [
  {
    icon: ListChecks,
    title: "Tell us what you have",
    description: "Add each medicine from your prescription or pharmacy bag by name — no technical detail required.",
  },
  {
    icon: ScanSearch,
    title: "We cross-check everything",
    description:
      "Every combination is screened for interactions, allergy conflicts, and dosing concerns, sourced from Ghana's EML/STG and FDA drug labels.",
  },
  {
    icon: FileCheck,
    title: "Get a plain-language result",
    description: "See clearly whether anything needs a second look — with an honest note on what was and wasn't checked.",
  },
  {
    icon: Stethoscope,
    title: "Follow up when it matters",
    description: "Any caution or blocked result points you straight back to a pharmacist or physician before you take anything.",
  },
];

// Illustrative only — not a real check. Deliberately generic, common OTC/Rx
// names rather than anything resembling a real patient's data, and the
// whole card is aria-hidden (VerdictMark's role="status"/aria-label is
// written for a genuine result; an AT user must not hear this as one — the
// headline right next to it already carries the page's real message).
const EXAMPLE_CHECK: { name: string; verdict: "safe" | "caution" }[] = [
  { name: "Paracetamol", verdict: "safe" },
  { name: "Amoxicillin + Warfarin", verdict: "caution" },
];

export default function Home() {
  const router = useRouter();
  const { role, hasHydrated } = useAuth();
  const product = role ? ROLE_PRODUCT[role] : undefined;
  // Only fires for prescriber/pharmacist (enabled: !!product) — a no-op query
  // for every anonymous visitor and every admin/superadmin.
  const subscription = useSubscriptionStatus(product ?? null, false);
  const resolvingSubscription = !!product && subscription.isLoading;
  // A signed-in prescriber/pharmacist without an active subscription has no
  // reachable ROLE_HOME_ROUTE (SubscriptionGuard would just bounce them to
  // /billing) — redirecting them away from here anyway turned /billing's
  // "return home" link into a loop back to itself. Holding them here instead
  // is what makes that link actually work, without forcing a sign-out. Kept
  // separate from resolvingSubscription so an actively-subscribed user still
  // redirects the instant their status resolves, with no marketing-page flash.
  const subscriptionInactive = !!product && !subscription.isLoading && !subscription.data?.isActive;

  useEffect(() => {
    if (!hasHydrated || resolvingSubscription || subscriptionInactive) return;
    if (role) router.replace(ROLE_HOME_ROUTE[role]);
  }, [hasHydrated, role, resolvingSubscription, subscriptionInactive, router]);

  // useLastCheckPhone is hydration-safe (returns null for the server/first-
  // client render, same as every other visitor, then corrects itself) — the
  // default "Start my free check" copy below is what both the server and
  // the first client render always agree on; this can only ever change it
  // after.
  const lastPhone = useLastCheckPhone();
  const quota = useCheckQuota(lastPhone);
  const freeCheckExhausted = !!quota.data && quota.data.freeRemaining === 0 && quota.data.paidAvailable === 0;

  // Signed-in professionals with workspace access never see the public
  // landing page — it's not part of their workspace. Still resolving their
  // subscription status keeps this blank rather than risking a flash of
  // either the marketing page or a redirect that gets reversed a moment later.
  if (!hasHydrated || resolvingSubscription) return null;
  if (role && !subscriptionInactive) return null;

  return (
    <div className="bg-hero min-h-screen">
      <header className="sticky top-0 z-20 glass border-b border-border/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
              <ShieldCheck className="size-5 text-white" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold text-foreground">MediGuard</span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/login"
              className="rounded-lg border border-border-strong px-2.5 py-2 text-sm font-medium text-secondary transition-colors hover:border-brand hover:text-brand sm:px-3"
            >
              Health Professionals
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 pb-8 pt-10 text-center animate-fade-up sm:pt-16">
        <div
          aria-hidden="true"
          className="mx-auto mb-6 w-full max-w-[15rem] rounded-2xl border border-border bg-surface/80 p-3.5 text-left shadow-lg backdrop-blur"
        >
          <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-subtle">
            Example check
          </p>
          <div className="space-y-1.5">
            {EXAMPLE_CHECK.map((line) => (
              <div
                key={line.name}
                className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2"
              >
                <span className="truncate text-sm font-medium text-foreground">{line.name}</span>
                <VerdictMark verdict={line.verdict} size="chip" />
              </div>
            ))}
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-secondary backdrop-blur">
          <Sparkles className="size-3.5 text-brand" aria-hidden="true" />
          Trusted independent medicine check
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Make sure your prescription is <span className="text-gradient-brand">safe</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-secondary">
          MediGuard cross-checks your medicines against Ghana&rsquo;s Essential Medicines List and
          verified drug-safety data, flagging anything a pharmacist or doctor should confirm — before
          you take it.
        </p>
        <Link href="/check">
          <Button size="lg" className="mt-8 w-full">
            <Sparkles className="size-5" aria-hidden="true" />
            {freeCheckExhausted ? "Start My Check" : "Start my free check"}
          </Button>
        </Link>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {TRUST_ITEMS.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon className="size-3.5 text-brand" aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
      </main>

      <section id="how-we-operate" className="scroll-mt-24 bg-surface-2 py-14 sm:py-16">
        <div className="mx-auto max-w-3xl px-5">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">How we operate</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              From prescription to peace of mind, in four steps
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-secondary sm:text-base">
              Every check runs the same rigorous process, whether you&rsquo;re a patient checking a
              pharmacy bag at home or a clinician reviewing a chart.
            </p>
          </div>

          <div className="stagger mx-auto mt-10 max-w-md">
            {OPERATING_STEPS.map(({ icon: Icon, title, description }, index) => (
              <div key={title} className="relative flex gap-4 pb-8 last:pb-0">
                {index < OPERATING_STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-5 top-11 h-[calc(100%-1.75rem)] w-px bg-border"
                  />
                )}
                <StepBadge step={index + 1} size="md" className="relative z-10 shrink-0" />
                <div className="pt-1">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-brand" aria-hidden="true" />
                    <p className="font-semibold text-foreground">{title}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface/60 p-5 text-center text-sm text-muted-foreground backdrop-blur-sm sm:p-6">
            Built on Ghana&rsquo;s Standard Treatment Guidelines &amp; Essential Medicines List
            (7th Edition) and interaction data sourced directly from FDA drug labels. MediGuard is a
            screening aid, not a replacement for professional medical or pharmacist advice.
          </div>
        </div>
      </section>
    </div>
  );
}
