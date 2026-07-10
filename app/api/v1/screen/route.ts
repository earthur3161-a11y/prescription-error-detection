import { z } from "zod";
import {
  authorizeApiKey,
  runScreen,
  screenRequestSchema,
} from "@/lib/integration/screenService";

/**
 * POST /api/v1/screen
 * Screens one drug line (with optional other lines for interaction/duplicate/
 * cumulative-dose context) for a patient, returning the structured verdict and
 * flags — the same engine the app UI uses.
 */
export async function POST(request: Request) {
  const auth = authorizeApiKey(request);
  if (!auth.ok) {
    return Response.json(
      { error: "unauthorized", message: "Missing or invalid API key. Send 'Authorization: Bearer mg_live_…'." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = screenRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request", message: "Request failed validation.", issues: z.treeifyError(parsed.error) },
      { status: 422 }
    );
  }

  const result = runScreen(parsed.data);
  if (!result) {
    return Response.json(
      { error: "unknown_drug", message: `drugId '${parsed.data.drug.drugId}' is not in the formulary.` },
      { status: 422 }
    );
  }

  return Response.json(
    {
      drugId: result.verdict.drugId,
      drug: result.drugName,
      verdict: result.verdict.verdict,
      flags: result.verdict.flags,
      screenedAt: result.verdict.screenedAt,
      mode: auth.mode,
    },
    { status: 200 }
  );
}
