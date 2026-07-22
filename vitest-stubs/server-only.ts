// Test-only stub for the `server-only` package. In a real Next.js build, that
// package throws if a server-only module is ever pulled into a client
// bundle — a build-time safety net with no meaning under Vitest, which
// doesn't distinguish server/client boundaries the way Next's bundler does.
// Aliased in here (see vitest.config.ts) so server-only modules like
// lib/integration/screenService.ts can be unit-tested directly.
export {};
