"use client";

import Link from "next/link";
import { FilePlus2, Users } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth/useAuth";
import { usePatients } from "@/lib/query/hooks/usePatients";
import { usePrescriptions } from "@/lib/query/hooks/usePrescriptions";
import { formatDateTime } from "@/lib/utils/date";
import { overallVerdict } from "@/lib/screening-engine/overallVerdict";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: patients, isLoading: patientsLoading } = usePatients();
  const { data: prescriptions, isLoading: rxLoading } = usePrescriptions({
    prescriberId: user?.id,
    currentOnly: true,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back, {user?.name ?? "there"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Screen a new prescription or pick up where you left off.
          </p>
        </div>
        <Link href="/prescriptions/new">
          <Button size="lg">
            <FilePlus2 className="size-5" aria-hidden="true" />
            New Prescription
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Recent patients</h2>
              <Link href="/patients" className="text-sm font-medium text-brand hover:underline">
                View all
              </Link>
            </div>
            {patientsLoading && (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {!patientsLoading && (
              <ul className="divide-y divide-border">
                {(patients ?? []).slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/patients/${p.id}`}
                      className="flex items-center gap-3 py-2.5 text-sm text-secondary hover:text-brand"
                    >
                      <Users className="size-4 shrink-0 text-subtle" aria-hidden="true" />
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Your recent prescriptions</h2>
              <Link href="/prescriptions" className="text-sm font-medium text-brand hover:underline">
                View all
              </Link>
            </div>
            {rxLoading && (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {!rxLoading && (prescriptions?.length ?? 0) === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No prescriptions yet.</p>
            )}
            {!rxLoading && (
              <ul className="divide-y divide-border">
                {(prescriptions ?? []).slice(0, 5).map((rx) => (
                  <li key={rx.id}>
                    <Link
                      href={`/prescriptions/${rx.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm text-secondary hover:text-brand"
                    >
                      <span>{formatDateTime(rx.createdAt)}</span>
                      <VerdictBadge verdict={overallVerdict(rx.verdicts)} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
