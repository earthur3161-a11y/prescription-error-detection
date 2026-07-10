import { db, ensureSeeded } from "../db";
import { generateId } from "../../utils/id";
import type { PatientFeedbackReport } from "../../types";

export async function createPatientFeedbackReport(
  entry: Omit<PatientFeedbackReport, "id" | "createdAt">
): Promise<PatientFeedbackReport> {
  await ensureSeeded();
  const report: PatientFeedbackReport = {
    ...entry,
    id: generateId("fbk"),
    createdAt: new Date().toISOString(),
  };
  await db.patientFeedbackReports.put(report);
  return report;
}

export async function listPatientFeedbackReports(): Promise<PatientFeedbackReport[]> {
  await ensureSeeded();
  const all = await db.patientFeedbackReports.toArray();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
