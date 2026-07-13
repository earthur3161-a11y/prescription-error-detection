import type { ReactNode } from "react";
import { AlertTriangle, Info, ShieldCheck, Sparkles, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type NoticeTone = "neutral" | "brand" | "safe" | "caution" | "blocked";

interface NoticeProps {
  tone?: NoticeTone;
  icon?: LucideIcon;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

const toneClasses: Record<NoticeTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  brand: "border-transparent bg-brand-subtle text-brand",
  safe: "border-safe-border bg-safe-bg text-safe-fg",
  caution: "border-caution-border bg-caution-bg text-caution-fg",
  blocked: "border-blocked-border bg-blocked-bg text-blocked-fg",
};

const toneIcons: Record<NoticeTone, LucideIcon> = {
  neutral: Info,
  brand: Sparkles,
  safe: ShieldCheck,
  caution: AlertTriangle,
  blocked: XCircle,
};

/** Shared inline banner for coverage disclosures, status notices, and alerts. */
export function Notice({ tone = "neutral", icon, title, children, className }: NoticeProps) {
  const Icon = icon ?? toneIcons[tone];
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", toneClasses[tone], className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="text-sm">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-0.5 opacity-90" : undefined}>{children}</div>
      </div>
    </div>
  );
}
