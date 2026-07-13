"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ScanLabelButtonProps {
  onTextExtracted: (text: string) => void;
}

/**
 * Upscales small photos and applies a grayscale contrast stretch before OCR.
 * Tesseract's accuracy on phone-camera photos (as opposed to flatbed scans)
 * degrades sharply on low-resolution or low-contrast shots — this is a real,
 * measurable improvement for both printed and handwritten text. It does not
 * make Tesseract a trained handwriting-recognition model: reliably reading
 * arbitrary cursive handwriting is an unsolved problem for general-purpose
 * OCR engines like this one, which is why the extracted text only ever seeds
 * a fuzzy search for the patient to confirm rather than being trusted directly.
 */
async function preprocessForOcr(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(2, 1600 / Math.max(bitmap.width, bitmap.height)) || 1;
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const contrasted = gray < 140 ? Math.max(0, gray - 30) : Math.min(255, gray + 30);
    data[i] = data[i + 1] = data[i + 2] = contrasted;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
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
      const image = await preprocessForOcr(file);
      const result = await recognize(image, "eng");
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
        Works best on a printed label or typed prescription — we&rsquo;ll read the photo and suggest
        matches for you to confirm. Handwritten notes are harder to read reliably, so double-check the
        match carefully if yours is handwritten.
      </p>
    </div>
  );
}
