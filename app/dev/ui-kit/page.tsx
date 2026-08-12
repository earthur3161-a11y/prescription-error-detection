"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { FlagSeverityChip } from "@/components/ui/FlagSeverityChip";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { Select } from "@/components/ui/Select";
import { Skeleton, FindingsPanelSkeleton, ListRowSkeleton, StatCardSkeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { Combobox } from "@/components/ui/Combobox";
import { useToastStore } from "@/lib/store/toast-store";
import type { Flag } from "@/lib/screening-engine";

const fruits = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];

function flag(overrides: Partial<Flag>): Flag {
  return {
    type: "data_incomplete",
    code: "DEMO",
    severity: "minor",
    message: "Demo flag",
    audience_variant: { clinical: "Demo flag", patient: "Demo flag" },
    ...overrides,
  };
}

const REAL_CAUTION: Flag[] = [flag({ severity: "moderate", message: "Dose exceeds standard range." })];
const UNKNOWN_ONLY: Flag[] = [flag({ severity: "unknown", message: "Renal status not on file." })];
const MIXED: Flag[] = [
  flag({ severity: "moderate", message: "Dose exceeds standard range." }),
  flag({ severity: "unknown", message: "Renal status not on file." }),
];
const REAL_BLOCKED: Flag[] = [flag({ severity: "severe", message: "Severe interaction with active therapy." })];

export default function UiKitPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [switchOn, setSwitchOn] = useState(false);
  const showToast = useToastStore((s) => s.show);

  return (
    <div className="stagger mx-auto max-w-4xl space-y-10 p-8">
      <h1 className="text-2xl font-semibold text-foreground">Design System Preview</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Verdict Marks — three sizes
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <VerdictMark verdict="safe" size="chip" />
          <VerdictMark verdict="caution" flags={REAL_CAUTION} size="chip" />
          <VerdictMark verdict="blocked" flags={REAL_BLOCKED} size="chip" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <VerdictMark verdict="safe" size="badge" />
          <VerdictMark verdict="caution" flags={REAL_CAUTION} size="badge" />
          <VerdictMark verdict="blocked" flags={REAL_BLOCKED} size="badge" />
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <VerdictMark verdict="safe" size="seal" />
          <VerdictMark verdict="caution" flags={REAL_CAUTION} size="seal" />
          <VerdictMark verdict="blocked" flags={REAL_BLOCKED} size="seal" />
        </div>

        <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-subtle">
          Verdict basis — same &ldquo;caution&rdquo; verdict, three real reasons behind it
        </h3>
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <VerdictMark verdict="caution" flags={REAL_CAUTION} size="badge" />
            <p className="text-xs text-subtle">confirmed — a real finding</p>
          </div>
          <div className="space-y-1">
            <VerdictMark verdict="caution" flags={UNKNOWN_ONLY} size="badge" />
            <p className="text-xs text-subtle">unknown-only — nothing confirmed wrong, just unchecked</p>
          </div>
          <div className="space-y-1">
            <VerdictMark verdict="caution" flags={MIXED} size="badge" />
            <p className="text-xs text-subtle">mixed — a real finding, plus unverified data too</p>
          </div>
        </div>

        <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-subtle">Flag severity chips</h3>
        <div className="flex flex-wrap gap-2">
          <FlagSeverityChip severity="minor" />
          <FlagSeverityChip severity="moderate" />
          <FlagSeverityChip severity="major" />
          <FlagSeverityChip severity="severe" />
          <FlagSeverityChip severity="unknown" />
          <FlagSeverityChip severity="none" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Badges</h2>
        <div className="flex flex-wrap gap-3">
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="brand">Brand</Badge>
          <Badge tone="safe">Safe</Badge>
          <Badge tone="caution">Caution</Badge>
          <Badge tone="blocked">Blocked</Badge>
          <Badge tone="unknown">Unknown</Badge>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notices</h2>
        <div className="space-y-2">
          <Notice tone="neutral">Neutral notice — general information.</Notice>
          <Notice tone="brand">Brand notice — a MediGuard-specific callout.</Notice>
          <Notice tone="safe">Safe notice — confirmed, no action needed.</Notice>
          <Notice tone="caution" title="Caution notice">With an optional title, like this one.</Notice>
          <Notice tone="blocked" role="alert">Blocked notice — used for errors, with role=&quot;alert&quot; so it&rsquo;s announced immediately.</Notice>
          <Notice tone="unknown">Unknown notice — data is missing, not confirmed either way.</Notice>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Switch</h2>
        <Switch checked={switchOn} onCheckedChange={setSwitchOn} aria-label="Demo switch" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Card</h2>
        <Card className="max-w-sm">
          <CardHeader>
            <h3 className="font-semibold text-foreground">Card title</h3>
          </CardHeader>
          <CardBody className="text-sm text-secondary">Card body content goes here.</CardBody>
          <CardFooter>
            <Button size="sm">Action</Button>
          </CardFooter>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Form controls</h2>
        <div className="max-w-sm space-y-3">
          <Input placeholder="Text input" />
          <Select defaultValue="">
            <option value="" disabled>
              Select an option
            </option>
            <option value="a">Option A</option>
            <option value="b">Option B</option>
          </Select>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Combobox</h2>
        <div className="max-w-sm">
          <Combobox
            items={fruits.filter((f) => f.toLowerCase().includes(query.toLowerCase()))}
            getKey={(f) => f}
            getLabel={(f) => f}
            query={query}
            onQueryChange={setQuery}
            onSelect={(f) => showToast({ title: `Selected ${f}`, variant: "default" })}
            placeholder="Search fruit…"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Skeleton — shape-matched to the content it precedes, not a generic gray box
        </h2>
        <div className="max-w-sm space-y-2">
          <p className="text-xs text-subtle">Bare primitive</p>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="max-w-sm space-y-2">
          <p className="text-xs text-subtle">ListRowSkeleton</p>
          <ListRowSkeleton count={2} />
        </div>
        <div className="max-w-sm space-y-2">
          <p className="text-xs text-subtle">StatCardSkeleton</p>
          <StatCardSkeleton />
        </div>
        <div className="max-w-sm space-y-2">
          <p className="text-xs text-subtle">FindingsPanelSkeleton</p>
          <FindingsPanelSkeleton />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Modal & Toast</h2>
        <div className="flex gap-3">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button
            variant="secondary"
            onClick={() =>
              showToast({ title: "Override logged", description: "Recorded in audit trail.", variant: "warning" })
            }
          >
            Fire toast
          </Button>
        </div>
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Example Modal"
          description="This is a description of the modal."
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Confirm</Button>
            </>
          }
        >
          <p className="text-sm text-secondary">Modal body content.</p>
        </Modal>
      </section>
    </div>
  );
}
