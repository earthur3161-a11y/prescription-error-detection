"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewPatientForm } from "@/components/patient/NewPatientForm";

export default function NewPatientPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
      <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to patients
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">New patient</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a patient to your roster. Fields left unanswered are recorded as unknown, never as confirmed absent.
        </p>
      </div>

      <NewPatientForm />
    </div>
  );
}
