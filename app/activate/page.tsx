"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import type { AccountRole } from "@/lib/types";

const LOGIN_ROUTE: Partial<Record<AccountRole, string>> = {
  prescriber: "/physician/login",
  pharmacist: "/pharmacy/login",
  admin: "/admin/login",
};

interface InviteeProfile {
  name: string;
  title: string;
  role: AccountRole;
}

/**
 * Consumes Supabase's own invite-link redirect, not a MediGuard-issued
 * token — there's no [token] path segment because the token arrives as a
 * URL hash fragment (…/activate#access_token=…), which never reaches the
 * server; Supabase's client reads it directly from window.location and
 * establishes a session automatically (detectSessionInUrl, the default).
 * In the common case that's done before this page's effects even run; the
 * auth-state listener below also catches it completing a beat later.
 */
export default function ActivateAccountPage() {
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [profile, setProfile] = useState<InviteeProfile | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("name, title, role")
        .eq("id", userId)
        .single();
      if (cancelled) return;
      if (data) {
        setProfile(data);
        setStatus("ready");
      } else {
        setStatus("invalid");
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session?.user) loadProfile(data.session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user.id);
    });

    // No session showed up at all within a few seconds — the link is
    // missing, expired, or already used.
    const timeout = setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 4000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      // The invite link signs the user in as a side effect of establishing
      // the session — sign back out so they land on their portal's real
      // login screen next, rather than being silently already authenticated.
      await supabase.auth.signOut();
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  const loginRoute = profile ? (LOGIN_ROUTE[profile.role] ?? "/login") : "/login";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <ShieldCheck className="size-7 text-brand" aria-hidden="true" />
        <span className="text-xl font-semibold text-foreground">MediGuard</span>
      </Link>
      <Card className="w-full max-w-md animate-fade-up">
        <CardBody className="space-y-5">
          {status === "checking" ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-subtle" aria-hidden="true" />
            </div>
          ) : status === "invalid" || !profile ? (
            <div className="space-y-2 text-center">
              <h1 className="text-lg font-semibold text-foreground">Invalid or expired invite</h1>
              <p className="text-sm text-muted-foreground">
                This activation link isn&rsquo;t valid. Please{" "}
                <Link href="/request-access" className="font-medium text-brand hover:underline">
                  request access
                </Link>{" "}
                again.
              </p>
            </div>
          ) : done ? (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto size-10 text-safe-fg" aria-hidden="true" />
              <h1 className="text-lg font-semibold text-foreground">Account activated</h1>
              <p className="text-sm text-muted-foreground">
                Your password is set. You can now sign in to the {profile.title} portal.
              </p>
              <Link href={loginRoute}>
                <Button className="w-full">Go to sign in</Button>
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Set your password</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Welcome, {profile.name}. Choose a password to activate your {profile.title} account.
                </p>
              </div>
              <form className="space-y-3" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="pw" className="mb-1.5 block text-sm font-medium text-secondary">
                    New password
                  </label>
                  <PasswordInput
                    id="pw"
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
                <div>
                  <label htmlFor="pw2" className="mb-1.5 block text-sm font-medium text-secondary">
                    Confirm password
                  </label>
                  <PasswordInput
                    id="pw2"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                  {confirm.length > 0 && (
                    <p
                      className={cn(
                        "mt-1 text-xs transition-colors duration-200",
                        confirm === password ? "text-safe-fg" : "text-caution-fg"
                      )}
                    >
                      {confirm === password ? "✓ Passwords match" : "Passwords don't match yet"}
                    </p>
                  )}
                </div>
                {error && (
                  <Notice tone="blocked" role="alert">
                    {error}
                  </Notice>
                )}
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
                  Activate account
                </Button>
              </form>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
