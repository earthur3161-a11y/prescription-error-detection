/**
 * Demo-grade, dependency-free one-way password hashing. This is DELIBERATELY
 * NOT production cryptography — a real deployment must use a slow, salted KDF
 * (bcrypt/argon2) on a server, never client-side. It exists only so this
 * frontend-only demo never stores plaintext passwords in IndexedDB.
 */
export function hashPassword(password: string): string {
  const salted = `mediguard::${password}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < salted.length; i++) {
    const c = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `mg1$${h1.toString(16)}${h2.toString(16)}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  if (!hash) return false;
  return hashPassword(password) === hash;
}
