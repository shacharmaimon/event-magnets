"use client";

import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QRCode from "react-qr-code";
import { labels } from "@/lib/labels";

// Generates a print-ready 4x6" (10x15cm @ 300 DPI) portrait PNG the admin can
// print on the DNP and stand at the event: event title, a hero QR to the guest
// link, and the three "how it works" steps as an emoji row.
//
// Drawn entirely in the BROWSER on a <canvas>, on purpose: the Hebrew Heebo font
// is only loaded client-side, so server-rendering the text would produce tofu
// boxes. Here the real font is available. No server route, no new dependency.

const W = 1200;
const H = 1800;
const QR_PX = 720; // hero QR drawn size on the canvas

// Load an SVG markup string into an <img> so we can drawImage it onto canvas.
function loadSvg(svg: string): Promise<HTMLImageElement> {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("svg_load"));
    };
    img.src = url;
  });
}

export default function PrintableQrButton({
  slug,
  welcomeHeading,
  eventName,
}: {
  slug: string;
  welcomeHeading: string;
  eventName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const guestUrl = `${base}/e/${slug}`;
  const title = welcomeHeading?.trim() || eventName || labels.site.title;

  async function generate() {
    setBusy(true);
    setError("");
    try {
      // Make sure Heebo is actually ready before we paint text to the canvas.
      if (document.fonts?.ready) await document.fonts.ready;
      try {
        await document.fonts.load("700 64px Heebo");
        await document.fonts.load("500 40px Heebo");
      } catch {
        /* fall back to default font if Heebo can't preload */
      }

      // Render the QR (high error-correction via the lib default) to an SVG
      // string, with a white quiet-zone margin baked in for print scanning.
      const svg = renderToStaticMarkup(
        <QRCode value={guestUrl} size={QR_PX} level="H" />,
      );
      const qrImg = await loadSvg(svg);

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no_ctx");

      // Background — soft warm tint.
      ctx.fillStyle = "#fffdf7";
      ctx.fillRect(0, 0, W, H);
      // Thin amber frame border.
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 10;
      ctx.strokeRect(24, 24, W - 48, H - 48);

      ctx.textAlign = "center";
      ctx.direction = "rtl";
      ctx.fillStyle = "#18181b";

      // Title (wrap to two lines if long).
      ctx.font = "700 78px Heebo, sans-serif";
      wrapText(ctx, title, W / 2, 190, W - 200, 92);

      // Hero QR — centered, on a white card with padding (the quiet zone).
      const qrCard = QR_PX + 80;
      const qrX = (W - qrCard) / 2;
      const qrY = 340;
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, qrX, qrY, qrCard, qrCard, 28);
      ctx.fill();
      ctx.drawImage(qrImg, qrX + 40, qrY + 40, QR_PX, QR_PX);

      // Scan caption under the QR.
      ctx.fillStyle = "#b45309";
      ctx.font = "700 56px Heebo, sans-serif";
      ctx.fillText(labels.qrPage.scanToStart, W / 2, qrY + qrCard + 90);

      // Steps row: emoji + label, three columns near the bottom.
      const steps = [
        { icon: "📸", label: labels.qrPage.step1 },
        { icon: "🎨", label: labels.qrPage.step2 },
        { icon: "🧲", label: labels.qrPage.step3 },
      ];
      const rowY = 1560;
      const colW = W / 3;
      ctx.fillStyle = "#3f3f46";
      steps.forEach((s, i) => {
        const cx = colW * i + colW / 2;
        ctx.font = "400 110px sans-serif"; // emoji via system font
        ctx.fillText(s.icon, cx, rowY);
        ctx.font = "500 48px Heebo, sans-serif";
        ctx.fillText(s.label, cx, rowY + 90);
      });

      // Export as PNG and trigger download.
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!blob) throw new Error("no_blob");
      const safeName = (eventName || "event").replace(/[^\p{L}\p{N}_-]+/gu, "_");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}-qr.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(labels.qrPage.error);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={generate}
        disabled={busy}
        className="self-start rounded-lg border border-amber-400 px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
      >
        {busy ? labels.qrPage.preparing : `🖨️ ${labels.qrPage.downloadButton}`}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

// Draw center-aligned text, wrapping onto multiple lines within maxWidth.
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  // Only keep two lines max to protect the layout.
  const shown = lines.slice(0, 2);
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

// Rounded-rectangle path helper (canvas has no built-in for older targets).
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
