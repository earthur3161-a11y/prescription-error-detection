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
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/auth/useAuth";
import { ROLE_HOME_ROUTE } from "@/lib/auth/roles";
import { authenticate } from "@/lib/data/repositories/accountRepository";

export interface PortalSignupConfig {
  role: "prescriber" | "pharmacist";
  portalName: string;
  tagline: string;
  loginHref: string;
  icon: ComponentType<{ className?: string }>;
  accentClass: string;
  iconClass: string;
}

export function PortalSignupForm({ config }: { config: PortalSignupConfig }) {
  const router = useRouter();
  const { login, role, hasHydrated } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (hasHydrated && role) router.replace(ROLE_HOME_ROUTE[role]);
  }, [hasHydrated, role, router]);

  const Icon = config.icon;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role: config.role }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message ?? "Couldn't create your account. Try again.");
        return;
      }

      // The signup route creates the account server-side (service role) but
      // can't return a browser session — sign in immediately with the same
      // credentials to establish one, reusing the exact login path every
      // other portal uses.
      const account = await authenticate(email.trim(), password, config.role);
      if (!account) {
        setError("Account created — please sign in.");
        router.push(config.loginHref);
        return;
      }
      login({ id: account.id, name: account.name, role: account.role, title: account.title, email: account.email, institutionId: account.institutionId });
      router.replace("/billing");
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
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-secondary">
                Full name
              </label>
              <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
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
              Create account
            </Button>
          </form>

          <p className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={config.loginHref} className="font-medium text-brand hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-center text-xs text-subtle">
            Joining a hospital or clinic&rsquo;s existing MediGuard account instead?{" "}
            <Link href="/request-access" className="font-medium text-brand hover:underline">
              Request institutional access
            </Link>
            .
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
