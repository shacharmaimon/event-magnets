"use client";

import type { FrameWindow, Orientation } from "@/lib/types";

// Renders the guest photo with a transparent frame PNG overlaid on top, locked
// to the frame's aspect ratio (4:3 landscape / 3:4 portrait).
//
// Two modes, matching the server compositor (src/lib/composite.ts) exactly so
// what the guest frames is what prints:
// - With `window` (the frame's detected opening): the photo is cover-cropped to
//   fill the opening rectangle exactly (no bars, no blur). The frame sits around
//   it, and the border trims whatever doesn't fit.
// - Without a window: the photo covers the whole magnet and the frame overlays
//   it (legacy behavior).
export default function FramedPhoto({
  photoUrl,
  frameUrl,
  orientation,
  mirrored = false,
  window = null,
}: {
  photoUrl: string;
  frameUrl: string;
  orientation: Orientation;
  mirrored?: boolean;
  window?: FrameWindow | null;
}) {
  const aspect = orientation === "landscape" ? "aspect-[4/3]" : "aspect-[3/4]";
  const mirrorStyle = mirrored ? { transform: "scaleX(-1)" } : undefined;

  return (
    <div
      className={`relative mx-auto w-full max-w-sm overflow-hidden rounded-xl ${aspect} bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px]`}
    >
      {window ? (
        // Photo cover-cropped to fill the frame's opening (as % of canvas).
        <div
          className="absolute overflow-hidden"
          style={{
            left: `${window.x * 100}%`,
            top: `${window.y * 100}%`,
            width: `${window.w * 100}%`,
            height: `${window.h * 100}%`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={mirrorStyle}
          />
        </div>
      ) : (
        // Legacy: photo covers the whole magnet.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={mirrorStyle}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frameUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}
