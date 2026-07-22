import { calculateAgeYears } from "../../utils/date";
import { buildFlag } from "../buildFlag";
import type { Flag, ScreeningInput } from "../types";

const PEDIATRIC_AGE_CUTOFF_YEARS = 12;

export function checkDoseRange(input: ScreeningInput): Flag[] {
  const { patient, drugLine, formulary } = input;

  const drug = formulary.drugs.find((d) => d.id === drugLine.drugId);
  if (!drug) return [];

  const range = drug.standard_dose_range;
  const flags: Flag[] = [];

  if (drugLine.doseMg > 0 && drugLine.doseMg > range.maxMgPerDose) {
    flags.push(
      buildFlag({
        type: "wrong_dose",
        code: "DOSE_ABOVE_MAX_PER_DOSE",
        severity: "major",
        clinical: `${drugLine.doseMg}mg exceeds the standard maximum single dose of ${range.maxMgPerDose}mg for ${drug.generic_name}. Suggested correction: reduce to ≤${range.maxMgPerDose}mg per dose.`,
        patient: `This dose of ${drug.generic_name} looks higher than what's usually recommended.`,
        relatedDrugId: drug.id,
      })
    );
  } else if (drugLine.doseMg > 0 && drugLine.doseMg < range.minMgPerDose) {
    flags.push(
      buildFlag({
        type: "wrong_dose",
        code: "DOSE_BELOW_MIN_PER_DOSE",
        severity: "moderate",
        clinical: `${drugLine.doseMg}mg is below the standard minimum effective dose of ${range.minMgPerDose}mg for ${drug.generic_name} — verify therapeutic intent. Suggested correction: confirm intended dose (usual range ${range.minMgPerDose}–${range.maxMgPerDose}mg).`,
        patient: `This dose of ${drug.generic_name} looks lower than usual — worth checking it's meant to work this way.`,
        relatedDrugId: drug.id,
      })
    );
  }

  const dailyTotalMg = drugLine.doseMg * drugLine.frequencyPerDay;
  if (dailyTotalMg > range.maxMgPerDay) {
    flags.push(
      buildFlag({
        type: "max_daily_dose",
        code: "DOSE_ABOVE_MAX_PER_DAY",
        severity: "severe",
        clinical: `Total daily dose of ${dailyTotalMg}mg exceeds the standard maximum of ${range.maxMgPerDay}mg/day for ${drug.generic_name}. Suggested correction: keep the combined daily dose ≤${range.maxMgPerDay}mg.`,
        patient: `Taking ${drug.generic_name} this many times a day adds up to more than what's usually considered safe in a day.`,
        relatedDrugId: drug.id,
      })
    );
  }

  // Coarse frequency/duration plausibility. Structured frequency data isn't in
  // the formulary (it's free text), so this only flags clearly implausible
  // values rather than validating against the exact schedule.
  if (drugLine.frequencyPerDay > 6) {
    flags.push(
      buildFlag({
        type: "wrong_frequency",
        code: "FREQUENCY_UNUSUALLY_HIGH",
        severity: "moderate",
        clinical: `${drugLine.frequencyPerDay} doses/day of ${drug.generic_name} is unusually frequent — verify the intended schedule (${range.frequency}).`,
        patient: `Taking ${drug.generic_name} ${drugLine.frequencyPerDay} times a day looks like a lot — please confirm the schedule.`,
        relatedDrugId: drug.id,
      })
    );
  }
  if (drugLine.durationDays > 90) {
    flags.push(
      buildFlag({
        type: "wrong_duration",
        code: "DURATION_UNUSUALLY_LONG",
        severity: "minor",
        clinical: `A ${drugLine.durationDays}-day course of ${drug.generic_name} is unusually long — confirm this is an intended chronic/repeat supply.`,
        patient: `This is a long course of ${drug.generic_name} — worth confirming it's meant to run this long.`,
        relatedDrugId: drug.id,
      })
    );
  }

  // A young child on a drug with no pediatric dosing reference: the standard
  // adult range can't confirm an age-appropriate dose, so surface it rather
  // than silently validating against adult figures.
  if (patient && !range.pediatric) {
    if (patient.ageYearsUnknown) {
      // Age not confirmed — can't rule out this being a pediatric case, so
      // never treat this the same as "confirmed 12+" (which correctly raises
      // nothing here).
      flags.push(
        buildFlag({
          type: "pediatric_geriatric_dosing",
          code: "AGE_DATA_UNKNOWN",
          severity: "unknown",
          clinical: `No pediatric dosing reference is on file for ${drug.generic_name}, and this patient's age is not on file — cannot rule out a pediatric case. Confirm age before dispensing.`,
          patient: `We don't know your age, and ${drug.generic_name} doesn't have a standard child dose on file — please confirm with your pharmacist that this is safe for you.`,
          relatedDrugId: drug.id,
        })
      );
    } else {
      const ageYears = calculateAgeYears(patient.dob);
      if (ageYears < PEDIATRIC_AGE_CUTOFF_YEARS) {
        flags.push(
          buildFlag({
            type: "pediatric_geriatric_dosing",
            code: "PEDIATRIC_DOSE_REFERENCE_MISSING",
            severity: "moderate",
            clinical: `No pediatric dosing reference is on file for ${drug.generic_name}, prescribed for a ${ageYears}-year-old — verify an age/weight-appropriate dose before dispensing rather than relying on the adult range.`,
            patient: `${drug.generic_name} doesn't have a standard child dose on file — please confirm with your pharmacist that this dose is right for a child.`,
            relatedDrugId: drug.id,
          })
        );
      }
    }
  }

  if (range.weightBased) {
    if (!patient || patient.weightKg === null) {
      flags.push(
        buildFlag({
          type: "dose_range",
          code: "WEIGHT_DATA_UNKNOWN",
          severity: "unknown",
          clinical: `${drug.generic_name} is weight-dosed and patient weight is not on file — dose cannot be fully verified.`,
          patient: `${drug.generic_name}'s dose depends on body weight, and we don't have yours — please confirm this dose with your pharmacist.`,
          relatedDrugId: drug.id,
        })
      );
    } else if (range.pediatric && patient.ageYearsUnknown) {
      // Age not confirmed — can't determine whether the pediatric weight-based
      // ceiling should even apply, so never treat this the same as "confirmed
      // 12+" (which correctly skips the pediatric ceiling here).
      flags.push(
        buildFlag({
          type: "pediatric_geriatric_dosing",
          code: "AGE_DATA_UNKNOWN",
          severity: "unknown",
          clinical: `${drug.generic_name} has a weight-based pediatric dosing ceiling and this patient's age is not on file — cannot confirm whether that ceiling applies. Confirm age before dispensing.`,
          patient: `We don't know your age, so we can't confirm whether the child-size dosing limit for ${drug.generic_name} applies to you — please confirm with your pharmacist.`,
          relatedDrugId: drug.id,
        })
      );
    } else if (range.pediatric && calculateAgeYears(patient.dob) < PEDIATRIC_AGE_CUTOFF_YEARS) {
      const maxAllowedMg = Math.min(
        patient.weightKg * range.pediatric.mgPerKgPerDose,
        range.pediatric.maxMgPerDose
      );
      if (drugLine.doseMg > maxAllowedMg) {
        flags.push(
          buildFlag({
            type: "pediatric_geriatric_dosing",
            code: "PEDIATRIC_DOSE_ABOVE_MAX",
            severity: "major",
            clinical: `${drugLine.doseMg}mg exceeds the weight-based pediatric maximum of ${maxAllowedMg.toFixed(0)}mg (${range.pediatric.mgPerKgPerDose}mg/kg) for this ${patient.weightKg}kg patient.`,
            patient: `This dose of ${drug.generic_name} looks too high for a child this size.`,
            relatedDrugId: drug.id,
          })
        );
      }
    }
  }

  return flags;
}
