"use client";

import { use } from "react";
import Link from "next/link";
import { Home, Loader2 } from "lucide-react";
import { ResultView } from "@/components/patient-check/ResultView";
import { ShareResultPanel } from "@/components/patient-check/ShareResultPanel";
import { ReportIssueButton } from "@/components/patient-check/ReportIssueButton";
import { Button } from "@/components/ui/Button";
import { usePatientCheck } from "@/lib/query/hooks/usePatientChecks";
import { useFormulary } from "@/lib/query/hooks/useFormulary";

export default function CheckResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: check, isLoading } = usePatientCheck(id);
  const { data: formulary } = useFormulary();

  if (isLoading || !formulary) {
    return (
      <div className="flex justify-center pt-16">
        <Loader2 className="size-6 animate-spin text-subtle" aria-hidden="true" />
      </div>
    );
  }

  if (!check) {
    return <p className="pt-16 text-center text-muted-foreground">We couldn&rsquo;t find that result.</p>;
  }

  return (
    <div className="space-y-6 pt-4">
      <ResultView check={check} formulary={formulary} />
      <ShareResultPanel shareToken={check.shareToken} />
      <ReportIssueButton patientCheckId={check.id} />
      <Link href="/check">
        <Button variant="secondary" className="w-full">
          <Home className="size-4" aria-hidden="true" />
          Back to home
        </Button>
      </Link>
    </div>
  );
}
