"use client";

import { use } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { ResultView } from "@/components/patient-check/ResultView";
import { usePatientCheckByShareToken } from "@/lib/query/hooks/usePatientChecks";
import { useFormulary } from "@/lib/query/hooks/useFormulary";

export default function SharedCheckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data: check, isLoading } = usePatientCheckByShareToken(token);
  const { data: formulary } = useFormulary();

  if (isLoading || !formulary) {
    return (
      <div className="flex justify-center pt-16">
        <Loader2 className="size-6 animate-spin text-subtle" aria-hidden="true" />
      </div>
    );
  }

  if (!check) {
    return <p className="pt-16 text-center text-muted-foreground">This shared result link is invalid or has expired.</p>;
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 text-brand" aria-hidden="true" />
        Shared MediGuard self-check result
      </div>
      <ResultView check={check} formulary={formulary} />
    </div>
  );
}
