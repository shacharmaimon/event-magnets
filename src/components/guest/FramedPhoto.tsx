"use client";

import type { Orientation } from "@/lib/types";

// Renders the guest photo with a transparent frame PNG overlaid on top, locked
// to the frame's aspect ratio (4:3 landscape / 3:4 portrait).
//
// IMPORTANT (Phase 6 seam): the photo uses object-cover = center-crop to the
// frame aspect. Phase 6's sharp composite MUST replicate this exact crop
// (resize with fit:"cover", position:"center") so the printed magnet matches
// what the guest sees here.
export default function FramedPhoto({
  photoUrl,
  frameUrl,
  orientation,
  mirrored = false,
}: {
  photoUrl: string;
  frameUrl: string;
  orientation: Orientation;
  mirrored?: boolean;
}) {
  const aspect = orientation === "landscape" ? "aspect-[4/3]" : "aspect-[3/4]";

  return (
    <div
      className={`relative mx-auto w-full max-w-sm overflow-hidden rounded-xl ${aspect} bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px]`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={mirrored ? { transform: "scaleX(-1)" } : undefined}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frameUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}
