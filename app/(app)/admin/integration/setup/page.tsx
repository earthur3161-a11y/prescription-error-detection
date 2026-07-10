"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Check, Cable, FlaskConical } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useIntegrationConfig, useUpdateIntegrationConfig } from "@/lib/query/hooks/useIntegrationConfig";
import type { EnforcementLevel, InstitutionMode } from "@/lib/types";

type Step = "choose" | "connect" | "test" | "done";

export default function IntegrationSetupPage() {
  const router = useRouter();
  const { data: config } = useIntegrationConfig();
  const updateConfig = useUpdateIntegrationConfig();

  const [step, setStep] = useState<Step>("choose");
  const [mode, setMode] = useState<InstitutionMode>("standalone");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [enforcementLevel, setEnforcementLevel] = useState<EnforcementLevel>("advisory");

  function handleChooseMode(chosen: InstitutionMode) {
    setMode(chosen);
    if (chosen === "standalone") {
      updateConfig.mutate({ mode: "standalone" }, { onSuccess: () => setStep("done") });
    } else {
      setStep("connect");
    }
  }

  function handleConnect() {
    updateConfig.mutate(
      { mode: "integrated", webhookUrl: webhookUrl || null, enforcementLevel },
      { onSuccess: () => setStep("test") }
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 sm:p-8">
      <button
        onClick={() => router.push("/admin/integration")}
        className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to dashboard
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Institution setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connect MediGuard to how your facility already works.</p>
      </div>

      {step === "choose" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <button onClick={() => handleChooseMode("standalone")} className="text-left">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardBody className="space-y-2">
                <Building2 className="size-6 text-brand" aria-hidden="true" />
                <h2 className="font-semibold text-foreground">Standalone</h2>
                <p className="text-sm text-muted-foreground">
                  MediGuard is your primary prescribing and dispensing system. No existing HIS/EHR
                  to connect to.
                </p>
              </CardBody>
            </Card>
          </button>
          <button onClick={() => handleChooseMode("integrated")} className="text-left">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardBody className="space-y-2">
                <Cable className="size-6 text-brand" aria-hidden="true" />
                <h2 className="font-semibold text-foreground">Integrated</h2>
                <p className="text-sm text-muted-foreground">
                  Keep your existing hospital system — MediGuard screens in the background via API
                  and an embeddable widget.
                </p>
              </CardBody>
            </Card>
          </button>
        </div>
      )}

      {step === "connect" && config && (
        <Card>
          <CardBody className="space-y-4">
            <h2 className="font-semibold text-foreground">Connect your system</h2>
            <div>
              <p className="mb-1.5 text-sm font-medium text-secondary">Your sandbox API key</p>
              <code className="block rounded-lg bg-surface-2 px-3 py-2 text-sm text-secondary">
                {config.apiKeySandbox}
              </code>
              <p className="mt-1 text-xs text-muted-foreground">
                Use this to call the screening API in test mode before going live.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-secondary">
                Webhook URL <span className="text-subtle">(optional — for pushing verdicts back)</span>
              </label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-his.example.com/mediguard/webhook"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-secondary">Enforcement level</label>
              <Select
                value={enforcementLevel}
                onChange={(e) => setEnforcementLevel(e.target.value as EnforcementLevel)}
                className="max-w-[200px]"
              >
                <option value="advisory">Advisory (show only)</option>
                <option value="enforced">Enforced (block on unresolved)</option>
              </Select>
            </div>
            <Button onClick={handleConnect} className="w-full">
              Save & continue to sandbox test
            </Button>
          </CardBody>
        </Card>
      )}

      {step === "test" && (
        <Card>
          <CardBody className="space-y-4 text-center">
            <FlaskConical className="mx-auto size-10 text-brand" aria-hidden="true" />
            <h2 className="font-semibold text-foreground">Test before going live</h2>
            <p className="text-sm text-muted-foreground">
              Run a few sample screenings in the sandbox to confirm your integration is wired up
              correctly.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setStep("done")}>
                Skip for now
              </Button>
              <Button onClick={() => router.push("/admin/integration/sandbox")}>Open sandbox tester</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardBody className="space-y-3 text-center">
            <Check className="mx-auto size-10 text-safe-fg" aria-hidden="true" />
            <h2 className="font-semibold text-foreground">You&rsquo;re set up</h2>
            <p className="text-sm text-muted-foreground">
              {mode === "standalone"
                ? "MediGuard is ready to use as your facility's prescribing system."
                : "Your integration is configured. Head to the dashboard to manage keys and monitor sync."}
            </p>
            <Button onClick={() => router.push("/admin/integration")}>Go to dashboard</Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
