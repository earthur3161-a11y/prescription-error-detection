/** Accepts a Ghana mobile number as either 0XXXXXXXXX or 233XXXXXXXXX (any non-digit separators ignored). */
export function isValidGhPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return /^0\d{9}$/.test(digits) || /^233\d{9}$/.test(digits);
}

/**
 * Normalizes a Ghana mobile number to E.164 (+233XXXXXXXXX) — the format
 * Africa's Talking's SMS API requires for reliable delivery, and the
 * canonical form self_check_accounts/patient_checks are keyed on. Accepts
 * the same 0XXXXXXXXX / 233XXXXXXXXX / +233XXXXXXXXX shapes isValidGhPhone
 * does (any non-digit separators ignored) and is idempotent on an
 * already-normalized input. This previously didn't exist anywhere in the
 * pipeline: SignInStep sent whatever the patient literally typed (commonly
 * "0XXXXXXXXX") straight through to both the SMS API and every phone-keyed
 * DB lookup, which Africa's Talking's API doesn't treat as a valid
 * international destination. Call this once at the point a phone number is
 * first accepted (SignInStep) — everything downstream (send, verify, quota,
 * payment, patient_checks) threads that same confirmed string through, so a
 * single normalization point keeps it consistent everywhere. The two OTP
 * routes normalize again defensively since they're independently callable.
 * Returns the input unchanged if it doesn't match a recognized Ghana shape —
 * callers should validate with isValidGhPhone first.
 */
export function toE164Gh(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return `+233${digits.slice(1)}`;
  if (/^233\d{9}$/.test(digits)) return `+${digits}`;
  return phone;
}
