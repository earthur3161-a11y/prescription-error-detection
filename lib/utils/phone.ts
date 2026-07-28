/** Accepts a Ghana mobile number as either 0XXXXXXXXX or 233XXXXXXXXX (any non-digit separators ignored). */
export function isValidGhPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return /^0\d{9}$/.test(digits) || /^233\d{9}$/.test(digits);
}
