"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, ShieldCheck, Sparkles, Stethoscope, UserCog } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/lib/auth/useAuth";
import { ROLE_HOME_ROUTE } from "@/lib/auth/roles";

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
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <ShieldCheck className="size-5 text-white" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold text-foreground">MediGuard</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-secondary transition-colors hover:text-brand"
          >
            Healthcare Professionals
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 pb-8 pt-8 text-center animate-fade-up sm:pt-16">
        <div className="mx-auto mb-6 grid size-20 place-items-center rounded-3xl bg-gradient-brand shadow-glow">
          <ShieldCheck className="size-10 text-white" aria-hidden="true" />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-secondary backdrop-blur">
          <Sparkles className="size-3.5 text-brand" aria-hidden="true" />
          Free medication safety check
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Check Your <span className="text-gradient-brand">Medicine</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-secondary">
          A free, quick second check on a prescription — did the doctor or pharmacist make a
          mistake? Takes about a minute. No account, no login needed.
        </p>
        <Link href="/check">
          <Button size="lg" className="mt-8 w-full">
            <Sparkles className="size-5" aria-hidden="true" />
            Check my medicine — it&rsquo;s free
          </Button>
        </Link>
      </main>

      <section className="mx-auto max-w-4xl px-5 pb-16 pt-8">
        <div className="rounded-3xl border border-border bg-surface/60 p-6 shadow-soft backdrop-blur-sm sm:p-8">
          <h2 className="text-center text-lg font-semibold text-foreground">
            For Healthcare Professionals & Institutions
          </h2>
          <p className="mx-auto mt-1.5 max-w-xl text-center text-sm text-muted-foreground">
            Full clinical screening, verification queues, and facility oversight — available to
            subscribed prescribers, pharmacists, and facility admins.
          </p>
          <div className="stagger mt-6 grid gap-4 sm:grid-cols-3">
            <Link href="/physician/login">
              <Card interactive className="h-full">
                <CardBody className="text-center">
                  <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-brand-subtle">
                    <Stethoscope className="size-6 text-brand" aria-hidden="true" />
                  </span>
                  <p className="mt-3 font-semibold text-foreground">Physician</p>
                  <p className="mt-1 text-sm text-muted-foreground">Screen and prescribe with live decision support.</p>
                </CardBody>
              </Card>
            </Link>
            <Link href="/pharmacy/login">
              <Card interactive className="h-full">
                <CardBody className="text-center">
                  <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-brand-teal/10">
                    <ClipboardList className="size-6 text-brand-teal" aria-hidden="true" />
                  </span>
                  <p className="mt-3 font-semibold text-foreground">Pharmacist</p>
                  <p className="mt-1 text-sm text-muted-foreground">Verify, dispense, and manage the full queue.</p>
                </CardBody>
              </Card>
            </Link>
            <Link href="/admin/login">
              <Card interactive className="h-full">
                <CardBody className="text-center">
                  <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-indigo-500/10">
                    <UserCog className="size-6 text-indigo-500" aria-hidden="true" />
                  </span>
                  <p className="mt-3 font-semibold text-foreground">Facility Admin</p>
                  <p className="mt-1 text-sm text-muted-foreground">Institutional oversight, formulary, and integrations.</p>
                </CardBody>
              </Card>
            </Link>
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to MediGuard?{" "}
            <Link href="/request-access" className="font-medium text-brand hover:underline">
              Request access
            </Link>{" "}
            for your facility.
          </p>
        </div>
      </section>
    </div>
  );
}
