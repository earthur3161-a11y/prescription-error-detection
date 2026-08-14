"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { PageShell } from "@/components/layout/PageShell";
import { useMyApiKeys } from "@/lib/query/hooks/useInstitution";
import type { Flag, Verdict } from "@/lib/screening-engine";

const EXAMPLE_PAYLOAD = {
  patient: {
    dob: "1965-09-03",
    weightKg: 82,
    renalStatus: "impaired",
    allergies: [],
    activeMedications: [{ drugId: "drug_warfarin", startedAt: "2024-06-01" }],
  },
  drug: {
    drugId: "drug_ciprofloxacin",
    doseMg: 500,
    frequencyPerDay: 2,
    durationDays: 7,
    route: "oral",
  },
};

interface ScreenResponse {
  verdict: Verdict;
  [key: string]: unknown;
}

export default function IntegrationSandboxPage() {
  const router = useRouter();
  const { data: apiKeys } = useMyApiKeys();
  const [apiKey, setApiKey] = useState("");
  const [payloadText, setPayloadText] = useState(JSON.stringify(EXAMPLE_PAYLOAD, null, 2));
  const [result, setResult] = useState<ScreenResponse | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasSandboxKey = (apiKeys ?? []).some((k) => k.mode === "sandbox" && !k.revokedAt);

  async function handleRun() {
    setError(null);
    setResult(null);
    setStatus(null);

    if (!apiKey.trim()) {
      setError("Paste a sandbox API key above — mint one on the dashboard if you don't have one yet.");
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setError("That's not valid JSON — check for a missing comma or bracket.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/screen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setStatus(res.status);
      if (!res.ok) {
        setError(data.message ?? `Request failed (HTTP ${res.status}).`);
      } else {
        setResult(data as ScreenResponse);
      }
    } catch (e) {
      setError("Couldn't reach the screening endpoint: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <button
        onClick={() => router.push("/admin/integration")}
        className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to dashboard
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sandbox tester</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sends a live <code>POST /api/v1/screen</code> request — a real HTTP call to the running
          screening API with your key — and shows the exact response your integration receives.
        </p>
      </div>

      {!hasSandboxKey && (
        <Notice tone="caution">
          No active sandbox key yet — mint one on the{" "}
          <Link href="/admin/integration" className="font-medium underline">
            dashboard
          </Link>
          , then paste it below (the raw key is only ever shown once, at mint time).
        </Notice>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-secondary">API key</label>
        <Input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="mg_sandbox_…"
          className="font-mono"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody className="space-y-3">
            <h2 className="text-sm font-semibold text-secondary">Request payload</h2>
            <textarea
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              rows={16}
              spellCheck={false}
              className="w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <Button onClick={handleRun} className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Screening…
                </>
              ) : (
                <>
                  <Play className="size-4" aria-hidden="true" />
                  Send to /api/v1/screen
                </>
              )}
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-secondary">Response</h2>
              {status !== null && (
                <Badge tone={status >= 200 && status < 300 ? "safe" : "blocked"}>HTTP {status}</Badge>
              )}
            </div>
            {error && (
              <Notice tone="blocked" role="alert">
                {error}
              </Notice>
            )}
            {!error && !result && (
              <p className="text-sm text-subtle">Run a test to see the response here.</p>
            )}
            {result && (
              <div className="space-y-3">
                <VerdictMark
                  verdict={result.verdict}
                  flags={Array.isArray(result.flags) ? (result.flags as Flag[]) : []}
                />
                <pre className="overflow-x-auto rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="space-y-1.5 text-sm text-secondary">
          <h2 className="text-sm font-semibold text-secondary">Also available</h2>
          <p>
            <code>GET /cds-services</code> — CDS Hooks discovery, and{" "}
            <code>POST /cds-services/mediguard-screen</code> — returns interruptive EHR cards for a
            set of draft orders. See the{" "}
            <button
              onClick={() => router.push("/admin/integration/docs")}
              className="font-medium text-brand hover:underline"
            >
              integration docs
            </button>{" "}
            for request shapes.
          </p>
        </CardBody>
      </Card>
    </PageShell>
  );
}
