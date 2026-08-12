"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ClipboardCheck, ShieldCheck, Stethoscope } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth/useAuth";
import { ROLE_HOME_ROUTE } from "@/lib/auth/roles";

const PORTALS = [
  {
    href: "/physician/login",
    name: "Physician",
    description: "Prescribe with live decision support.",
    icon: Stethoscope,
    accent: "bg-brand-subtle",
    iconClass: "text-brand",
  },
  {
    href: "/pharmacy/login",
    name: "Pharmacy",
    description: "Verify and dispense safely.",
    icon: ClipboardCheck,
    accent: "bg-brand-teal/10",
    iconClass: "text-brand-teal",
  },
  {
    href: "/admin/login",
    name: "Facility Admin",
    description: "Oversight, formulary, reporting.",
    icon: Building2,
    accent: "bg-brand-subtle",
    iconClass: "text-brand",
  },
];

export default function LoginChooserPage() {
  const router = useRouter();
  const { role, hasHydrated } = useAuth();

  useEffect(() => {
    if (hasHydrated && role) router.replace(ROLE_HOME_ROUTE[role]);
  }, [hasHydrated, role, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <ShieldCheck className="size-8 text-brand" aria-hidden="true" />
        <span className="text-2xl font-semibold text-foreground">MediGuard</span>
      </Link>

      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <h1 className="text-lg font-semibold text-foreground">Choose your portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each professional role signs in through its own dedicated portal.
          </p>
        </div>

        <div className="stagger space-y-3">
          {PORTALS.map((portal) => {
            const Icon = portal.icon;
            return (
              <Link key={portal.href} href={portal.href}>
                <Card interactive>
                  <CardBody className="flex items-center gap-4">
                    <div className={`flex size-11 items-center justify-center rounded-xl ${portal.accent}`}>
                      <Icon className={`size-6 ${portal.iconClass}`} aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{portal.name}</p>
                      <p className="text-sm text-muted-foreground">{portal.description}</p>
                    </div>
                    <span aria-hidden="true" className="text-subtle">
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
