import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Flag } from "@/lib/screening-engine";
import type { FormularyBundle } from "@/lib/types";

const mockSearchParams = vi.fn<() => URLSearchParams>();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams(),
}));

const stubFormulary: FormularyBundle = {
  region: "GH",
  drugs: [
    {
      id: "drug_amoxicillin",
      generic_name: "Amoxicillin",
      brand_names: [],
      class: "Penicillin",
      standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 500, maxMgPerDay: 1500, frequency: "3x/day", weightBased: false },
      route: ["oral"],
      region_availability: ["GH"],
      onEssentialMedicinesList: true,
    },
  ],
  interactionRules: [],
  allergyRules: [],
  foodInteractionRules: [],
  alcoholInteractionRules: [],
};

vi.mock("@/lib/query/hooks/useFormulary", () => ({
  useFormulary: () => ({ data: stubFormulary, isLoading: false }),
}));

// Imported after the mocks above so the component picks them up.
const { default: WidgetScreenPage } = await import("../page");

function postScreenMessage() {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "mediguard:screen",
          patient: { dob: "1988-04-12" },
          drug: { drugId: "drug_amoxicillin", doseMg: 500, frequencyPerDay: 3, durationDays: 7, route: "oral" },
        },
      })
    );
  });
}

describe("Widget screen page — authentication", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows a missing-key error immediately when no apiKey is present and it's not a demo embed", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams());
    render(<WidgetScreenPage />);
    expect(screen.getByText(/needs a valid API key/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never calls the local engine directly for a real (non-demo) embed — always goes through /api/v1/screen", async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("apiKey=mg_live_test123"));
    // Matches the REAL /api/v1/screen response shape (app/api/v1/screen/route.ts):
    // flat — verdict is the Verdict string, flags is a sibling field, not
    // nested under verdict. Caught a real bug during live verification: the
    // widget originally treated `body.verdict` as if it were the whole
    // DrugLineVerdict object, which crashed on `.flags.length` the first
    // time this was exercised against the actual endpoint rather than a
    // hand-rolled mock shaped like the wrong assumption.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        drugId: "drug_amoxicillin",
        drug: "Amoxicillin",
        verdict: "safe",
        flags: [],
        screenedAt: "2026-01-01T00:00:00Z",
        mode: "live",
        institution: "Korle Bu Teaching Hospital",
        enforcementLevel: "advisory",
      }),
    });
    render(<WidgetScreenPage />);
    postScreenMessage();

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/v1/screen");
    expect(init.headers.Authorization).toBe("Bearer mg_live_test123");
    expect(JSON.parse(init.body).drug.drugId).toBe("drug_amoxicillin");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Safe"));
  });

  it("shows the API's own error message when the key is rejected (401)", async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("apiKey=mg_live_revoked"));
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "unauthorized", message: "Missing or invalid API key. Send 'Authorization: Bearer mg_live_…'." }),
    });
    render(<WidgetScreenPage />);
    postScreenMessage();

    await waitFor(() => expect(screen.getByText(/missing or invalid api key/i)).toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the API's own error message for an unrecognized drug (422)", async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("apiKey=mg_live_test123"));
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "unknown_drug", message: "drugId 'drug_amoxicillin' is not in the formulary." }),
    });
    render(<WidgetScreenPage />);
    postScreenMessage();

    await waitFor(() => expect(screen.getByText(/not in the formulary/i)).toBeInTheDocument());
  });

  it("demo mode never requires a key and never calls fetch", async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("demo=1"));
    render(<WidgetScreenPage />);

    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows every flag via a 'Show N more' expand affordance instead of silently truncating past 2", async () => {
    // Regression test: the card used to hard-cap the visible list at
    // state.flags.slice(0, 2) with no indication more existed, even though
    // postMessage always carried the full list to the host. A drug flagged
    // for 4 distinct reasons must let the embedder actually see all 4.
    function flag(clinical: string): Flag {
      return {
        type: "interaction",
        code: "TEST",
        severity: "major",
        message: clinical,
        audience_variant: { clinical, patient: clinical },
      };
    }
    const flags = [flag("Reason one"), flag("Reason two"), flag("Reason three"), flag("Reason four")];

    mockSearchParams.mockReturnValue(new URLSearchParams("apiKey=mg_live_test123"));
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        drugId: "drug_amoxicillin",
        drug: "Amoxicillin",
        verdict: "blocked",
        flags,
        screenedAt: "2026-01-01T00:00:00Z",
        mode: "live",
        institution: "Korle Bu Teaching Hospital",
        enforcementLevel: "advisory",
      }),
    });
    render(<WidgetScreenPage />);
    postScreenMessage();

    await waitFor(() => expect(screen.getByText("Reason one")).toBeInTheDocument());
    expect(screen.getByText("Reason two")).toBeInTheDocument();
    expect(screen.queryByText("Reason three")).not.toBeInTheDocument();
    expect(screen.queryByText("Reason four")).not.toBeInTheDocument();

    const expandButton = screen.getByRole("button", { name: /show 2 more/i });
    fireEvent.click(expandButton);

    expect(screen.getByText("Reason three")).toBeInTheDocument();
    expect(screen.getByText("Reason four")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show.*more/i })).not.toBeInTheDocument();
  });
});
