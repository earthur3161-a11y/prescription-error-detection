import { calculateAgeYears } from "../../utils/date";
import { buildFlag } from "../buildFlag";
import type { Flag, ScreeningInput } from "../types";

const GERIATRIC_AGE = 65;

/** Drug classes warranting extra caution in older adults (falls, bleeding, anticholinergic load). */
const GERIATRIC_CAUTION_CLASSES = new Set([
  "Benzodiazepine",
  "Opioid Analgesic",
  "NSAID",
  "Tricyclic Antidepressant",
]);

/**
 * Condition- and life-stage-based contraindications: pregnancy, renal/hepatic
 * impairment (matched against the drug's contraindication notes), and
 * geriatric caution classes. Emits distinct pregnancy_warning /
 * contraindication / pediatric_geriatric_dosing flags rather than folding them
 * into a generic dosing issue.
 */
export function checkContraindication(input: ScreeningInput): Flag[] {
  const { patient, drugLine, formulary } = input;
  if (!patient) return [];

  const drug = formulary.drugs.find((d) => d.id === drugLine.drugId);
  if (!drug) return [];

  const flags: Flag[] = [];
  const contra = drug.contraindications ?? [];
  const contraText = contra.join(" ").toLowerCase();

  // --- Pregnancy: structured category first, contraindication text as fallback. ---
  if (patient.isPregnant === true) {
    if (drug.pregnancyCategory === "X" || drug.pregnancyCategory === "D") {
      const isX = drug.pregnancyCategory === "X";
      flags.push(
        buildFlag({
          type: "pregnancy_warning",
          code: isX ? "PREGNANCY_CATEGORY_X" : "PREGNANCY_CATEGORY_D",
          severity: isX ? "severe" : "major",
          clinical: isX
            ? `${drug.generic_name} is pregnancy category X — contraindicated in pregnancy (known teratogen). Do not dispense; select a pregnancy-safe alternative.`
            : `${drug.generic_name} is pregnancy category D — positive evidence of fetal risk. Avoid unless the benefit clearly outweighs the risk, and only after specialist review.`,
          patient: isX
            ? `${drug.generic_name} can seriously harm a pregnancy — do not take it, and speak to your doctor urgently.`
            : `${drug.generic_name} can be harmful in pregnancy — do not take it without advice from your doctor or pharmacist.`,
          relatedDrugId: drug.id,
        })
      );
    } else if (drug.pregnancyCategory === "C") {
      flags.push(
        buildFlag({
          type: "pregnancy_warning",
          code: "PREGNANCY_CATEGORY_C",
          severity: "moderate",
          clinical: `${drug.generic_name} is pregnancy category C — fetal risk cannot be ruled out. Use only if the potential benefit justifies the potential risk; consider a better-characterised alternative.`,
          patient: `${drug.generic_name} may not be fully safe in pregnancy — please check with your pharmacist or doctor before taking it.`,
          relatedDrugId: drug.id,
        })
      );
    } else if (!drug.pregnancyCategory && /pregnan/.test(contraText)) {
      flags.push(
        buildFlag({
          type: "pregnancy_warning",
          code: "CONTRAINDICATED_IN_PREGNANCY",
          severity: "major",
          clinical: `${drug.generic_name} is contraindicated or cautioned in pregnancy (${contra.join("; ")}). Confirm a pregnancy-safe alternative before dispensing.`,
          patient: `${drug.generic_name} may not be safe in pregnancy — please talk to your pharmacist or doctor before taking it.`,
          relatedDrugId: drug.id,
        })
      );
    }
  } else if (
    (patient.isPregnant === null || patient.isPregnant === undefined) &&
    patient.sex !== "male"
  ) {
    // Pregnancy status not confirmed — never treat this the same as "confirmed
    // not pregnant" (which correctly raises nothing). Only raise this for
    // drugs that actually carry meaningful pregnancy risk, matching the same
    // universe of drugs that would have flagged above had pregnancy been
    // confirmed true.
    const isHighRiskCategory = drug.pregnancyCategory === "X" || drug.pregnancyCategory === "D";
    const isTextFlagged = !drug.pregnancyCategory && /pregnan/.test(contraText);
    if (isHighRiskCategory || isTextFlagged) {
      flags.push(
        buildFlag({
          type: "pregnancy_warning",
          code: "PREGNANCY_STATUS_UNKNOWN",
          severity: "unknown",
          clinical: `${drug.generic_name} carries significant pregnancy risk (${drug.pregnancyCategory ? `category ${drug.pregnancyCategory}` : "contraindicated/cautioned in pregnancy"}) and this patient's pregnancy status is not confirmed — verify before dispensing.`,
          patient: `${drug.generic_name} can be risky during pregnancy, and we don't know your pregnancy status — please tell your pharmacist or doctor if there's any chance you could be pregnant before taking it.`,
          relatedDrugId: drug.id,
        })
      );
    }
  }

  // --- Renal impairment: structured dose guidance first, contraindication text as fallback. ---
  if (patient.renalStatus === "impaired") {
    if (drug.renalDoseGuidance === "avoid") {
      flags.push(
        buildFlag({
          type: "contraindication",
          code: "RENAL_AVOID",
          severity: "major",
          clinical: `${drug.generic_name} should be avoided in significant renal impairment (accumulation / toxicity risk) — choose a renally-safer alternative.`,
          patient: `Because of your kidney function, ${drug.generic_name} is usually best avoided — please speak to your pharmacist before taking it.`,
          relatedDrugId: drug.id,
        })
      );
    } else if (drug.renalDoseGuidance === "caution") {
      flags.push(
        buildFlag({
          type: "contraindication",
          code: "RENAL_DOSE_ADJUST",
          severity: "moderate",
          clinical: `${drug.generic_name} is renally cleared — reduce the dose or extend the interval and monitor renal function in this patient with impaired renal function.`,
          patient: `Because of your kidney function, the dose of ${drug.generic_name} may need adjusting — please confirm it with your pharmacist.`,
          relatedDrugId: drug.id,
        })
      );
    } else if (/renal|kidney/.test(contraText)) {
      flags.push(
        buildFlag({
          type: "contraindication",
          code: "CONTRAINDICATED_RENAL",
          severity: "major",
          clinical: `${drug.generic_name} carries a renal contraindication/caution and this patient has impaired renal function — review dose or choose an alternative.`,
          patient: `Because of your kidney function, ${drug.generic_name} needs a pharmacist's review before you take it.`,
          relatedDrugId: drug.id,
        })
      );
    }
  } else if (patient.renalStatus === "unknown") {
    // Renal function not confirmed — never treat this the same as "confirmed
    // normal" (which correctly raises nothing). Only raise this for drugs
    // that actually have renal dosing considerations on file.
    const needsRenalReview =
      drug.renalDoseGuidance === "avoid" ||
      drug.renalDoseGuidance === "caution" ||
      (!drug.renalDoseGuidance && /renal|kidney/.test(contraText));
    if (needsRenalReview) {
      flags.push(
        buildFlag({
          type: "contraindication",
          code: "RENAL_STATUS_UNKNOWN",
          severity: "unknown",
          clinical: `${drug.generic_name} has renal dosing considerations (${drug.renalDoseGuidance ?? "renal caution noted"}) and this patient's renal function is not confirmed — verify renal status before prescribing.`,
          patient: `${drug.generic_name}'s dose can depend on kidney function, and we don't have yours on file — please confirm with your pharmacist or doctor.`,
          relatedDrugId: drug.id,
        })
      );
    }
  }

  // --- Hepatic impairment: structured dose guidance first, contraindication text as fallback. ---
  if (patient.hepaticStatus === "impaired") {
    if (drug.hepaticDoseGuidance === "avoid") {
      flags.push(
        buildFlag({
          type: "contraindication",
          code: "HEPATIC_AVOID",
          severity: "major",
          clinical: `${drug.generic_name} should be avoided in significant hepatic impairment — choose a hepatically-safer alternative.`,
          patient: `Because of your liver function, ${drug.generic_name} is usually best avoided — please speak to your pharmacist before taking it.`,
          relatedDrugId: drug.id,
        })
      );
    } else if (drug.hepaticDoseGuidance === "caution") {
      flags.push(
        buildFlag({
          type: "contraindication",
          code: "HEPATIC_DOSE_ADJUST",
          severity: "moderate",
          clinical: `${drug.generic_name} is hepatically metabolised — reduce the dose and monitor in this patient with impaired hepatic function.`,
          patient: `Because of your liver function, the dose of ${drug.generic_name} may need adjusting — please confirm it with your pharmacist.`,
          relatedDrugId: drug.id,
        })
      );
    } else if (/hepatic|liver/.test(contraText)) {
      flags.push(
        buildFlag({
          type: "contraindication",
          code: "CONTRAINDICATED_HEPATIC",
          severity: "major",
          clinical: `${drug.generic_name} carries a hepatic contraindication/caution and this patient has impaired hepatic function — review dose or choose an alternative.`,
          patient: `Because of your liver function, ${drug.generic_name} needs a pharmacist's review before you take it.`,
          relatedDrugId: drug.id,
        })
      );
    }
  } else if (patient.hepaticStatus === "unknown") {
    // Hepatic function not confirmed — never treat this the same as
    // "confirmed normal" (which correctly raises nothing). Only raise this
    // for drugs that actually have hepatic dosing considerations on file.
    const needsHepaticReview =
      drug.hepaticDoseGuidance === "avoid" ||
      drug.hepaticDoseGuidance === "caution" ||
      (!drug.hepaticDoseGuidance && /hepatic|liver/.test(contraText));
    if (needsHepaticReview) {
      flags.push(
        buildFlag({
          type: "contraindication",
          code: "HEPATIC_STATUS_UNKNOWN",
          severity: "unknown",
          clinical: `${drug.generic_name} has hepatic dosing considerations (${drug.hepaticDoseGuidance ?? "hepatic caution noted"}) and this patient's hepatic function is not confirmed — verify hepatic status before prescribing.`,
          patient: `${drug.generic_name}'s dose can depend on liver function, and we don't have yours on file — please confirm with your pharmacist or doctor.`,
          relatedDrugId: drug.id,
        })
      );
    }
  }

  if (patient.ageYearsUnknown) {
    // Age not confirmed — never treat this the same as "confirmed under 65"
    // (which correctly raises nothing). Only raise this for drug classes
    // that actually warrant geriatric caution.
    if (GERIATRIC_CAUTION_CLASSES.has(drug.class)) {
      flags.push(
        buildFlag({
          type: "pediatric_geriatric_dosing",
          code: "AGE_DATA_UNKNOWN",
          severity: "unknown",
          clinical: `${drug.generic_name} (${drug.class}) warrants extra caution in older adults and this patient's age is not on file — confirm age before prescribing.`,
          patient: `${drug.generic_name} can affect older adults more strongly, and we don't know your age — please confirm with your pharmacist that this is right for you.`,
          relatedDrugId: drug.id,
        })
      );
    }
  } else {
    const age = calculateAgeYears(patient.dob);
    if (age >= GERIATRIC_AGE && GERIATRIC_CAUTION_CLASSES.has(drug.class)) {
      flags.push(
        buildFlag({
          type: "pediatric_geriatric_dosing",
          code: "GERIATRIC_CAUTION_CLASS",
          severity: "moderate",
          clinical: `${drug.generic_name} (${drug.class}) warrants caution in older adults (age ${age}) — consider a lower starting dose and review appropriateness.`,
          patient: `${drug.generic_name} can affect older adults more strongly — a pharmacist should confirm the dose is right for you.`,
          relatedDrugId: drug.id,
        })
      );
    }
  }

  return flags;
}
