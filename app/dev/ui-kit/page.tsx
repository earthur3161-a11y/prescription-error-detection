"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Combobox } from "@/components/ui/Combobox";
import { useToastStore } from "@/lib/store/toast-store";

const fruits = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];

export default function UiKitPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const showToast = useToastStore((s) => s.show);

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-8">
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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Verdict Badges</h2>
        <div className="flex flex-wrap gap-3">
          <VerdictBadge verdict="safe" />
          <VerdictBadge verdict="caution" />
          <VerdictBadge verdict="blocked" />
          <VerdictBadge verdict="safe" size="lg" />
          <VerdictBadge verdict="caution" size="sm" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Badges</h2>
        <div className="flex flex-wrap gap-3">
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="brand">Brand</Badge>
        </div>
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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Skeleton</h2>
        <div className="max-w-sm space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
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
