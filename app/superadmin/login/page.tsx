"use client";

import { ShieldAlert } from "lucide-react";
import { PortalLoginForm } from "@/components/auth/PortalLoginForm";

export default function SuperAdminLoginPage() {
  return (
    <PortalLoginForm
      config={{
        role: "superadmin",
        portalName: "MediGuard Operations",
        tagline: "Internal super-admin — review access requests and provision facility accounts.",
        icon: ShieldAlert,
        accentClass: "bg-brand-subtle",
        iconClass: "text-brand",
      }}
    />
  );
}
