"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Notice } from "@/components/ui/Notice";
import { useSuperAdminAccounts } from "@/lib/query/hooks/useSuperAdminAccounts";
import { useDataUpdatedPulse } from "@/lib/hooks/useDataUpdatedPulse";
import { filterSuperadminAccounts, SUPERADMIN_ROLE_LABEL, type SuperadminAccountRole } from "@/lib/superadmin/accounts";
import { formatDateTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      </CardBody>
    </Card>
  );
}

export default function SuperAdminAccountsPage() {
  const { accounts, isLoading, isFetching, error, dataUpdatedAt, refetch } = useSuperAdminAccounts();
  const justUpdated = useDataUpdatedPulse(dataUpdatedAt);
  const [role, setRole] = useState<SuperadminAccountRole | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => filterSuperadminAccounts(accounts, { role, query }), [accounts, role, query]);

  const counts = useMemo(
    () => ({
      prescriber: accounts.filter((a) => a.role === "prescriber").length,
      pharmacist: accounts.filter((a) => a.role === "pharmacist").length,
      admin: accounts.filter((a) => a.role === "admin").length,
      patient: accounts.filter((a) => a.role === "patient").length,
    }),
    [accounts]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Users className="size-6 text-brand" aria-hidden="true" />
            Accounts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every account in the system — account metadata only, no clinical data.
          </p>
        </div>
        <div className="text-right">
          <Button variant="secondary" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
            Refresh
          </Button>
          {dataUpdatedAt > 0 && (
            <p className="mt-1 text-xs text-subtle">Updated {formatDateTime(new Date(dataUpdatedAt).toISOString())}</p>
          )}
        </div>
      </div>

      {error && (
        <Notice tone="blocked" title="Couldn't load accounts">
          {error instanceof Error ? error.message : "An unexpected error occurred."}
        </Notice>
      )}

      <div className="stagger grid gap-4 sm:grid-cols-4">
        <StatCard label={SUPERADMIN_ROLE_LABEL.prescriber} value={counts.prescriber} />
        <StatCard label={SUPERADMIN_ROLE_LABEL.pharmacist} value={counts.pharmacist} />
        <StatCard label={SUPERADMIN_ROLE_LABEL.admin} value={counts.admin} />
        <StatCard label={SUPERADMIN_ROLE_LABEL.patient} value={counts.patient} />
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
            <Select value={role} onChange={(e) => setRole(e.target.value as SuperadminAccountRole | "all")}>
              <option value="all">All roles</option>
              <option value="prescriber">{SUPERADMIN_ROLE_LABEL.prescriber}</option>
              <option value="pharmacist">{SUPERADMIN_ROLE_LABEL.pharmacist}</option>
              <option value="admin">{SUPERADMIN_ROLE_LABEL.admin}</option>
              <option value="patient">{SUPERADMIN_ROLE_LABEL.patient}</option>
            </Select>
          </div>
          <div className="min-w-[200px] flex-[2]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Search</label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, contact, institution…" />
          </div>
        </CardBody>
      </Card>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {accounts.length === 0 ? "No accounts found." : "No accounts match these filters."}
        </p>
      )}

      {!isLoading && filtered.length > 0 && (
        <Card className={cn(justUpdated && "animate-data-pulse")}>
          <ul className="stagger divide-y divide-border">
            {filtered.map((account) => (
              <li key={`${account.role}:${account.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{account.name}</span>
                    <Badge tone="brand">{SUPERADMIN_ROLE_LABEL[account.role]}</Badge>
                    <Badge tone={account.statusTone}>{account.status}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-secondary">
                    {account.contact}
                    {account.institution ? ` · ${account.institution}` : ""}
                  </p>
                  {account.detail && <p className="mt-0.5 text-xs text-subtle">{account.detail}</p>}
                </div>
                <p className="shrink-0 text-xs text-subtle">{formatDateTime(account.createdAt)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
