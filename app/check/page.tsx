"use client";

import Link from "next/link";
import { Camera, ClipboardCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { useLocalPatientProfile } from "@/lib/query/hooks/usePatientProfile";

export default function CheckLandingPage() {
  const { data: profile } = useLocalPatientProfile();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-brand-subtle">
          <ShieldCheck className="size-8 text-brand" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          Got a new prescription or medicine?
        </h1>
        <p className="mt-2 text-secondary">
          Get a free, quick second check — did the doctor or pharmacist make a mistake? Sign in
          with just your phone number to get 3 free checks — no password, no registration.
        </p>
      </div>

      <Link href="/check/new">
        <Button size="lg" className="w-full">
          <ShieldCheck className="size-5" aria-hidden="true" />
          Check my medicine
        </Button>
      </Link>

      {profile && (
        <p className="text-center text-sm text-muted-foreground">
          We&rsquo;ll use your saved health profile to make this check faster.{" "}
          <Link href="/check/history" className="font-medium text-brand hover:underline">
            View or edit it
          </Link>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardBody className="flex items-start gap-3">
            <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">Type or search</p>
              <p className="text-sm text-muted-foreground">Find your medicine by name — we&rsquo;re forgiving of typos.</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-start gap-3">
            <Camera className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">Or snap a photo</p>
              <p className="text-sm text-muted-foreground">Take a picture of the label and we&rsquo;ll read it for you.</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Notice tone="caution">
        <span className="font-semibold">MediGuard supports, but doesn&rsquo;t replace,</span> advice
        from your doctor or pharmacist. Always talk to a professional about your health.
      </Notice>
    </div>
  );
}
