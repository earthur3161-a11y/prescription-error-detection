"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/lib/auth/useAuth";
import { ROLE_HOME_ROUTE } from "@/lib/auth/roles";

// Colors trace the same --gradient-brand story the homepage hero badge uses
// (blue -> indigo -> teal, app/globals.css) rather than inventing a new
// palette: Physician sits at the graphite/brand end already used everywhere
// else a "clinical, not consumer" surface needs an accent; Pharmacy takes
// the teal end, which this app already uses nowhere else as a role color —
// real, distinct identity per portal instead of two cards sharing one tint
// (Facility Admin used to sit on the same brand tint as Physician; removing
// it happens to resolve that, not just free up a slot).
const PORTALS = [
  {
    href: "/physician/login",
    name: "Physician",
    description: "Prescribe with live decision support — every drug screened before it reaches the patient.",
    icon: Stethoscope,
    badgeClass: "bg-brand-subtle text-brand",
    ringClass: "group-hover:border-brand/40",
  },
  {
    href: "/pharmacy/login",
    name: "Pharmacy",
    description: "Verify, dispense, and counsel — with a hard safety gate before anything leaves the shelf.",
    icon: ClipboardCheck,
    badgeClass: "bg-brand-teal/10 text-brand-teal",
    ringClass: "group-hover:border-brand-teal/40",
  },
] as const;

export default function LoginChooserPage() {
  const router = useRouter();
  const { role, hasHydrated } = useAuth();

  useEffect(() => {
    if (hasHydrated && role) router.replace(ROLE_HOME_ROUTE[role]);
  }, [hasHydrated, role, router]);

  return (
    <div className="bg-hero flex min-h-screen flex-col items-center px-4 py-10">
      <div className="mb-2 flex w-full max-w-md items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <ShieldCheck className="size-5 text-white" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold text-foreground">MediGuard</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="mb-6 animate-fade-up text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-secondary backdrop-blur">
            <Sparkles className="size-3.5 text-brand" aria-hidden="true" />
            For registered health professionals
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">Choose your portal</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Each professional role signs in through its own dedicated, screened portal.
          </p>
        </div>

        <div className="stagger space-y-3">
          {PORTALS.map((portal) => {
            const Icon = portal.icon;
            return (
              <Link
                key={portal.href}
                href={portal.href}
                className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <Card interactive className={`border-2 border-transparent transition-colors ${portal.ringClass}`}>
                  <CardBody className="flex items-center gap-4">
                    <div className={`grid size-12 shrink-0 place-items-center rounded-2xl ${portal.badgeClass}`}>
                      <Icon className="size-6" aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{portal.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{portal.description}</p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="text-lg text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                    >
                      →
                    </span>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Just picked up a prescription yourself?{" "}
          <Link href="/check" className="font-medium text-brand hover:underline">
            Check your medicine
          </Link>{" "}
          — sign in with just your phone number for 3 free checks.
        </p>
        <p className="mt-3 text-center text-xs text-subtle">
          MediGuard staff?{" "}
          <Link href="/superadmin/login" className="hover:underline">
            Operations sign-in
          </Link>
        </p>
      </div>
    </div>
  );
}
