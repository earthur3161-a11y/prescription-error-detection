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
  const auth = await authorizeApiKey(request);
  if (auth.rateLimited) {
    return Response.json(
      {
        error: "rate_limited",
        message: `Rate limit exceeded. Retry after ${auth.retryAfterSeconds}s.`,
        retryAfterSeconds: auth.retryAfterSeconds,
        windowResetAt: auth.windowResetAt,
      },
      { status: 429, headers: { "Retry-After": String(auth.retryAfterSeconds) } }
    );
  }
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
      institution: auth.institutionName,
      enforcementLevel: auth.enforcementLevel,
    },
    { status: 200 }
  );
}
