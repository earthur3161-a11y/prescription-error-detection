import { authorizeApiKey } from "@/lib/integration/screenService";
import { buildCards, parseCdsRequest } from "@/lib/integration/cdsHooks";

/**
 * POST /cds-services/mediguard-screen — CDS Hooks service invocation.
 * The EHR calls this on order-select / order-sign with the draft orders; we
 * screen each and return CDS Hooks cards (the interruptive in-EHR alert).
 */
export async function POST(request: Request) {
  const auth = await authorizeApiKey(request);
  if (!auth.ok) {
    return Response.json(
      { error: "unauthorized", message: "Missing or invalid API key." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = parseCdsRequest(body);
  if (!parsed) {
    return Response.json(
      { error: "invalid_request", message: "Could not read a CDS Hooks request from the body." },
      { status: 422 }
    );
  }

  // CDS Hooks convention: an empty cards array means "no alerts".
  return Response.json({ cards: buildCards(parsed) }, { status: 200 });
}
