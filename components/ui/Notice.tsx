import type { ReactNode } from "react";
import { AlertTriangle, HelpCircle, Info, ShieldCheck, Sparkles, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type NoticeTone = "neutral" | "brand" | "safe" | "caution" | "blocked" | "unknown";

interface NoticeProps {
  tone?: NoticeTone;
  icon?: LucideIcon;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  /** e.g. "alert" for a validation/submit error, so it's announced immediately rather than only on next tab stop. Omitted by default — most Notice usages are informational, not an interruption worth announcing. */
  role?: string;
}

const toneClasses: Record<NoticeTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  brand: "border-transparent bg-brand-subtle text-brand",
  safe: "border-safe-border bg-safe-bg text-safe-fg",
  caution: "border-caution-border bg-caution-bg text-caution-fg",
  blocked: "border-blocked-border bg-blocked-bg text-blocked-fg",
  unknown: "border-unknown-border bg-unknown-bg text-unknown-fg",
};

const toneIcons: Record<NoticeTone, LucideIcon> = {
  neutral: Info,
  brand: Sparkles,
  safe: ShieldCheck,
  caution: AlertTriangle,
  blocked: XCircle,
  unknown: HelpCircle,
};

/** Shared inline banner for coverage disclosures, status notices, and alerts. */
export function Notice({ tone = "neutral", icon, title, children, className, role }: NoticeProps) {
  const Icon = icon ?? toneIcons[tone];
  return (
    <div role={role} className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 animate-fade-up", toneClasses[tone], className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="text-sm">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-0.5 opacity-90" : undefined}>{children}</div>
      </div>
    </div>
  );
}
