"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, UserRound } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePatients } from "@/lib/query/hooks/usePatients";
import { useAuth } from "@/lib/auth/useAuth";
import { calculateAgeYears } from "@/lib/utils/date";

export default function PatientsPage() {
  const { role } = useAuth();
  const [query, setQuery] = useState("");
  const { data: patients, isLoading } = usePatients(query);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Patients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search for a patient to view their profile.</p>
        </div>
        {role === "prescriber" && (
          <Link href="/patients/new">
            <Button size="sm">
              <UserPlus className="size-4" aria-hidden="true" />
              Add patient
            </Button>
          </Link>
        )}
      </div>

      <Input
        placeholder="Search patients by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search patients"
        className="max-w-sm"
      />

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      <div className="stagger space-y-3">
        {(patients ?? []).map((patient) => (
          <Link
            key={patient.id}
            href={`/patients/${patient.id}`}
            className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <Card interactive className="active:scale-[0.98]">
              <CardBody className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-brand-subtle text-brand">
                    <UserRound className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{patient.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {calculateAgeYears(patient.dob)} yrs · {patient.sex}
                    </p>
                  </div>
                </div>
                {patient.allergies === null && <Badge tone="unknown">Allergy data unknown</Badge>}
                {patient.allergies && patient.allergies.length > 0 && (
                  <Badge tone="blocked">{patient.allergies.length} allergy record(s)</Badge>
                )}
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
