"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-surface-2 px-4 py-3 text-xs leading-relaxed text-foreground">
      {children.trim()}
    </pre>
  );
}

export default function IntegrationDocsPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
      <button
        onClick={() => router.push("/admin/integration")}
        className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to dashboard
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Integration reference</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How your hospital/EHR system talks to MediGuard&rsquo;s screening engine.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-semibold text-foreground">Authentication</h2>
          <p className="text-sm text-secondary">
            Every request carries your facility&rsquo;s API key (Live or Sandbox, from the Integration
            Dashboard) in the <code>Authorization</code> header.
          </p>
          <CodeBlock>{`Authorization: Bearer mg_live_xxxxxxxxxxxxxxxx`}</CodeBlock>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-semibold text-foreground">POST /api/v1/screen</h2>
          <p className="text-sm text-secondary">
            Screens a single drug line for a patient and returns a structured verdict. Call this
            once per drug line when the prescriber adds it, and again before finalizing dispense.
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-subtle">Request</p>
          <CodeBlock>{`{
  "patient": {
    "dob": "1965-09-03",
    "weightKg": 82,
    "allergies": [{ "allergen": "Penicillin", "severity": "severe" }] | null,
    "activeMedications": [{ "drugId": "drug_warfarin", "startedAt": "2024-06-01" }] | null,
    "reportedConditions": ["Diabetes"] | null
  },
  "drug": {
    "drugId": "drug_ciprofloxacin",
    "doseMg": 500,
    "frequencyPerDay": 2,
    "durationDays": 7,
    "route": "oral"
  }
}`}</CodeBlock>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-subtle">Response</p>
          <CodeBlock>{`{
  "verdict": "caution",
  "flags": [
    {
      "type": "interaction",
      "code": "DRUG_DRUG_INTERACTION",
      "severity": "moderate",
      "message": "Moderate interaction with Warfarin: ...",
      "audience_variant": {
        "clinical": "Moderate interaction with Warfarin: ...",
        "patient": "This medicine and Warfarin ... may not mix well together."
      },
      "referenceSource": "Ghana STG 2017, Ch. 3 ..."
    }
  ]
}`}</CodeBlock>
          <p className="text-sm text-secondary">
            <span className="font-medium">null</span> for <code>allergies</code> or{" "}
            <code>activeMedications</code> means &ldquo;not on file&rdquo; — MediGuard will never resolve
            these to Safe; treat a <code>caution</code> or <code>blocked</code> verdict as
            requiring human review either way.
          </p>
          <p className="text-sm text-secondary">
            <code>reportedConditions</code> is the patient&rsquo;s stated reason(s) for treatment, from
            MediGuard&rsquo;s own curated condition list (see the Physician Portal&rsquo;s
            &ldquo;Reason for this prescription&rdquo; field) — send it whenever your system has it, so
            the drug being screened is also checked against why the patient is being treated, not
            just against their allergies and other medications. Omitted or empty is treated as
            &ldquo;not reported,&rdquo; never as &ldquo;confirmed no condition.&rdquo;
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-semibold text-foreground">FHIR resource mapping</h2>
          <p className="text-sm text-secondary">
            If your system speaks HL7 FHIR, map resources to the request shape above as follows:
          </p>
          <ul className="space-y-1.5 text-sm text-secondary">
            <li>
              <code className="text-foreground">AllergyIntolerance.code</code> →{" "}
              <code className="text-foreground">patient.allergies[].allergen</code>
            </li>
            <li>
              <code className="text-foreground">AllergyIntolerance.reaction.severity</code> →{" "}
              <code className="text-foreground">patient.allergies[].severity</code>
            </li>
            <li>
              <code className="text-foreground">MedicationStatement.medicationCodeableConcept</code>{" "}
              → <code className="text-foreground">patient.activeMedications[].drugId</code>
            </li>
            <li>
              <code className="text-foreground">MedicationRequest.dosageInstruction</code> →{" "}
              <code className="text-foreground">drug.doseMg / frequencyPerDay / route</code>
            </li>
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-semibold text-foreground">CDS Hooks (interruptive EHR alerts)</h2>
          <p className="text-sm text-secondary">
            If your EHR speaks{" "}
            <a
              href="https://cds-hooks.org"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand hover:underline"
            >
              CDS Hooks
            </a>
            , MediGuard exposes a discovery endpoint and a screening service so alerts surface{" "}
            <em>inside</em> the prescriber&rsquo;s ordering screen — the physician acknowledges or
            modifies the order without leaving your system.
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-subtle">
            Discovery — GET /cds-services
          </p>
          <CodeBlock>{`{
  "services": [
    {
      "hook": "order-sign",
      "id": "mediguard-screen",
      "title": "MediGuard prescription screening",
      "description": "Screens each drug order for allergy, interaction, duplicate, dose and EML issues.",
      "prefetch": {
        "patient": "Patient/{{context.patientId}}",
        "allergies": "AllergyIntolerance?patient={{context.patientId}}",
        "meds": "MedicationStatement?patient={{context.patientId}}"
      }
    }
  ]
}`}</CodeBlock>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-subtle">
            Invocation — POST /cds-services/mediguard-screen
          </p>
          <p className="text-sm text-secondary">
            Fires on <code>order-select</code> (as the order is drafted) and <code>order-sign</code>{" "}
            (before signing). MediGuard screens each draft order and returns a card per finding.
          </p>
          <CodeBlock>{`{
  "cards": [
    {
      "summary": "Severe allergy conflict: Amoxicillin vs Penicillin",
      "indicator": "critical",          // info | warning | critical  (= safe | caution | blocked)
      "detail": "Patient has a severe Penicillin allergy on file. ...",
      "source": { "label": "MediGuard — Ghana STG 2017" },
      "suggestions": [
        { "label": "Replace with a non-penicillin alternative",
          "actions": [{ "type": "delete", "resource": "MedicationRequest/draft-1" }] }
      ],
      "overrideReasons": [
        { "code": "benefit_outweighs_risk", "display": "Benefit outweighs risk" },
        { "code": "verified_with_pharmacist", "display": "Verified with pharmacist" }
      ]
    }
  ]
}`}</CodeBlock>
          <p className="text-sm text-secondary">
            The card <code>indicator</code> mirrors the verdict (<code>critical</code> = blocked,{" "}
            <code>warning</code> = caution, <code>info</code> = safe). If the prescriber picks an{" "}
            <code>overrideReasons</code> entry and proceeds, your EHR posts that choice back and
            MediGuard writes it to the same immutable override log as every other channel — so the
            EHR order and the MediGuard audit trail never diverge.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-semibold text-foreground">Embeddable widget</h2>
          <p className="text-sm text-secondary">
            Embed the screening UI directly in your prescribing screen so staff never leave your
            system:
          </p>
          <CodeBlock>{`<iframe
  src="https://your-mediguard-instance/widget/screen?apiKey=mg_live_..."
  style="width:100%; height:420px; border:0;"
></iframe>`}</CodeBlock>
          <p className="text-sm text-secondary">
            The widget posts <code>{"{ type: 'mediguard:verdict', verdict }"}</code> messages to
            the parent window via <code>postMessage</code> as the prescriber edits the drug line,
            so your host page can react without polling.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          <h2 className="font-semibold text-foreground">Enforcement levels</h2>
          <p className="text-sm text-secondary">
            <span className="font-medium">Advisory</span> — the verdict is shown but your system
            controls whether prescribing can proceed.
          </p>
          <p className="text-sm text-secondary">
            <span className="font-medium">Enforced</span> — your system must not finalize a{" "}
            <code>blocked</code> prescription until MediGuard confirms a logged override came back
            through the API for that drug line.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
