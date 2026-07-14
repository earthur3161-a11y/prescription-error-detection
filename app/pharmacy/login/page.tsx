"use client";

import { ClipboardCheck } from "lucide-react";
import { PortalLoginForm } from "@/components/auth/PortalLoginForm";

export default function PharmacyLoginPage() {
  return (
    <PortalLoginForm
      config={{
        role: "pharmacist",
        signupHref: "/pharmacy/signup",
        portalName: "Pharmacy Portal",
        tagline: "Verify prescriptions, screen for conflicts, and dispense safely.",
        icon: ClipboardCheck,
        accentClass: "bg-teal-100",
        iconClass: "text-brand-teal",
      }}
    />
  );
}
