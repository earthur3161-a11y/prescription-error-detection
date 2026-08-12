"use client";

import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ListRowSkeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useAuth } from "@/lib/auth/useAuth";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { useProfiles } from "@/lib/query/hooks/useProfiles";
import { useOfflineStore } from "@/lib/store/offline-store";
import { usePendingOutbox, useSyncOutbox } from "@/lib/query/hooks/useOutbox";

export default function SettingsPage() {
  const { user } = useAuth();
  const simulateOffline = useOfflineStore((s) => s.simulateOffline);
  const toggleSimulateOffline = useOfflineStore((s) => s.toggleSimulateOffline);
  const { data: pending } = usePendingOutbox();
  const syncOutbox = useSyncOutbox();
  const { data: profiles, isLoading: profilesLoading } = useProfiles();

  return (
    <div className="stagger mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Facility information and offline sync status.</p>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-semibold text-foreground">Facility</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Facility name</p>
              <p className="text-foreground">Accra Community Clinic</p>
            </div>
            <div>
              <p className="text-muted-foreground">Region</p>
              <p className="text-foreground">Greater Accra, Ghana</p>
            </div>
            <div>
              <p className="text-muted-foreground">Formulary</p>
              <p className="text-foreground">Ghana Standard Treatment Guidelines (GH)</p>
            </div>
            <div>
              <p className="text-muted-foreground">Signed in as</p>
              <p className="text-foreground">
                {user?.name} ({user ? ROLE_LABELS[user.role] : ""})
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Offline & Sync</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                The drug formulary and screening rules are cached locally so screening keeps
                working without connectivity. Prescriptions and override logs queue for sync when
                offline.
              </p>
            </div>
            {simulateOffline ? (
              <WifiOff className="size-6 shrink-0 text-caution-fg" aria-hidden="true" />
            ) : (
              <Wifi className="size-6 shrink-0 text-safe-fg" aria-hidden="true" />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Simulate offline mode</p>
              <p className="text-sm text-muted-foreground">
                For demo purposes — forces the app to queue writes instead of syncing immediately.
              </p>
            </div>
            <Switch
              checked={simulateOffline}
              onCheckedChange={toggleSimulateOffline}
              tone="caution"
              aria-label="Simulate offline mode"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-secondary">
              <Badge tone={pending && pending.length > 0 ? "caution" : "safe"}>
                {pending?.length ?? 0} pending sync
              </Badge>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => syncOutbox.mutate()}
              disabled={syncOutbox.isPending}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Sync now
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-semibold text-foreground">Users</h2>
          {profilesLoading ? (
            <ListRowSkeleton />
          ) : (
            <ul className="stagger divide-y divide-border">
              {[...(profiles?.values() ?? [])].map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-foreground">{p.name}</span>
                  <Badge tone="neutral">{ROLE_LABELS[p.role]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
