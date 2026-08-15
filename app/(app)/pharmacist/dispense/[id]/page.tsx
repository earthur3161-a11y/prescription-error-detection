"use client";

import { use } from "react";
import { DispenseFlow } from "@/components/pharmacy/DispenseFlow";

export default function DispensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DispenseFlow id={id} backHref={`/pharmacist/review/${id}`} backTarget="review" />;
}
