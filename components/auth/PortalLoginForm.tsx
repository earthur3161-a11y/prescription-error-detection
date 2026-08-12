"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuth } from "@/lib/auth/useAuth";
import { ROLE_HOME_ROUTE } from "@/lib/auth/roles";
import { authenticate } from "@/lib/data/repositories/accountRepository";
import type { AccountRole } from "@/lib/types";

export interface PortalConfig {
  role: AccountRole;
  /** URL segment used for the request-access role — only Facility Admin still uses human-reviewed onboarding. */
  requestRole?: "admin";
  /** Self-serve signup route — Physician/Pharmacy Portals use this instead of request-access. */
  signupHref?: string;
  portalName: string;
  tagline: string;
  icon: ComponentType<{ className?: string }>;
  accentClass: string; // background tint for the icon badge
  iconClass: string; // icon color
}

export function PortalLoginForm({ config }: { config: PortalConfig }) {
  const router = useRouter();
  const { login, role, hasHydrated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // If already signed in, bounce to the correct workspace.
  useEffect(() => {
    if (hasHydrated && role) router.replace(ROLE_HOME_ROUTE[role]);
  }, [hasHydrated, role, router]);

  const Icon = config.icon;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      // Role is enforced in the data layer — an account of a different role
      // cannot sign in here even by navigating to this URL directly.
      const account = await authenticate(email, password, config.role);
      if (!account) {
        // Generic message — never reveal whether the account exists.
        setError("Invalid login. Check your details and try again.");
        return;
      }
      login({
        id: account.id,
        name: account.name,
        role: account.role,
        title: account.title,
        email: account.email,
        institutionId: account.institutionId,
      });
      router.replace(ROLE_HOME_ROUTE[account.role]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="mb-6 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-brand">
        ← MediGuard home
      </Link>
      <Card className="w-full max-w-md animate-fade-up shadow-md">
        <CardBody className="space-y-5">
          <div className="flex flex-col items-center text-center">
            <div className={`mb-3 flex size-14 items-center justify-center rounded-2xl shadow-sm ${config.accentClass}`}>
              <Icon className={`size-7 ${config.iconClass}`} />
            </div>
            <h1 className="text-xl font-semibold text-foreground">{config.portalName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{config.tagline}</p>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-secondary">
                Work email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-secondary">
                Password
              </label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <Notice tone="blocked" role="alert">
                {error}
              </Notice>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
              Sign in
            </Button>
          </form>

          {config.requestRole && (
            <p className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
              Don&rsquo;t have an account?{" "}
              <Link
                href={`/request-access?role=${config.requestRole}`}
                className="font-medium text-brand hover:underline"
              >
                Request access
              </Link>
            </p>
          )}
          {config.signupHref && (
            <p className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
              Don&rsquo;t have an account?{" "}
              <Link href={config.signupHref} className="font-medium text-brand hover:underline">
                Create an account
              </Link>
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
