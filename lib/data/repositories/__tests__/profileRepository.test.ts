import { describe, expect, it, vi } from "vitest";
import type { ProfileRow } from "../../../supabase/types";

const selectMock = vi.fn();
vi.mock("../../../supabase/client", () => ({
  supabase: { from: () => ({ select: selectMock }) },
}));

const { listProfiles } = await import("../profileRepository");

function row(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "profile_1",
    role: "prescriber",
    name: "Dr. ZZTEST_Institution Profile",
    title: "Physician",
    status: "active",
    institution: "Korle Bu Teaching Hospital",
    created_at: "2026-01-01T00:00:00.000Z",
    institution_id: "inst_korle_bu",
    ...overrides,
  };
}

describe("profileRepository.listProfiles / mapRow", () => {
  it("surfaces institution_id on the mapped Profile for an institutional row", async () => {
    selectMock.mockResolvedValueOnce({ data: [row()], error: null });
    const [profile] = await listProfiles();
    expect(profile.institutionId).toBe("inst_korle_bu");
  });

  it("surfaces a null institutionId (not undefined-swallowed) for an independent practitioner row", async () => {
    selectMock.mockResolvedValueOnce({ data: [row({ institution_id: null, institution: null })], error: null });
    const [profile] = await listProfiles();
    expect(profile.institutionId).toBeNull();
  });
});
