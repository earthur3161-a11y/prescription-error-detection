"use client";

import { useEffect, useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

interface ShareResultPanelProps {
  shareToken: string;
}

export function ShareResultPanel({ shareToken }: ShareResultPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/check/shared/${shareToken}` : "";

  useEffect(() => {
    if (!shareUrl) return;
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(shareUrl, { width: 200, margin: 1 }).then(setQrDataUrl);
    });
  }, [shareUrl]);

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <QrCode className="size-5 text-patient" aria-hidden="true" />
            Show this to your pharmacist
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Let them scan this code, or send them the link — they&rsquo;ll see the full details.
          </p>
        </div>
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR code linking to this result" className="mx-auto size-40" />
        )}
        <Button variant="secondary" className="w-full" onClick={handleCopy}>
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "Link copied" : "Copy link"}
        </Button>
      </CardBody>
    </Card>
  );
}
