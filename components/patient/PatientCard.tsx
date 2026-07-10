import { Card, CardBody } from "@/components/ui/Card";
import { AllergyList } from "./AllergyList";
import { MedicationList } from "./MedicationList";
import { calculateAgeYears } from "@/lib/utils/date";
import type { Drug, Patient } from "@/lib/types";

interface PatientCardProps {
  patient: Patient;
  drugs: Drug[];
}

export function PatientCard({ patient, drugs }: PatientCardProps) {
  const age = calculateAgeYears(patient.dob);

  return (
    <Card>
      <CardBody className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{patient.name}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {age} yrs · {patient.sex} · {patient.weightKg !== null ? `${patient.weightKg}kg` : "weight unknown"}
          </p>
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
            Allergies
          </h3>
          <AllergyList allergies={patient.allergies} />
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
            Active Medications
          </h3>
          <MedicationList medications={patient.activeMedications} drugs={drugs} />
        </div>
      </CardBody>
    </Card>
  );
}
