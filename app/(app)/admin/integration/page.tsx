"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Eye, EyeOff, RefreshCw, Settings2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useAppendErrorLog,
  useIntegrationConfig,
  useRecordSync,
  useRegenerateApiKey,
  useUpdateIntegrationConfig,
} from "@/lib/query/hooks/useIntegrationConfig";
import { formatDateTime } from "@/lib/utils/date";
import type { EnforcementLevel } from "@/lib/types";

function ApiKeyRow({ label, apiKey, kind }: { label: string; apiKey: string; kind: "live" | "sandbox" }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const regenerate = useRegenerateApiKey();

  async function handleCopy() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-secondary">{label}</p>
        <code className="text-sm text-muted-foreground">
          {visible ? apiKey : `${apiKey.slice(0, 8)}${"•".repeat(16)}`}
        </code>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide key" : "Show key"}
          className="rounded-lg p-2 text-subtle hover:bg-muted"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
        <button onClick={handleCopy} aria-label="Copy key" className="rounded-lg p-2 text-subtle hover:bg-muted">
          {copied ? <Check className="size-4 text-safe-fg" /> : <Copy className="size-4" />}
        </button>
        <button
          onClick={() => regenerate.mutate(kind)}
          aria-label="Regenerate key"
          className="rounded-lg p-2 text-subtle hover:bg-muted"
        >
          <RefreshCw className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default function IntegrationDashboardPage() {
  const { data: config, isLoading } = useIntegrationConfig();
  const updateConfig = useUpdateIntegrationConfig();
  const recordSync = useRecordSync();
  const appendError = useAppendErrorLog();
  const [webhookDraft, setWebhookDraft] = useState<string | null>(null);

  if (isLoading || !config) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 sm:p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  function handleEnforcementChange(level: EnforcementLevel) {
    if (level === "enforced" && !config!.webhookUrl) {
      appendError.mutate(
        "Cannot enable Enforced mode: no webhook URL configured. Configure one in Setup first."
      );
      return;
    }
    updateConfig.mutate({ enforcementLevel: level });
  }

  const webhookValue = webhookDraft ?? config.webhookUrl ?? "";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Integration Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect MediGuard to your hospital/EHR system, or run standalone.
          </p>
        </div>
        <Link href="/admin/integration/setup">
          <Button variant="secondary" size="sm">
            <Settings2 className="size-4" aria-hidden="true" />
            Setup wizard
          </Button>
        </Link>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary">Mode</p>
              <p className="text-sm text-muted-foreground">
                {config.mode === "standalone"
                  ? "Standalone — MediGuard is the primary prescribing system."
                  : "Integrated — screening is embedded into your existing HIS/EHR."}
              </p>
            </div>
            <Badge tone={config.mode === "integrated" ? "brand" : "neutral"}>{config.mode}</Badge>
          </div>

          {config.mode === "integrated" && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <div>
                <p className="text-sm font-medium text-secondary">Enforcement level</p>
                <p className="text-sm text-muted-foreground">
                  Advisory shows the verdict only. Enforced blocks finalization without a logged
                  override coming back through the API.
                </p>
              </div>
              <Select
                value={config.enforcementLevel}
                onChange={(e) => handleEnforcementChange(e.target.value as EnforcementLevel)}
                className="max-w-[160px]"
              >
                <option value="advisory">Advisory</option>
                <option value="enforced">Enforced</option>
              </Select>
            </div>
          )}
        </CardBody>
      </Card>

      {config.mode === "integrated" && (
        <>
          <Card>
            <CardBody className="space-y-3">
              <h2 className="font-semibold text-foreground">API keys</h2>
              <ApiKeyRow label="Live key" apiKey={config.apiKeyLive} kind="live" />
              <ApiKeyRow label="Sandbox key" apiKey={config.apiKeySandbox} kind="sandbox" />
              <div className="flex gap-3 pt-1 text-sm">
                <Link href="/admin/integration/sandbox" className="font-medium text-brand hover:underline">
                  Open sandbox tester
                </Link>
                <Link href="/admin/integration/docs" className="font-medium text-brand hover:underline">
                  View API, FHIR & CDS Hooks docs
                </Link>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <h2 className="font-semibold text-foreground">Webhook & sync</h2>
              <div className="flex gap-2">
                <Input
                  value={webhookValue}
                  onChange={(e) => setWebhookDraft(e.target.value)}
                  placeholder="https://your-his.example.com/mediguard/webhook"
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    updateConfig.mutate({ webhookUrl: webhookValue || null });
                    setWebhookDraft(null);
                  }}
                >
                  Save
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Last sync: {config.lastSyncAt ? formatDateTime(config.lastSyncAt) : "never"}
                </p>
                <Button size="sm" variant="secondary" onClick={() => recordSync.mutate()}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Sync now
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <h2 className="font-semibold text-foreground">Error logs</h2>
              {config.errorLogs.length === 0 && (
                <p className="text-sm text-muted-foreground">No errors reported.</p>
              )}
              <ul className="space-y-2">
                {config.errorLogs.map((log) => (
                  <li key={log.id} className="rounded-lg bg-blocked-bg px-3 py-2 text-sm text-blocked-fg">
                    <span className="font-medium">{formatDateTime(log.timestamp)}</span> — {log.message}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
