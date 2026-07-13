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
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/lib/auth/useAuth";
import { ROLE_HOME_ROUTE } from "@/lib/auth/roles";

const TRUST_ITEMS = [
  { icon: Clock, label: "Under a minute" },
  { icon: Lock, label: "No account needed" },
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

export default function Home() {
  const router = useRouter();
  const { role, hasHydrated } = useAuth();

  useEffect(() => {
    if (!hasHydrated) return;
    if (role) router.replace(ROLE_HOME_ROUTE[role]);
  }, [hasHydrated, role, router]);

  // Signed-in professionals never see the public landing page — it's not part of their workspace.
  if (!hasHydrated || role) return null;

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
        <div className="mx-auto mb-6 grid size-20 place-items-center rounded-3xl bg-gradient-brand shadow-glow">
          <ShieldCheck className="size-10 text-white" aria-hidden="true" />
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
            Start my free check
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

      <section id="how-we-operate" className="mx-auto max-w-5xl scroll-mt-24 px-5 pb-16 pt-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-secondary backdrop-blur">
            <ListChecks className="size-3.5 text-brand" aria-hidden="true" />
            How We Operate
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            From prescription to peace of mind, in four steps
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-secondary sm:text-base">
            Every check runs the same rigorous process, whether you&rsquo;re a patient checking a
            pharmacy bag at home or a clinician reviewing a chart.
          </p>
        </div>

        <div className="stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OPERATING_STEPS.map(({ icon: Icon, title, description }, index) => (
            <Card key={title} className="h-full">
              <CardBody>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-subtle">
                    <Icon className="size-5 text-brand" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-subtle">STEP {index + 1}</span>
                </div>
                <p className="mt-3 font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface/60 p-5 text-center text-sm text-muted-foreground backdrop-blur-sm sm:p-6">
          Built on Ghana&rsquo;s Standard Treatment Guidelines &amp; Essential Medicines List
          (7th Edition) and interaction data sourced directly from FDA drug labels. MediGuard is a
          screening aid, not a replacement for professional medical or pharmacist advice.
        </div>
      </section>
    </div>
  );
}
