"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getAccessRequestByInviteToken } from "@/lib/data/repositories/accessRequestRepository";
import { activateAccount, getAccountById } from "@/lib/data/repositories/accountRepository";
import type { AccountRole } from "@/lib/types";

const LOGIN_ROUTE: Partial<Record<AccountRole, string>> = {
  prescriber: "/physician/login",
  pharmacist: "/pharmacy/login",
  admin: "/admin/login",
};

export default function ActivateAccountPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["invite", token],
    queryFn: async () => {
      const request = await getAccessRequestByInviteToken(token);
      if (!request?.provisionedAccountId) return null;
      const account = await getAccountById(request.provisionedAccountId);
      return account ? { request, account } : null;
    },
  });

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
    if (!data?.account) return;
    setPending(true);
    try {
      await activateAccount(data.account.id, password);
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  const loginRoute = data ? LOGIN_ROUTE[data.account.role] ?? "/login" : "/login";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <ShieldCheck className="size-7 text-brand" aria-hidden="true" />
        <span className="text-xl font-semibold text-foreground">MediGuard</span>
      </Link>
      <Card className="w-full max-w-md">
        <CardBody className="space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-subtle" aria-hidden="true" />
            </div>
          ) : !data ? (
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
                Your password is set. You can now sign in to the {data.account.title} portal.
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
                  Welcome, {data.account.name}. Choose a password to activate your{" "}
                  {data.account.title} account ({data.account.email}).
                </p>
              </div>
              <form className="space-y-3" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="pw" className="mb-1.5 block text-sm font-medium text-secondary">
                    New password
                  </label>
                  <Input
                    id="pw"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="pw2" className="mb-1.5 block text-sm font-medium text-secondary">
                    Confirm password
                  </label>
                  <Input
                    id="pw2"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p role="alert" className="rounded-lg bg-blocked-bg px-3 py-2 text-sm text-blocked-fg">
                    {error}
                  </p>
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
