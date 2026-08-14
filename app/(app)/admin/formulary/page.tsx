"use client";

import { useState } from "react";
import Link from "next/link";
import { FileUp, Pill, Plus, Trash2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { PageShell } from "@/components/layout/PageShell";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useDeleteDrug, useUpsertDrug } from "@/lib/query/hooks/useDrugMutations";
import { useAuth } from "@/lib/auth/useAuth";
import { generateId } from "@/lib/utils/id";
import { DEFAULT_REGION, getBaseFormularyBundle } from "@/lib/formulary";
import type { Drug, Route } from "@/lib/types";

// The base Ghana STG/EML formulary is code-committed and immutable via this
// page by design (see 0026_custom_drugs.sql's header) — this Set is how the
// UI tells a base drug apart from an admin-added one, so the delete
// affordance below only ever appears for something this page can actually
// remove.
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

export default function AdminFormularyPage() {
  const { user } = useAuth();
  const { data: formulary, isLoading } = useFormulary();
  const upsertDrug = useUpsertDrug();
  const deleteDrug = useDeleteDrug();

  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Drug | null>(null);

  const drugs = (formulary?.drugs ?? [])
    .filter((d) => d.generic_name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.generic_name.localeCompare(b.generic_name));

  function handleAddDrug() {
    setAddError(null);
    const min = Number(draft.minMgPerDose);
    const max = Number(draft.maxMgPerDose);
    const maxDay = Number(draft.maxMgPerDay);
    if (!draft.generic_name.trim() || !draft.drugClass.trim() || !min || !max || !maxDay) {
      setAddError("Fill in generic name, therapeutic class, and all three dose fields before saving.");
      return;
    }

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
      { drug, institutionId: user?.institutionId ?? null },
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
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Pill className="size-6 text-brand" aria-hidden="true" />
            Formulary Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formulary
              ? `${formulary.drugs.length} medicines in the database used by the screening engine. EML status is a tag, not a filter.`
              : "Manage the drug list used by the screening engine."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/formulary/import">
            <Button variant="secondary">
              <FileUp className="size-5" aria-hidden="true" />
              Bulk import
            </Button>
          </Link>
          <Button
            onClick={() => {
              setAddError(null);
              setModalOpen(true);
            }}
          >
            <Plus className="size-5" aria-hidden="true" />
            Add Drug
          </Button>
        </div>
      </div>

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

      <div className="stagger space-y-3">
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
                <Badge tone="neutral">{drug.region_availability.join(", ")}</Badge>
                {!BASE_DRUG_IDS.has(drug.id) && (
                  <>
                    <Badge tone="neutral">Admin-added</Badge>
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
        title="Add drug to formulary"
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
          {addError && (
            <div className="sm:col-span-2">
              <Notice tone="blocked" role="alert">
                {addError}
              </Notice>
            </div>
          )}
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
        title="Remove drug from formulary"
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
          the formulary? It will no longer be screenable until re-added.
        </p>
      </Modal>
    </PageShell>
  );
}
