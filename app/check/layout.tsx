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
      <header className="sticky top-0 z-20 glass border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
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
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg px-5 pb-16 pt-6 sm:max-w-xl sm:px-6 sm:pt-8 lg:max-w-2xl lg:px-8 lg:pb-20 lg:pt-12">
        <div className="sm:rounded-3xl sm:border sm:border-border sm:bg-surface sm:p-8 sm:shadow-md lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
