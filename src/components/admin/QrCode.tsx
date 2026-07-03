"use client";

import QRCode from "react-qr-code";

// A crisp, scalable QR code (SVG). Wrapped in a white padded box because QR
// scanners need a light "quiet zone" around the code, even in dark mode.
export default function QrCode({ value }: { value: string }) {
  return (
    <div className="inline-block rounded-lg bg-white p-4">
      <QRCode value={value} size={180} />
    </div>
  );
}
