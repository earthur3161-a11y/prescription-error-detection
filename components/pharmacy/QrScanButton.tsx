"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface QrScanButtonProps {
  onResult: (text: string) => void;
}

// BarcodeDetector isn't in the TS DOM lib yet.
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
}

/**
 * Scans a prescription/share QR with the device camera using the native
 * BarcodeDetector where available. This is the fastest intake path (no typing);
 * if the API or camera isn't available it degrades to a clear message so the
 * pharmacist can paste the code instead.
 */
export function QrScanButton({ onResult }: QrScanButtonProps) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }

  async function start() {
    setError(null);
    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Ctor) {
      setError("This device/browser can't scan QR codes here — paste the code below instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setActive(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const detector = new Ctor({ formats: ["qr_code"] });
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            onResult(codes[0].rawValue);
            stop();
            return;
          }
        } catch {
          /* transient detect errors are fine; keep scanning */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("Couldn't access the camera — paste the code below instead.");
      stop();
    }
  }

  return (
    <div>
      {active ? (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-border bg-black">
            <video ref={videoRef} className="mx-auto max-h-64 w-full object-contain" />
            <button
              onClick={stop}
              aria-label="Stop scanning"
              className="absolute right-2 top-2 grid size-11 place-items-center rounded-lg bg-white/90 text-secondary"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Point the camera at the prescription QR code…
          </p>
        </div>
      ) : (
        <Button type="button" variant="secondary" className="w-full" onClick={start}>
          <Camera className="size-5" aria-hidden="true" />
          Scan prescription QR
        </Button>
      )}
      {error && <p className="mt-1.5 text-sm text-caution-fg">{error}</p>}
    </div>
  );
}
