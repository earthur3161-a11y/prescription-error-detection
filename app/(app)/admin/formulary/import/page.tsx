"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileUp, Loader2, Upload } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { PageShell } from "@/components/layout/PageShell";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useBulkUpsertDrugs } from "@/lib/query/hooks/useDrugMutations";
import { useAuth } from "@/lib/auth/useAuth";
import { parseDrugCsv, CSV_TEMPLATE_EXAMPLE, type DrugImportResult } from "@/lib/formulary/csvImport";

export default function FormularyImportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: formulary } = useFormulary();
  const bulkUpsert = useBulkUpsertDrugs();

  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<DrugImportResult | null>(null);
  const [published, setPublished] = useState(false);

  const existingDrugs = useMemo(() => formulary?.drugs ?? [], [formulary]);

  function handleValidate() {
    setPublished(false);
    setResult(parseDrugCsv(csvText, existingDrugs));
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvText(text);
      setResult(parseDrugCsv(text, existingDrugs));
      setPublished(false);
    };
    reader.readAsText(file);
  }

  function handlePublish() {
    if (!result || result.toPublish.length === 0) return;
    bulkUpsert.mutate(
      { drugs: result.toPublish, institutionId: user?.institutionId ?? null },
      { onSuccess: () => setPublished(true) }
    );
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE_EXAMPLE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mediguard-drug-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageShell>
      <button
        onClick={() => router.push("/admin/formulary")}
        className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to formulary
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Bulk-import medicines</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Load a comprehensive Ghana medicines dataset (e.g. a Ghana FDA registered-products export)
          from CSV. Rows are validated and de-duplicated by generic name, then reviewed here before
          anything is published to the live formulary.
        </p>
      </div>

      <Notice tone="caution" title="Sourcing note">
        The built-in list is an illustrative demo set, not the authoritative Ghana FDA database.
        Supply a verified export to load the complete medicines list — dosing should be
        clinician-verified before real-world use.
      </Notice>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-foreground">1. Provide CSV</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                <Download className="size-4" aria-hidden="true" />
                Template
              </Button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border-strong px-3 py-1.5 text-sm font-medium text-secondary hover:bg-surface-2">
                <FileUp className="size-4" aria-hidden="true" />
                Upload file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={10}
            spellCheck={false}
            placeholder={CSV_TEMPLATE_EXAMPLE}
            className="w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <Button onClick={handleValidate} disabled={!csvText.trim()}>
            <Upload className="size-4" aria-hidden="true" />
            Validate &amp; preview
          </Button>
        </CardBody>
      </Card>

      {result && (
        <Card>
          <CardBody className="space-y-4">
            <h2 className="font-semibold text-foreground">2. Review before publishing</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-safe-bg px-3 py-2 text-sm">
                <p className="text-2xl font-semibold tabular-nums text-safe-fg">{result.toPublish.length}</p>
                <p className="text-secondary">ready to publish</p>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                <p className="text-2xl font-semibold tabular-nums text-secondary">{result.duplicates.length}</p>
                <p className="text-secondary">duplicates skipped</p>
              </div>
              <div className="rounded-lg bg-blocked-bg px-3 py-2 text-sm">
                <p className="text-2xl font-semibold tabular-nums text-blocked-fg">{result.errors.length}</p>
                <p className="text-secondary">rows with errors</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-blocked-fg">
                  <AlertTriangle className="size-4" aria-hidden="true" /> Errors (not imported)
                </p>
                <ul className="stagger space-y-1 text-sm text-secondary">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.duplicates.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-secondary">Duplicates skipped</p>
                <div className="stagger flex flex-wrap gap-1.5">
                  {result.duplicates.map((d, i) => (
                    <Badge key={i} tone="neutral" title={d.reason}>
                      {d.generic_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.toPublish.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-secondary">Ready to publish</p>
                <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wide text-subtle">
                      <tr>
                        <th className="px-3 py-2">Generic</th>
                        <th className="px-3 py-2">Class</th>
                        <th className="px-3 py-2">EML</th>
                      </tr>
                    </thead>
                    <tbody className="stagger divide-y divide-border">
                      {result.toPublish.map((d) => (
                        <tr key={d.id}>
                          <td className="px-3 py-2 font-medium text-foreground">{d.generic_name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{d.class}</td>
                          <td className="px-3 py-2">
                            <Badge tone={d.onEssentialMedicinesList ? "safe" : "caution"}>
                              {d.onEssentialMedicinesList ? "On EML" : "Not on EML"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {published ? (
              <p className="flex items-center gap-2 text-sm font-medium text-safe-fg">
                <CheckCircle2 className="size-5" aria-hidden="true" />
                Published to the live formulary. It&rsquo;s now searchable across all surfaces.
              </p>
            ) : (
              <Button
                onClick={handlePublish}
                disabled={result.toPublish.length === 0 || bulkUpsert.isPending}
              >
                {bulkUpsert.isPending ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                )}
                {bulkUpsert.isPending
                  ? "Publishing…"
                  : `Publish ${result.toPublish.length} drug${result.toPublish.length === 1 ? "" : "s"}`}
              </Button>
            )}
          </CardBody>
        </Card>
      )}
    </PageShell>
  );
}
