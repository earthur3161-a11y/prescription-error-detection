"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { cn } from "@/lib/utils/cn";
import { supabase } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid" | "done";

/**
 * Lands here from the link in the "recovery" email (send-email-hook's own
 * copy for that action type; triggered by PortalLoginForm's "Forgot
 * password?" calling resetPasswordForEmail with redirectTo pointing here).
 * Portal-agnostic on purpose — one shared page for every role, since the
 * reset link itself carries no portal context.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // The Supabase client auto-detects the recovery token in this page's own
    // URL (detectSessionInUrl, the default) and fires this event once it's
    // established a temporary session from it — the only way to tell a
    // genuine, unexpired reset link apart from someone just navigating here
    // directly.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });
    // Covers the event having already fired before this listener attached
    // (a real race on fast connections) — a session existing here at all
    // only happens via the recovery flow landing on this exact page.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus((s) => (s === "checking" ? "ready" : s));
    });
    const timeout = setTimeout(() => setStatus((s) => (s === "checking" ? "invalid" : s)), 5000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("Couldn't update your password. The link may have expired — request a new one.");
        return;
      }
      // The recovery token gave us a temporary Supabase session, but this
      // app's own auth state (role, institution, the Zustand store every
      // other screen reads) is only ever populated by the normal sign-in
      // flow's login() call — never by this one. Signing out and sending
      // them through /login for a fresh, real sign-in avoids leaving them
      // in a half-authenticated state the rest of the app doesn't expect.
      await supabase.auth.signOut();
      setStatus("done");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bg-hero flex min-h-screen flex-col items-center px-4 py-10">
      <Link
        href="/"
        className="mb-6 flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
          <ShieldCheck className="size-5 text-white" aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold text-foreground">MediGuard</span>
      </Link>
      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <Card className="w-full max-w-md animate-fade-up shadow-md">
          <CardBody className="space-y-5">
            {status === "checking" && (
              <div className="flex justify-center py-6">
                <Loader2 className="size-6 animate-spin text-subtle" aria-hidden="true" />
              </div>
            )}

            {status === "invalid" && (
              <div className="space-y-4 text-center">
                <h1 className="text-xl font-semibold text-foreground">Link expired or invalid</h1>
                <p className="text-sm text-muted-foreground">
                  Request a new password reset link and try again.
                </p>
                <Link href="/login" className="font-medium text-brand hover:underline">
                  Back to sign in
                </Link>
              </div>
            )}

            {status === "ready" && (
              <>
                <div className="text-center">
                  <h1 className="text-xl font-semibold text-foreground">Set a new password</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account.</p>
                </div>
                <form className="space-y-3" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-secondary">
                      New password
                    </label>
                    <PasswordInput
                      id="new-password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <p
                      className={cn(
                        "mt-1 text-xs transition-colors duration-200",
                        password.length >= 8 ? "text-safe-fg" : "text-subtle"
                      )}
                    >
                      {password.length >= 8 ? "✓ " : ""}At least 8 characters.
                    </p>
                  </div>
                  {error && (
                    <Notice tone="blocked" role="alert">
                      {error}
                    </Notice>
                  )}
                  <Button type="submit" className="w-full" disabled={pending}>
                    {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
                    Update password
                  </Button>
                </form>
              </>
            )}

            {status === "done" && (
              <div className="space-y-4 text-center">
                <Notice tone="safe" icon={CheckCircle2}>
                  Your password has been updated.
                </Notice>
                <Button className="w-full" onClick={() => router.push("/login")}>
                  Sign in
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
