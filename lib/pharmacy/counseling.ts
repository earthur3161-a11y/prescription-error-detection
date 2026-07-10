import type { Drug, PrescriptionDrugLine } from "../types";

export interface CounselingPoints {
  administration: string;
  sideEffects: string;
  storage: string;
  missedDose: string;
}

/**
 * Class-based counseling reference. Deliberately general drug-class guidance to
 * support (not replace) the pharmacist's own advice — for complex regimens the
 * pharmacist defers to the prescriber. Falls back to a safe generic entry.
 */
const BY_CLASS: Record<string, CounselingPoints> = {
  Penicillin: {
    administration: "Take at evenly spaced times. Can be taken with or without food; complete the full course even if you feel better.",
    sideEffects: "Occasional nausea, loose stools, or mild rash. Stop and seek care urgently if you get swelling, wheeze, or a spreading rash.",
    storage: "Store below 25°C, away from moisture. Discard any reconstituted syrup after the days stated on the bottle.",
    missedDose: "Take it as soon as you remember, unless it's almost time for the next dose — then skip it. Don't double up.",
  },
  Cephalosporin: {
    administration: "Take at evenly spaced intervals; complete the full course. May be taken with food if it upsets your stomach.",
    sideEffects: "Nausea, diarrhoea, or mild rash. Seek urgent care for any signs of a severe allergic reaction.",
    storage: "Store below 25°C, away from light and moisture.",
    missedDose: "Take when remembered unless the next dose is near; do not double up.",
  },
  Macrolide: {
    administration: "Take with food to reduce stomach upset; finish the whole course.",
    sideEffects: "Nausea, stomach cramps, or diarrhoea are common and usually mild.",
    storage: "Store below 25°C, away from moisture.",
    missedDose: "Take when remembered unless close to the next dose; do not double up.",
  },
  NSAID: {
    administration: "Take with or after food to protect your stomach. Use the lowest dose for the shortest time needed.",
    sideEffects: "Indigestion or heartburn. Stop and seek care for black stools, vomiting blood, or severe stomach pain.",
    storage: "Store below 25°C in a dry place.",
    missedDose: "If for regular pain relief, take when remembered; if 'as needed', only take when you have pain.",
  },
  "Opioid Analgesic": {
    administration: "Take exactly as directed. Do not drink alcohol. It may cause drowsiness — avoid driving until you know how it affects you.",
    sideEffects: "Constipation, drowsiness, nausea. Seek urgent care for very slow or difficult breathing.",
    storage: "Store securely out of reach of children, below 25°C.",
    missedDose: "Follow the prescriber's instructions; do not take extra to catch up.",
  },
  Benzodiazepine: {
    administration: "Take exactly as prescribed, usually at night. Avoid alcohol; may cause drowsiness — take care with driving.",
    sideEffects: "Drowsiness, dizziness, unsteadiness (especially in older adults). Do not stop suddenly after long use.",
    storage: "Store securely out of reach of children.",
    missedDose: "Skip the missed dose if it's nearly time for the next; do not double up.",
  },
  "Anticoagulant": {
    administration: "Take at the same time each day. Attend all INR/blood-test appointments. Tell any health worker you take a blood thinner.",
    sideEffects: "Bruising or minor bleeding. Seek urgent care for heavy or unusual bleeding, black stools, or a bad headache.",
    storage: "Store below 25°C, away from moisture.",
    missedDose: "Take a missed dose the same day if remembered; if not, skip it and never double up. Note it for your clinic.",
  },
  "Biguanide (Antidiabetic)": {
    administration: "Take with or just after meals to reduce stomach upset.",
    sideEffects: "Nausea, diarrhoea, or a metallic taste, usually settling over time.",
    storage: "Store below 25°C in a dry place.",
    missedDose: "Take with your next meal; do not double up.",
  },
  "Calcium Channel Blocker": {
    administration: "Take once daily at about the same time, with or without food.",
    sideEffects: "Ankle swelling, flushing, or headache. Report persistent swelling to your pharmacist.",
    storage: "Store below 25°C.",
    missedDose: "Take when remembered unless it's nearly the next dose; do not double up.",
  },
  Antimalarial: {
    administration: "Take with food or a fatty snack/milk to help absorption; complete the full course exactly as directed.",
    sideEffects: "Nausea, dizziness, or headache. Return if vomiting occurs shortly after a dose.",
    storage: "Store below 30°C, away from moisture.",
    missedDose: "Take the missed dose as soon as possible to keep the course on schedule; ask the pharmacist if unsure.",
  },
};

const DEFAULT_POINTS: CounselingPoints = {
  administration: "Take exactly as directed on the label. Ask your pharmacist if you're unsure whether to take it with food.",
  sideEffects: "Most people tolerate this well. Report any unexpected or severe reaction to your pharmacist or doctor.",
  storage: "Store below 25°C, away from direct light and moisture, and out of reach of children.",
  missedDose: "Take a missed dose when you remember, unless it's almost time for the next one — then skip it. Never double up.",
};

export function counselingFor(drug: Drug): CounselingPoints {
  return BY_CLASS[drug.class] ?? DEFAULT_POINTS;
}

/** Plain-language dosage sentence built from the actual prescribed line. */
export function dosageInstruction(drug: Drug, line: PrescriptionDrugLine): string {
  const times =
    line.frequencyPerDay === 1
      ? "once a day"
      : line.frequencyPerDay === 2
        ? "twice a day"
        : line.frequencyPerDay === 3
          ? "three times a day"
          : `${line.frequencyPerDay} times a day`;
  return `Take ${line.doseMg}mg (${drug.generic_name}) by ${line.route} route ${times} for ${line.durationDays} day${line.durationDays === 1 ? "" : "s"}.`;
}
