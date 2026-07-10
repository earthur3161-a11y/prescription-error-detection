"use client";

/**
 * Last-resort boundary that catches errors thrown in the root layout itself.
 * It must render its own <html>/<body>. Kept dependency-free so it can render
 * even if the app's providers are what failed.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  async function hardReset() {
    try {
      const dbs = (await indexedDB.databases?.()) ?? [];
      await Promise.all(dbs.map((d) => d.name && indexedDB.deleteDatabase(d.name)));
      indexedDB.deleteDatabase("mediguard");
      localStorage.removeItem("mediguard-session");
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  }

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 16 }}>
          <div style={{ maxWidth: 420, width: "100%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24, textAlign: "center" }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", margin: 0 }}>MediGuard hit a problem</h1>
            <p style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>
              The app failed to start. Clearing locally-saved data usually fixes this.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
              <button onClick={() => reset()} style={{ height: 44, borderRadius: 12, background: "#2563eb", color: "#fff", border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                Try again
              </button>
              <button onClick={hardReset} style={{ height: 44, borderRadius: 12, background: "#fff", color: "#334155", border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                Reset local data &amp; reload
              </button>
            </div>
            {error?.message && <p style={{ marginTop: 16, fontSize: 12, color: "#94a3b8", textAlign: "left", wordBreak: "break-word" }}>Details: {error.message}</p>}
          </div>
        </div>
      </body>
    </html>
  );
}
