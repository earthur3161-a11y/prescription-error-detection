"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PrescriptionBuilder } from "@/components/prescription/PrescriptionBuilder";
import { useAuth } from "@/lib/auth/useAuth";

export default function WalkInPrescriptionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [externalPrescriberName, setExternalPrescriberName] = useState("");
  const [started, setStarted] = useState(false);

  if (!user) return null;

  if (!started) {
    return (
      <div className="mx-auto max-w-lg space-y-6 p-6 sm:p-8">
        <button
          onClick={() => router.push("/pharmacist/queue")}
          className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to queue
        </button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Walk-in prescription</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            For a paper prescription a patient brought in that wasn&rsquo;t written through MediGuard.
          </p>
        </div>
        <Card>
          <CardBody className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-secondary">
                Who prescribed this? <span className="text-subtle">(optional)</span>
              </label>
              <Input
                value={externalPrescriberName}
                onChange={(e) => setExternalPrescriberName(e.target.value)}
                placeholder="e.g. Dr. Kofi Antwi, Trust Hospital"
              />
            </div>
            <Button onClick={() => setStarted(true)} className="w-full">
              Continue to screening
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <PrescriptionBuilder
      title="Walk-in prescription"
      subtitle="Enter exactly what's on the paper prescription — each line is screened the same way as any other."
      prescriberId={user.id}
      source="walk_in"
      externalPrescriberName={externalPrescriberName.trim() || "Unknown (walk-in)"}
      allowPatientCreate
      onSubmitted={(id) => router.push(`/pharmacist/review/${id}`)}
    />
  );
}
