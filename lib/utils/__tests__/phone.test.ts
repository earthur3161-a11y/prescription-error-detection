import { describe, expect, it } from "vitest";
import { toE164Gh } from "../phone";

// Regression coverage: this function didn't exist anywhere in the pipeline
// until a real bug was found — SignInStep sent whatever a patient literally
// typed (commonly "0XXXXXXXXX") straight through to Africa's Talking's SMS
// API and every phone-keyed DB lookup, neither of which are guaranteed to
// treat that as the same identity as the E.164 form real delivery requires.
describe("toE164Gh", () => {
  it("converts a 0-prefixed local number to +233 E.164", () => {
    expect(toE164Gh("0244123456")).toBe("+233244123456");
  });

  it("adds a + to a bare 233-prefixed number", () => {
    expect(toE164Gh("233244123456")).toBe("+233244123456");
  });

  it("is idempotent on an already-normalized +233 number", () => {
    expect(toE164Gh("+233244123456")).toBe("+233244123456");
  });

  it("ignores spaces and other separators the patient might type", () => {
    expect(toE164Gh("055 724 1928")).toBe("+233557241928");
    expect(toE164Gh("0557-241-928")).toBe("+233557241928");
  });

  it("returns an unrecognized shape unchanged rather than mangling it", () => {
    expect(toE164Gh("not a phone number")).toBe("not a phone number");
  });
});
