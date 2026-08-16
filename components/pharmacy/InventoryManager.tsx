"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FilePlus2, PackagePlus, Pencil, Search, TriangleAlert } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Kpi } from "@/components/analytics/Kpi";
import { PageShell } from "@/components/layout/PageShell";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useBatches, usePharmacySettings, useApplyStockAdjustment, useAddBatch } from "@/lib/query/hooks/usePharmacy";
import { useAuth } from "@/lib/auth/useAuth";
import { summariseStock, effectiveBatchStatus } from "@/lib/pharmacy/inventory";
import type { Batch, BatchStatus, StockAdjustmentType } from "@/lib/types";

const STATUS_TONE: Record<BatchStatus, "safe" | "caution" | "blocked" | "neutral"> = {
  active: "safe",
  near_expiry: "caution",
  expired: "blocked",
  recalled: "blocked",
};

const STATUS_LABEL: Record<BatchStatus, string> = {
  active: "Active",
  near_expiry: "Near expiry",
  expired: "Expired",
  recalled: "Recalled",
};

interface InventoryManagerProps {
  /** Where the promo card's button sends the owner to add stock to work with — /pharmacist/verify/new for a pharmacist screening someone else's prescription, /prescriptions/new for a physician writing their own. */
  promoHref: string;
  promoLabel: string;
  promoTitle: string;
  promoDescription: string;
}

/**
 * Stock-on-hand management: batch tracking, low-stock/expiry alerts, and
 * adjustments — scoped entirely by ownership (batches_select_own /
 * batches_insert_own), not role, so this is identical for a pharmacist and
 * an independent physician managing their own private stock. Extracted from
 * app/(app)/pharmacist/inventory/page.tsx so both
 * app/(app)/pharmacist/inventory/page.tsx and app/(app)/inventory/page.tsx
 * (independent-physician-only) share one implementation — only the promo
 * card differs between the two audiences.
 */
export function InventoryManager({ promoHref, promoLabel, promoTitle, promoDescription }: InventoryManagerProps) {
  const { user } = useAuth();
  const { data: formulary } = useFormulary();
  const { data: batches } = useBatches();
  const { data: settings } = usePharmacySettings();
  const applyAdjustment = useApplyStockAdjustment();
  const addBatch = useAddBatch();

  const [query, setQuery] = useState("");
  const [adjustBatch, setAdjustBatch] = useState<Batch | null>(null);
  const [adjType, setAdjType] = useState<StockAdjustmentType>("addition");
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newBatch, setNewBatch] = useState({ drugId: "", batchNumber: "", supplier: "", expiryDate: "", quantityRemaining: 0 });

  const pharmacistId = user?.id ?? "user_kwame_mensah";

  const summaries = useMemo(() => {
    if (!formulary || !batches || !settings) return [];
    return summariseStock(formulary.drugs, batches, settings);
  }, [formulary, batches, settings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((s) => s.drug.generic_name.toLowerCase().includes(q) || s.drug.brand_names.some((b) => b.toLowerCase().includes(q)));
  }, [summaries, query]);

  const totals = useMemo(() => {
    const lowStock = summaries.filter((s) => s.lowStock).length;
    const nearExpiry = summaries.reduce((n, s) => n + s.nearExpiryCount, 0);
    const expired = summaries.reduce((n, s) => n + s.expiredCount, 0);
    return { lowStock, nearExpiry, expired };
  }, [summaries]);

  if (!formulary || !batches || !settings) {
    return (
      <PageShell maxWidth="4xl" className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </PageShell>
    );
  }
  const nearExpiryDays = settings.nearExpiryDays;

  function submitAdjustment() {
    if (!adjustBatch || adjQty <= 0 || !adjReason.trim()) return;
    const signed = adjType === "addition" ? adjQty : adjType === "removal" || adjType === "return" ? -adjQty : adjQty;
    applyAdjustment.mutate(
      { batchId: adjustBatch.id, pharmacistId, adjustmentType: adjType, quantity: signed, reason: adjReason.trim() },
      { onSuccess: () => { setAdjustBatch(null); setAdjQty(0); setAdjReason(""); setAdjType("addition"); } }
    );
  }

  function submitNewBatch() {
    if (!newBatch.drugId || !newBatch.batchNumber || !newBatch.expiryDate || newBatch.quantityRemaining <= 0) return;
    addBatch.mutate(
      {
        batch: {
          drugId: newBatch.drugId,
          batchNumber: newBatch.batchNumber.trim(),
          supplier: newBatch.supplier.trim() || "Unknown",
          receivedDate: new Date().toISOString().slice(0, 10),
          expiryDate: newBatch.expiryDate,
          quantityRemaining: newBatch.quantityRemaining,
        },
        pharmacistId,
        institutionId: user?.institutionId ?? null,
      },
      { onSuccess: () => { setAddOpen(false); setNewBatch({ drugId: "", batchNumber: "", supplier: "", expiryDate: "", quantityRemaining: 0 }); } }
    );
  }

  return (
    <PageShell maxWidth="4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">Stock on hand, batch tracking, and alerts.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <PackagePlus className="size-5" aria-hidden="true" />
          Add batch
        </Button>
      </div>

      <Card className="border-brand/30 bg-brand-subtle/40">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">{promoTitle}</p>
            <p className="text-sm text-muted-foreground">{promoDescription}</p>
          </div>
          <Link href={promoHref}>
            <Button>
              <FilePlus2 className="size-5" aria-hidden="true" />
              {promoLabel}
            </Button>
          </Link>
        </CardBody>
      </Card>

      <div className="stagger grid grid-cols-3 gap-3">
        <Kpi label="Low stock" value={String(totals.lowStock)} sub="drugs below threshold" tone="caution" />
        <Kpi label="Near expiry" value={String(totals.nearExpiry)} sub={`batches within ${nearExpiryDays} days`} tone="caution" />
        <Kpi label="Expired" value={String(totals.expired)} sub="batches to remove" tone="blocked" />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stock by drug or brand…" className="pl-9" />
      </div>

      <div className="stagger space-y-3">
        {filtered.map((s) => (
          <Card key={s.drug.id} className={s.lowStock ? "border-l-4 border-l-caution-fg" : undefined}>
            <CardBody className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{s.drug.generic_name}</p>
                  <p className="text-xs text-muted-foreground">{s.drug.class}</p>
                </div>
                <div className="flex items-center gap-2">
                  {s.lowStock && (
                    <Badge tone="caution">
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                      Low stock
                    </Badge>
                  )}
                  <Badge tone={s.dispensable > 0 ? "safe" : "blocked"}>{s.dispensable} dispensable</Badge>
                </div>
              </div>
              <ul className="divide-y divide-border border-t border-border">
                {s.batches
                  .slice()
                  .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
                  .map((b) => {
                    const status = effectiveBatchStatus(b, nearExpiryDays);
                    return (
                      <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <div>
                          <span className="font-medium text-secondary">{b.batchNumber}</span>
                          <span className="text-subtle"> · {b.supplier} · exp {b.expiryDate} · {b.quantityRemaining} units</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                          <button
                            onClick={() => { setAdjustBatch(b); setAdjType("addition"); setAdjQty(0); setAdjReason(""); }}
                            className="-m-2.5 rounded-lg p-2.5 text-subtle hover:bg-muted hover:text-brand"
                            aria-label={`Adjust ${b.batchNumber}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </CardBody>
          </Card>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No stock matches that search.</p>}
      </div>

      {/* Stock adjustment modal */}
      <Modal
        open={!!adjustBatch}
        onOpenChange={(o) => !o && setAdjustBatch(null)}
        title="Adjust stock"
        description={adjustBatch ? `Batch ${adjustBatch.batchNumber} — ${adjustBatch.quantityRemaining} on hand.` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustBatch(null)}>Cancel</Button>
            <Button onClick={submitAdjustment} disabled={adjQty <= 0 || !adjReason.trim() || applyAdjustment.isPending}>Apply</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="adjust-type" className="mb-1.5 block text-sm font-medium text-secondary">Type</label>
              <Select id="adjust-type" value={adjType} onChange={(e) => setAdjType(e.target.value as StockAdjustmentType)}>
                <option value="addition">Addition (delivery)</option>
                <option value="removal">Removal (damaged)</option>
                <option value="return">Return</option>
                <option value="correction">Correction (count)</option>
              </Select>
            </div>
            <div>
              <label htmlFor="adjust-quantity" className="mb-1.5 block text-sm font-medium text-secondary">Quantity</label>
              <Input id="adjust-quantity" type="number" min={1} value={adjQty} onChange={(e) => setAdjQty(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label htmlFor="adjust-reason" className="mb-1.5 block text-sm font-medium text-secondary">Reason (required)</label>
            <Input id="adjust-reason" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="e.g. New delivery from Kinapharma" />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-subtle">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            Every adjustment is logged with your identity and timestamp.
          </p>
        </div>
      </Modal>

      {/* Add batch modal */}
      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add a batch to stock"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitNewBatch} disabled={addBatch.isPending}>Add batch</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="batch-drug" className="mb-1.5 block text-sm font-medium text-secondary">Drug</label>
            <Select id="batch-drug" value={newBatch.drugId} onChange={(e) => setNewBatch((p) => ({ ...p, drugId: e.target.value }))}>
              <option value="">Select a drug…</option>
              {formulary.drugs.map((d) => (
                <option key={d.id} value={d.id}>{d.generic_name}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="batch-number" className="mb-1.5 block text-sm font-medium text-secondary">Batch number</label>
              <Input id="batch-number" value={newBatch.batchNumber} onChange={(e) => setNewBatch((p) => ({ ...p, batchNumber: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="batch-supplier" className="mb-1.5 block text-sm font-medium text-secondary">Supplier</label>
              <Input id="batch-supplier" value={newBatch.supplier} onChange={(e) => setNewBatch((p) => ({ ...p, supplier: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="batch-expiry" className="mb-1.5 block text-sm font-medium text-secondary">Expiry date</label>
              <Input id="batch-expiry" type="date" value={newBatch.expiryDate} onChange={(e) => setNewBatch((p) => ({ ...p, expiryDate: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="batch-quantity" className="mb-1.5 block text-sm font-medium text-secondary">Quantity</label>
              <Input id="batch-quantity" type="number" min={1} value={newBatch.quantityRemaining} onChange={(e) => setNewBatch((p) => ({ ...p, quantityRemaining: Number(e.target.value) }))} />
            </div>
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}
