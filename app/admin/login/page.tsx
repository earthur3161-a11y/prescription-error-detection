"use client";

import { Building2 } from "lucide-react";
import { PortalLoginForm } from "@/components/auth/PortalLoginForm";

export default function AdminLoginPage() {
  return (
    <PortalLoginForm
      config={{
        role: "admin",
        requestRole: "admin",
        portalName: "Facility Admin Portal",
        tagline: "Oversee the prescribing pipeline, formulary, and institution-wide reporting.",
        icon: Building2,
        accentClass: "bg-indigo-100",
        iconClass: "text-indigo-600",
      }}
    />
  );
}
