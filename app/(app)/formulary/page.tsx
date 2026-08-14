"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { PageShell } from "@/components/layout/PageShell";
import { useAuth } from "@/lib/auth/useAuth";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useDeleteDrug, useUpsertDrug } from "@/lib/query/hooks/useDrugMutations";
import { generateId } from "@/lib/utils/id";
import { DEFAULT_REGION, getBaseFormularyBundle } from "@/lib/formulary";
import type { Drug, Route } from "@/lib/types";

// Same base/custom distinction app/(app)/admin/formulary/page.tsx uses — the
// delete affordance below must only ever appear for something this page
// (or its RLS) can actually remove.
const BASE_DRUG_IDS = new Set(getBaseFormularyBundle(DEFAULT_REGION).drugs.map((d) => d.id));

const ALL_ROUTES: Route[] = ["oral", "IV", "IM", "topical", "inhaled", "rectal", "sublingual", "subcutaneous"];

function emptyDraft(): {
  generic_name: string;
  brand_names: string;
  drugClass: string;
  routes: Route[];
  minMgPerDose: string;
  maxMgPerDose: string;
  maxMgPerDay: string;
  frequency: string;
  onEssentialMedicinesList: boolean;
} {
  return {
    generic_name: "",
    brand_names: "",
    drugClass: "",
    routes: ["oral"],
    minMgPerDose: "",
    maxMgPerDose: "",
    maxMgPerDay: "",
    frequency: "",
    onEssentialMedicinesList: true,
  };
}

/**
 * Self-service formulary management for an independent prescriber/pharmacist
 * (no institution — PortalSignupForm.tsx creates accounts with no
 * institution field at all). Institution-affiliated staff share a formulary
 * their Facility Admin manages instead (app/(app)/admin/formulary/page.tsx)
 * — this page exists specifically for practitioners who have no admin of
 * their own to do that for them. custom_drugs_insert_admin_or_independent
 * (0028_custom_drugs_institution_boundary.sql) is the real enforcement; the
 * role/institution check below is a friendly pre-check so an institution-
 * affiliated visitor sees an explanation instead of a confusing empty form.
 */
export default function MyFormularyPage() {
  const { user } = useAuth();
  const { data: formulary, isLoading } = useFormulary();
  const upsertDrug = useUpsertDrug();
  const deleteDrug = useDeleteDrug();

  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<Drug | null>(null);

  const isIndependentClinician = !!user && (user.role === "prescriber" || user.role === "pharmacist") && !user.institutionId;

  if (user && !isIndependentClinician) {
    return (
      <PageShell maxWidth="2xl" className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">My Formulary</h1>
        <Notice tone="neutral">
          {user.role === "admin"
            ? "Your facility's formulary is shared across your institution — manage it from Formulary Management instead."
            : "Your facility's formulary is managed by your institution's Facility Admin, and applies to your account automatically."}
        </Notice>
        {user.role === "admin" && (
          <Link href="/admin/formulary">
            <Button variant="secondary">Go to Formulary Management</Button>
          </Link>
        )}
      </PageShell>
    );
  }

  const drugs = (formulary?.drugs ?? [])
    .filter((d) => d.generic_name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.generic_name.localeCompare(b.generic_name));

  function handleAddDrug() {
    const min = Number(draft.minMgPerDose);
    const max = Number(draft.maxMgPerDose);
    const maxDay = Number(draft.maxMgPerDay);
    if (!draft.generic_name.trim() || !draft.drugClass.trim() || !min || !max || !maxDay) return;

    const drug: Drug = {
      id: generateId("drug"),
      generic_name: draft.generic_name.trim(),
      brand_names: draft.brand_names
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean),
      class: draft.drugClass.trim(),
      standard_dose_range: {
        minMgPerDose: min,
        maxMgPerDose: max,
        maxMgPerDay: maxDay,
        frequency: draft.frequency.trim() || "as directed",
        weightBased: false,
      },
      route: draft.routes,
      region_availability: ["GH"],
      onEssentialMedicinesList: draft.onEssentialMedicinesList,
    };

    upsertDrug.mutate(
      { drug, institutionId: null },
      {
        onSuccess: () => {
          setModalOpen(false);
          setDraft(emptyDraft());
        },
      }
    );
  }

  return (
    <PageShell maxWidth="4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Formulary</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formulary
              ? `${formulary.drugs.length} medicines available for your screening — the shared Ghana STG/EML base list, plus anything you've added below.`
              : "The base medicines list, plus anything you've added yourself."}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="size-5" aria-hidden="true" />
          Add Drug
        </Button>
      </div>

      <Notice tone="brand">
        Medicines you add here are visible only in your own screening — not shared with any other
        practitioner or institution on MediGuard.
      </Notice>

      <Input
        placeholder="Search formulary…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search formulary"
        className="max-w-sm"
      />

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      <div className="space-y-3">
        {drugs.map((drug) => (
          <Card key={drug.id}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">
                  {drug.generic_name}
                  {drug.brand_names.length > 0 && (
                    <span className="ml-1.5 font-normal text-subtle">
                      ({drug.brand_names.join(", ")})
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {drug.class} · {drug.standard_dose_range.minMgPerDose}–
                  {drug.standard_dose_range.maxMgPerDose}mg/dose, max{" "}
                  {drug.standard_dose_range.maxMgPerDay}mg/day · {drug.route.join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={drug.onEssentialMedicinesList ? "safe" : "caution"}>
                  {drug.onEssentialMedicinesList ? "On EML" : "Not on EML"}
                </Badge>
                {!BASE_DRUG_IDS.has(drug.id) && (
                  <>
                    <Badge tone="neutral">Added by you</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(drug)}
                      aria-label={`Remove ${drug.generic_name}`}
                      className="px-2 text-subtle hover:text-blocked-fg"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Add drug to your formulary"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDrug} disabled={upsertDrug.isPending}>
              Save drug
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Generic name *</label>
            <Input
              value={draft.generic_name}
              onChange={(e) => setDraft((d) => ({ ...d, generic_name: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Brand names (comma separated)</label>
            <Input
              value={draft.brand_names}
              onChange={(e) => setDraft((d) => ({ ...d, brand_names: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Therapeutic class *</label>
            <Input
              value={draft.drugClass}
              onChange={(e) => setDraft((d) => ({ ...d, drugClass: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Min dose (mg) *</label>
            <Input
              type="number"
              value={draft.minMgPerDose}
              onChange={(e) => setDraft((d) => ({ ...d, minMgPerDose: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Max dose (mg) *</label>
            <Input
              type="number"
              value={draft.maxMgPerDose}
              onChange={(e) => setDraft((d) => ({ ...d, maxMgPerDose: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Max daily dose (mg) *</label>
            <Input
              type="number"
              value={draft.maxMgPerDay}
              onChange={(e) => setDraft((d) => ({ ...d, maxMgPerDay: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Frequency description</label>
            <Input
              placeholder="e.g. every 8h"
              value={draft.frequency}
              onChange={(e) => setDraft((d) => ({ ...d, frequency: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-1.5 text-sm text-secondary">
              <Checkbox
                checked={draft.onEssentialMedicinesList}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, onEssentialMedicinesList: e.target.checked }))
                }
              />
              On Ghana Essential Medicines List
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Routes</label>
            <div className="flex flex-wrap gap-3">
              {ALL_ROUTES.map((r) => (
                <label key={r} className="flex items-center gap-1.5 text-sm text-secondary">
                  <Checkbox
                    checked={draft.routes.includes(r)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        routes: e.target.checked ? [...d.routes, r] : d.routes.filter((x) => x !== r),
                      }))
                    }
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove drug from your formulary"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteDrug.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteDrug.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
              }}
            >
              Remove drug
            </Button>
          </>
        }
      >
        <p className="text-sm text-secondary">
          Remove <span className="font-medium text-foreground">{deleteTarget?.generic_name}</span> from
          your formulary? It will no longer be screenable until re-added.
        </p>
      </Modal>
    </PageShell>
  );
}
