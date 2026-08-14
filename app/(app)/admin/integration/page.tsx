"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Plug, Plus, ShieldAlert, XCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useMintApiKey,
  useMyApiKeys,
  useMyInstitution,
  useRevokeApiKey,
  useUpdateMyEnforcementLevel,
} from "@/lib/query/hooks/useInstitution";
import { formatDateTime } from "@/lib/utils/date";
import type { ApiKeyMode, EnforcementLevel } from "@/lib/types";

function JustMintedKeyNotice({ rawKey, onDismiss }: { rawKey: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Notice tone="caution">
      <div className="space-y-2">
        <p className="font-semibold">Copy this key now — it won&rsquo;t be shown again.</p>
        <code className="block break-all rounded-lg bg-surface px-3 py-2 font-mono text-sm text-foreground">{rawKey}</code>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(rawKey);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Done
          </Button>
        </div>
      </div>
    </Notice>
  );
}

export default function IntegrationDashboardPage() {
  const { data: institution, isLoading: institutionLoading } = useMyInstitution();
  const { data: apiKeys, isLoading: keysLoading } = useMyApiKeys();
  const mintKey = useMintApiKey(institution?.id);
  const revokeKey = useRevokeApiKey(institution?.id);
  const updateEnforcement = useUpdateMyEnforcementLevel();
  const [justMinted, setJustMinted] = useState<string | null>(null);

  if (institutionLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 sm:p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="mx-auto max-w-3xl p-6 sm:p-8">
        <Notice tone="caution" icon={ShieldAlert}>
          No institution is associated with this account yet — contact MediGuard support.
        </Notice>
      </div>
    );
  }

  function handleMint(mode: ApiKeyMode) {
    mintKey.mutate(mode, { onSuccess: (res) => setJustMinted(res.rawKey) });
  }

  const activeKeys = (apiKeys ?? []).filter((k) => !k.revokedAt);
  const revokedKeys = (apiKeys ?? []).filter((k) => k.revokedAt);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Plug className="size-6 text-brand" aria-hidden="true" />
          Integration Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect {institution.name} to MediGuard&rsquo;s screening API from your own prescribing/dispensing system.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary">{institution.name}</p>
              <p className="text-sm text-muted-foreground">
                {institution.status === "active" ? "Active" : "Suspended — API calls will be rejected"}
              </p>
            </div>
            <Badge tone={institution.status === "active" ? "safe" : "blocked"}>{institution.status}</Badge>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <p className="text-sm font-medium text-secondary">Enforcement level</p>
              <p className="text-sm text-muted-foreground">
                Advisory shows the verdict only. Enforced signals your system to block finalizing a
                blocked prescription without a logged override.
              </p>
            </div>
            <Select
              value={institution.enforcementLevel}
              onChange={(e) => updateEnforcement.mutate(e.target.value as EnforcementLevel)}
              className="max-w-[160px]"
            >
              <option value="advisory">Advisory</option>
              <option value="enforced">Enforced</option>
            </Select>
          </div>
        </CardBody>
      </Card>

      {justMinted && <JustMintedKeyNotice rawKey={justMinted} onDismiss={() => setJustMinted(null)} />}

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">API keys</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => handleMint("sandbox")} disabled={mintKey.isPending}>
                {mintKey.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                Sandbox key
              </Button>
              <Button size="sm" onClick={() => handleMint("live")} disabled={mintKey.isPending}>
                {mintKey.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                Live key
              </Button>
            </div>
          </div>

          {keysLoading && <Skeleton className="h-16 w-full" />}
          {!keysLoading && activeKeys.length === 0 && (
            <p className="text-sm text-muted-foreground">No active keys yet — mint one above.</p>
          )}
          <div className="stagger space-y-3">
            {activeKeys.map((key) => (
              <div key={key.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={key.mode === "live" ? "brand" : "neutral"}>{key.mode}</Badge>
                    <code className="font-mono text-sm text-muted-foreground">{key.keyPrefix}…</code>
                  </div>
                  <p className="mt-1 text-xs text-subtle">
                    Created {formatDateTime(key.createdAt)}
                    {key.lastUsedAt ? ` · last used ${formatDateTime(key.lastUsedAt)}` : " · never used"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-blocked-fg hover:text-blocked-fg"
                  onClick={() => revokeKey.mutate(key.id)}
                  disabled={revokeKey.isPending}
                >
                  <XCircle className="size-4" aria-hidden="true" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>
          {revokedKeys.length > 0 && (
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer">{revokedKeys.length} revoked key{revokedKeys.length === 1 ? "" : "s"}</summary>
              <ul className="mt-2 space-y-1">
                {revokedKeys.map((key) => (
                  <li key={key.id} className="text-xs">
                    {key.mode} · {key.keyPrefix}… · revoked {key.revokedAt ? formatDateTime(key.revokedAt) : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}

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
    </div>
  );
}
