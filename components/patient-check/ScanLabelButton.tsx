"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ScanLabelButtonProps {
  onTextExtracted: (text: string) => void;
}

/**
 * Captures a photo of a prescription/label and runs it through client-side
 * OCR (tesseract.js, lazy-loaded only when this button is used — it's a
 * multi-MB dependency and must never sit in the initial bundle). The raw
 * extracted text seeds the drug search box; it is never auto-added as a
 * confirmed drug, since OCR on a photographed label is not reliable enough
 * to trust blindly for a safety-critical check.
 */
export function ScanLabelButton({ onTextExtracted }: ScanLabelButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "error">("idle");

  async function handleFile(file: File) {
    setStatus("reading");
    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(file, "eng");
      const text = result.data.text.trim();
      setStatus("idle");
      if (text) {
        // Labels are noisy; take the longest word-ish token as the best guess seed.
        const bestGuess = text
          .split(/\s+/)
          .filter((w) => /^[A-Za-z]{4,}$/.test(w))
          .sort((a, b) => b.length - a.length)[0];
        onTextExtracted(bestGuess ?? text.split(/\s+/)[0] ?? "");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={status === "reading"}
        onClick={() => inputRef.current?.click()}
      >
        {status === "reading" ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            Reading label…
          </>
        ) : (
          <>
            <Camera className="size-5" aria-hidden="true" />
            Scan a label or prescription photo
          </>
        )}
      </Button>
      {status === "error" && (
        <p className="mt-1.5 text-sm text-blocked-fg">
          Couldn&rsquo;t read that photo — try typing the medicine name instead.
        </p>
      )}
      <p className="mt-1.5 text-xs text-subtle">
        We&rsquo;ll read the photo and suggest matches — you&rsquo;ll confirm the right one.
      </p>
    </div>
  );
}
