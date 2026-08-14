import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { RouteFadeIn } from "@/components/layout/RouteFadeIn";

export const metadata: Metadata = {
  title: "MediGuard — Check your prescription",
  description: "A quick, free second check on your prescription — sign in with just your phone number.",
};

export default function CheckLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 glass border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-patient">
              <ShieldCheck className="size-5 text-brand-foreground" aria-hidden="true" />
            </span>
            <span className="font-semibold text-foreground">MediGuard</span>
          </Link>
          <div className="flex items-center gap-3">
            {/*
              The brand mark above already links home, but a returning
              patient — often mid-flow on a phone — doesn't reliably read a
              logo tap as "go home." An explicit, textual link removes the
              ambiguity.
            */}
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-patient hover:underline">
              Home
            </Link>
            <Link href="/check/history" className="text-sm font-medium text-patient hover:underline">
              My checks
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg px-5 pb-16 pt-6 sm:max-w-xl sm:px-6 sm:pt-8 lg:max-w-2xl lg:px-8 lg:pb-20 lg:pt-12">
        <RouteFadeIn>
          <div className="sm:rounded-3xl sm:border sm:border-border sm:bg-surface sm:p-8 sm:shadow-md lg:p-10">
            {children}
          </div>
        </RouteFadeIn>
      </main>
    </div>
  );
}
