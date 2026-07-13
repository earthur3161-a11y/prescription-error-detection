import { checkAllergy } from "./checks/allergyCheck";
import { checkContraindication } from "./checks/contraindicationCheck";
import { checkCumulativeDose } from "./checks/cumulativeDoseCheck";
import { checkDataCompleteness } from "./checks/dataCompletenessCheck";
import { checkDoseRange } from "./checks/doseRangeCheck";
import { checkDuplicateTherapy } from "./checks/duplicateTherapyCheck";
import { checkEML } from "./checks/emlCheck";
import { checkIndication } from "./checks/indicationCheck";
import { checkInteraction } from "./checks/interactionCheck";
import { checkPrescriptionCompleteness } from "./checks/prescriptionCompletenessCheck";
import { deriveVerdict } from "./severity";
import type { DrugLineVerdict, ScreeningInput } from "./types";

export function screenDrugLine(input: ScreeningInput): DrugLineVerdict {
  const flags = [
    ...checkDataCompleteness(input),
    ...checkPrescriptionCompleteness(input),
    ...checkAllergy(input),
    ...checkInteraction(input),
    ...checkDuplicateTherapy(input),
    ...checkDoseRange(input),
    ...checkCumulativeDose(input),
    ...checkContraindication(input),
    ...checkEML(input),
    ...checkIndication(input),
  ];

  return {
    drugId: input.drugLine.drugId,
    lineId: input.drugLine.id,
    verdict: deriveVerdict(flags),
    flags,
    screenedAt: new Date().toISOString(),
  };
}
