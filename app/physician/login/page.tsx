"use client";

import { Stethoscope } from "lucide-react";
import { PortalLoginForm } from "@/components/auth/PortalLoginForm";

export default function PhysicianLoginPage() {
  return (
    <PortalLoginForm
      config={{
        role: "prescriber",
        requestRole: "prescriber",
        portalName: "Physician Portal",
        tagline: "Prescribe with live decision support and route scripts for verification.",
        icon: Stethoscope,
        accentClass: "bg-brand-subtle",
        iconClass: "text-brand",
      }}
    />
  );
}
