/**
 * Mirrors the `override_note_required_if_flagged` CHECK constraint on
 * dispense_records (supabase/migrations/0010) exactly — same length
 * threshold, same placeholder list — so the API route can reject a trivial
 * note with a clear 422 before ever reaching Postgres, while the DB
 * constraint remains the unconditional backstop if this ever drifts.
 */
const TRIVIAL_PLACEHOLDERS = new Set([
  "ok", "okay", "na", "n/a", "none", "no", "yes", "-", "--", "fine", "proceed", "approved", "confirmed",
]);

const MIN_LENGTH = 10;

export function isGenuineOverrideNote(note: string | null | undefined): boolean {
  if (!note) return false;
  const trimmed = note.trim();
  if (trimmed.length < MIN_LENGTH) return false;
  if (TRIVIAL_PLACEHOLDERS.has(trimmed.toLowerCase())) return false;
  return true;
}
