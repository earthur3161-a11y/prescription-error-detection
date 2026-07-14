"use client";

import { Stethoscope } from "lucide-react";
import { PortalSignupForm } from "@/components/auth/PortalSignupForm";

export default function PhysicianSignupPage() {
  return (
    <PortalSignupForm
      config={{
        role: "prescriber",
        portalName: "Physician Portal",
        tagline: "Screen your own prescriptions for allergies, interactions, and dosing errors.",
        loginHref: "/physician/login",
        icon: Stethoscope,
        accentClass: "bg-brand-subtle",
        iconClass: "text-brand",
      }}
    />
  );
}
