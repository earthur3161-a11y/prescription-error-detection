import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Drug, FormularyBundle } from "@/lib/types";

const DRAFT_STORAGE_KEY = "mediguard:self-check-draft:v1";

const stubDrug: Drug = {
  id: "drug_amoxicillin",
  generic_name: "Amoxicillin",
  brand_names: [],
  class: "Penicillin",
  standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 500, maxMgPerDay: 1500, frequency: "3x/day", weightBased: false },
  route: ["oral"],
  region_availability: ["GH"],
  onEssentialMedicinesList: true,
};
const stubFormulary: FormularyBundle = {
  region: "GH",
  drugs: [stubDrug],
  interactionRules: [],
  allergyRules: [],
  foodInteractionRules: [],
  alcoholInteractionRules: [],
};

const pushMock = vi.fn();
const createCheckMutate = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/query/hooks/useFormulary", () => ({
  useFormulary: () => ({ data: stubFormulary, isLoading: false }),
  useDrugSearchFuzzy: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/lib/query/hooks/usePatientProfile", () => ({
  useLocalPatientProfile: () => ({ data: undefined }),
  useSaveLocalPatientProfile: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/lib/query/hooks/usePatientChecks", () => ({
  useCreatePatientCheck: () => ({ mutate: createCheckMutate, isPending: false }),
}));

// Drives the "you have N free checks" reassurance Notice at the top of
// "add" — undefined data here just means that Notice doesn't render, which
// no test in this file depends on either way.
vi.mock("@/lib/query/hooks/useCheckQuota", () => ({
  useCheckQuota: () => ({ data: undefined, isFetching: false }),
}));

vi.mock("@/lib/store/toast-store", () => ({
  useToastStore: (selector: (s: { show: (t: unknown) => void }) => unknown) => selector({ show: vi.fn() }),
}));

// SignInStep and UnlockCheckStep each have their own dedicated test file —
// here they're stubbed to single buttons so this file can test NewCheckPage's
// own responsibility (the sign-in gate ordering, the sessionStorage draft) in
// isolation, without re-driving phone/OTP/payment through either of them.
vi.mock("@/components/patient-check/SignInStep", () => ({
  SignInStep: ({ onSignedIn }: { onSignedIn: (phone: string) => void }) => (
    <button onClick={() => onSignedIn("0244123456")}>Stub sign in</button>
  ),
}));
vi.mock("@/components/patient-check/UnlockCheckStep", () => ({
  UnlockCheckStep: ({ onUnlocked }: { onUnlocked: (phone: string) => void }) => (
    <button onClick={() => onUnlocked("0244123456")}>Stub unlock</button>
  ),
}));

const { default: NewCheckPage } = await import("../page");

function signIn() {
  fireEvent.click(screen.getByRole("button", { name: /stub sign in/i }));
}

describe("NewCheckPage — mandatory sign-in gate", () => {
  afterEach(() => cleanup());

  it("shows the sign-in step first, before any drug-adding UI", () => {
    render(<NewCheckPage />);

    expect(screen.getByRole("button", { name: /stub sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^continue$/i })).not.toBeInTheDocument();
  });

  it("moves to the 'add' step once signed in", () => {
    render(<NewCheckPage />);
    signIn();

    expect(screen.queryByRole("button", { name: /stub sign in/i })).not.toBeInTheDocument();
    expect(screen.getByText(/what did you get/i)).toBeInTheDocument();
  });
});

describe("NewCheckPage — in-progress draft survives a refresh via sessionStorage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("rehydrates a previously-entered drug list and profile from sessionStorage after signing in", async () => {
    sessionStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        drugIds: ["drug_amoxicillin"],
        profile: {
          ageYears: 34,
          weightKg: 70,
          allergies: null,
          activeMedications: null,
          isPregnant: null,
          renalStatus: "unknown",
          hepaticStatus: "unknown",
          reportedConditions: [],
          complaintNote: null,
        },
      })
    );

    render(<NewCheckPage />);
    signIn();

    // Step "add" — only data is rehydrated, not step position — must show
    // the drug that was already added before the simulated refresh, not a
    // blank picker.
    await waitFor(() => expect(screen.getByText("Amoxicillin")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^continue$/i })).not.toBeDisabled();
  });

  it("starts with an empty form when there is no draft", async () => {
    render(<NewCheckPage />);
    signIn();

    expect(screen.queryByText("Amoxicillin")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^continue$/i })).toBeDisabled();
  });

  it("clears the sessionStorage draft once a patient_check row is actually created", async () => {
    sessionStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        drugIds: ["drug_amoxicillin"],
        profile: {
          ageYears: null,
          weightKg: null,
          allergies: null,
          activeMedications: null,
          isPregnant: null,
          renalStatus: "unknown",
          hepaticStatus: "unknown",
          reportedConditions: [],
          complaintNote: null,
        },
      })
    );
    createCheckMutate.mockImplementation((_params, { onSuccess }) => {
      onSuccess({ allowed: true, check: { id: "check_123" } });
    });

    render(<NewCheckPage />);
    signIn();
    await waitFor(() => expect(screen.getByText("Amoxicillin")).toBeInTheDocument());
    expect(sessionStorage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i })); // add -> profile
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i })); // profile -> unlock
    fireEvent.click(screen.getByRole("button", { name: /stub unlock/i })); // triggers handleUnlocked

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/check/result/check_123"));
    // Must not leak into the next, unrelated check the patient might start
    // in this same tab.
    expect(sessionStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });
});
