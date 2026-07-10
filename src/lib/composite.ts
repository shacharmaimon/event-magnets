import sharp from "sharp";
import type { Orientation } from "@/lib/types";

// Single source of truth for turning a raw photo + a frame PNG into a
// print-ready magnet JPEG. Used by BOTH the guest submit route and the admin
// bulk-upload route, so a phone photo and a camera photo produce identical
// output — and the printer-bleed logic lives in exactly one place.

// Magnet print dimensions at 300 DPI (4x3"): landscape 1200x900, portrait
// 900x1200. The frame PNGs are authored at these sizes.
export function magnetSize(orientation: Orientation): [number, number] {
  return orientation === "landscape" ? [1200, 900] : [900, 1200];
}

/**
 * Composite a raw photo under a frame overlay into a finished magnet JPEG.
 *
 * Pipeline: force the frame to the exact target size, then apply EXIF rotation,
 * optional horizontal mirror (selfie fix), center-crop cover to target, and
 * overlay the frame. Returns the finished JPEG buffer at exactly the magnet
 * dimensions for the given orientation.
 *
 * NOTE: no printer-bleed ring — the finished image matches the frame edge-to-
 * edge, so it looks identical in the album and the live preview. Edge safety on
 * the DNP is handled by authoring frames a bit thicker and keeping text off the
 * very edge.
 *
 * Throws if the raw bytes aren't a decodable image (callers map to a 400).
 */
export async function compositeMagnet(
  rawBytes: Buffer,
  frameBytes: Buffer,
  orientation: Orientation,
  opts: { mirrored?: boolean } = {},
): Promise<Buffer> {
  const [W, H] = magnetSize(orientation);

  // Force the frame to exact target dimensions (authored at size; safe).
  const frameBuf = await sharp(frameBytes)
    .resize(W, H, { fit: "fill" })
    .png()
    .toBuffer();

  // Photo: EXIF rotate, optional mirror, center-crop cover to target, overlay
  // the frame, encode JPEG.
  return sharp(rawBytes, { failOn: "none" })
    .rotate()
    .flop(Boolean(opts.mirrored))
    .resize(W, H, { fit: "cover", position: "center" })
    .composite([{ input: frameBuf, top: 0, left: 0 }])
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
}
