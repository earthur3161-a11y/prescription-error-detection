"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { useSubscriptionStatus } from "@/lib/query/hooks/useSubscriptionStatus";
import type { SubscriptionProduct } from "@/lib/supabase/types";

const ROLE_PRODUCT: Partial<Record<string, SubscriptionProduct>> = {
  prescriber: "physician_portal",
  pharmacist: "pharmacy_portal",
};

/**
 * DB-level RLS is the real enforcement (subscriptions gate patients/
 * prescriptions inserts directly) — this is the UX layer on top, keeping a
 * lapsed Physician/Pharmacy account out of the portal shell entirely rather
 * than letting them click around into writes that will silently fail.
 * Facility Admin and Super Admin have no subscription product and pass
 * straight through.
 */
export function SubscriptionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { role } = useAuth();
  const product = role ? ROLE_PRODUCT[role] : undefined;
  const subscription = useSubscriptionStatus(product ?? null, false);

  useEffect(() => {
    if (!product || subscription.isLoading) return;
    if (subscription.data && !subscription.data.isActive) {
      router.replace("/billing");
    }
  }, [product, subscription.isLoading, subscription.data, router]);

  if (!product) return <>{children}</>;

  if (subscription.isLoading) {
    return (
      <div className="grid h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-subtle" aria-hidden="true" />
      </div>
    );
  }
  if (subscription.data && !subscription.data.isActive) return null;

  return <>{children}</>;
}
