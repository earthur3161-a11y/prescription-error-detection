import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const metadata: Metadata = {
  title: "MediGuard — Check your prescription",
  description: "A quick, free second check on your prescription — no account needed.",
};

export default function CheckLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-hero min-h-screen">
      <header className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
        <Link href="/check" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-brand shadow-glow">
            <ShieldCheck className="size-5 text-white" aria-hidden="true" />
          </span>
          <span className="font-semibold text-foreground">MediGuard</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/check/history" className="text-sm font-medium text-brand hover:underline">
            My checks
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-lg px-5 pb-16">{children}</main>
    </div>
  );
}
