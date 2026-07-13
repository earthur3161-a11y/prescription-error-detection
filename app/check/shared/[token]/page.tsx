"use client";

import { use } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { ResultView } from "@/components/patient-check/ResultView";
import { Notice } from "@/components/ui/Notice";
import { usePatientCheckByShareToken } from "@/lib/query/hooks/usePatientChecks";
import { useFormulary } from "@/lib/query/hooks/useFormulary";

export default function SharedCheckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data: check, isLoading } = usePatientCheckByShareToken(token);
  const { data: formulary } = useFormulary();

  if (isLoading || !formulary) {
    return (
      <div className="flex justify-center">
        <Loader2 className="size-6 animate-spin text-subtle" aria-hidden="true" />
      </div>
    );
  }

  if (!check) {
    return <p className="text-center text-muted-foreground">This shared result link is invalid or has expired.</p>;
  }

  return (
    <div className="space-y-6">
      <Notice tone="neutral" icon={ShieldCheck}>
        Shared MediGuard self-check result
      </Notice>
      <ResultView check={check} formulary={formulary} />
    </div>
  );
}
