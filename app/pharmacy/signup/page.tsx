"use client";

import { ClipboardCheck } from "lucide-react";
import { PortalSignupForm } from "@/components/auth/PortalSignupForm";

export default function PharmacySignupPage() {
  return (
    <PortalSignupForm
      config={{
        role: "pharmacist",
        portalName: "Pharmacy Portal",
        tagline: "Verify drugs for conflicts before dispensing, on your own account.",
        loginHref: "/pharmacy/login",
        icon: ClipboardCheck,
        accentClass: "bg-brand-teal/10",
        iconClass: "text-brand-teal",
      }}
    />
  );
}
