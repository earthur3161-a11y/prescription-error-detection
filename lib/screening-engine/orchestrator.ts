import { checkAlcoholInteraction } from "./checks/alcoholInteractionCheck";
import { checkAllergy } from "./checks/allergyCheck";
import { checkContraindication } from "./checks/contraindicationCheck";
import { checkCumulativeDose } from "./checks/cumulativeDoseCheck";
import { checkDataCompleteness } from "./checks/dataCompletenessCheck";
import { checkDoseRange } from "./checks/doseRangeCheck";
import { checkDuplicateTherapy } from "./checks/duplicateTherapyCheck";
import { checkEML } from "./checks/emlCheck";
import { checkFoodInteraction } from "./checks/foodInteractionCheck";
import { checkIndication } from "./checks/indicationCheck";
import { checkInteraction } from "./checks/interactionCheck";
import { checkPrescriptionCompleteness } from "./checks/prescriptionCompletenessCheck";
import { buildFlag } from "./buildFlag";
import { deriveVerdict } from "./severity";
import type { DrugLineVerdict, Flag, ScreeningInput } from "./types";

export function screenDrugLine(input: ScreeningInput): DrugLineVerdict {
  const { drugLine, formulary } = input;
  const drugExists = formulary.drugs.some((d) => d.id === drugLine.drugId);

  // Every check below except checkDataCompleteness (patient-level, doesn't
  // need the drug) either looks the drug up itself and silently returns []
  // when it can't find it, or works by raw ID match and would coincidentally
  // find nothing anyway. Individually that's reasonable defense-in-depth for
  // each check's own narrow question — but stacked together it meant an
  // unrecognized drugId produced ZERO signal anywhere and the line resolved
  // "safe" as if every check had actually run and found nothing wrong. This
  // is the same failure shape as the null-vs-normal gaps fixed earlier, just
  // for drug identity instead of patient attributes: fail loudly with one
  // explicit flag, don't let it fail by accumulated silence.
  const flags: Flag[] = drugExists
    ? [
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
        ...checkFoodInteraction(input),
        ...checkAlcoholInteraction(input),
      ]
    : [
        ...checkDataCompleteness(input),
        buildFlag({
          type: "unrecognized_drug",
          code: "UNRECOGNIZED_DRUG",
          severity: "major",
          clinical: `"${drugLine.drugId}" is not a recognized drug in this formulary — allergy, interaction, dosing, and contraindication checks could not be run for this line. Confirm the correct drug before proceeding.`,
          patient: "We don't recognize this medicine in our system, so we couldn't check it for safety — please confirm with your pharmacist before taking it.",
        }),
      ];

  return {
    drugId: drugLine.drugId,
    lineId: drugLine.id,
    verdict: deriveVerdict(flags),
    flags,
    screenedAt: new Date().toISOString(),
  };
}
