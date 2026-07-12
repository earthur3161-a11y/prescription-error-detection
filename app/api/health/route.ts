// Vercel sets VERCEL_GIT_COMMIT_SHA automatically for Git-connected deploys —
// no config needed. Exposing it here lets an external check confirm
// production is actually serving the commit that was just pushed, rather
// than a silently-stale build from a failed deploy (this happened for real:
// see the vercel-deploy-gotchas incident — the build failed but the old
// deployment kept serving 200s with no visible signal).
export async function GET() {
  return Response.json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
  });
}
