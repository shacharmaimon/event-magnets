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

// Printer-bleed safety margin. The DNP DS-RX1HS + hand-cut shaves ~1–2mm off
// the edges. We add a thin sacrificial ring (a slightly-zoomed copy of the same
// image) that reaches the physical edge, and inset the crisp magnet by this
// much, so a cut drifting up to ~2mm eats only the ring — the real frame border
// survives. Tunable: at 300 DPI, 2mm = 300 * 2 / 25.4 ≈ 24px. Output dimensions
// are unchanged (still exactly W×H).
const BLEED_MM = 2;
const BLEED_PX = Math.round((300 * BLEED_MM) / 25.4);

/**
 * Composite a raw photo under a frame overlay into a finished magnet JPEG.
 *
 * Pipeline: force the frame to the exact target size, then apply EXIF rotation,
 * optional horizontal mirror (selfie fix), center-crop cover to target, overlay
 * the frame, and finally wrap in the printer-bleed ring. Returns the finished
 * JPEG buffer at exactly the magnet dimensions for the given orientation.
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
  // the frame. Kept as a lossless PNG intermediate so the bleed step below
  // doesn't double-compress.
  const magnet = await sharp(rawBytes, { failOn: "none" })
    .rotate()
    .flop(Boolean(opts.mirrored))
    .resize(W, H, { fit: "cover", position: "center" })
    .composite([{ input: frameBuf, top: 0, left: 0 }])
    .png()
    .toBuffer();

  // Printer-bleed wrap. bleedBase is the magnet zoomed to fill the full W×H — a
  // sacrificial ring whose frame border reaches the physical edge. inset is the
  // crisp full magnet, shrunk and centered so the cut can eat the ring without
  // touching the real border. Result stays exactly W×H.
  if (BLEED_PX <= 0) {
    return sharp(magnet)
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();
  }
  const bleedBase = await sharp(magnet)
    .resize(W + 2 * BLEED_PX, H + 2 * BLEED_PX, { fit: "fill" })
    .extract({ left: BLEED_PX, top: BLEED_PX, width: W, height: H })
    .toBuffer();
  const inset = await sharp(magnet)
    .resize(W - 2 * BLEED_PX, H - 2 * BLEED_PX, { fit: "fill" })
    .toBuffer();
  return sharp(bleedBase)
    .composite([{ input: inset, top: BLEED_PX, left: BLEED_PX }])
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
}
