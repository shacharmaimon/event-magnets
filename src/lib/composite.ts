import sharp from "sharp";
import type { Orientation } from "@/lib/types";

// Single source of truth for turning a raw photo + a frame PNG into a
// print-ready magnet JPEG. Used by BOTH the guest submit route and the admin
// bulk-upload route, so a phone photo and a camera photo produce identical
// output.

// Magnet print dimensions at 300 DPI (4x3"): landscape 1200x900, portrait
// 900x1200. The frame PNGs are authored at these sizes.
export function magnetSize(orientation: Orientation): [number, number] {
  return orientation === "landscape" ? [1200, 900] : [900, 1200];
}

/** A frame's transparent opening as fractions (0..1) of the frame's WxH. */
export interface FrameWindow {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ALPHA_TRANSPARENT = 16; // alpha below this counts as "see-through"
const ROW_COL_FRACTION = 0.5; // a row/col is part of the opening if >50% clear

/**
 * Detect the frame's transparent opening (the hole the photo shows through).
 * Returns the bounding rectangle of the see-through area as fractions of the
 * frame dimensions, or null if the frame has no meaningful transparent region
 * (a fully opaque image) — callers then fall back to the legacy cover behavior.
 *
 * Method: downscale for speed, read the alpha channel, and mark each row/column
 * that is majority-transparent. The opening is the min/max extent of those rows
 * and columns. Using a majority test (not "any transparent pixel") ignores
 * antialiased edges and small decorative nicks, and assumes a single central
 * opening — true for every real frame (a bordered window, often with a bottom
 * banner so the opening is not vertically centered).
 */
export async function detectWindow(
  frameBytes: Buffer,
): Promise<FrameWindow | null> {
  // Downscale to keep this cheap; alpha bounds scale fine.
  const target = 200;
  const { data, info } = await sharp(frameBytes)
    .ensureAlpha()
    .resize(target, target, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: W, height: H, channels } = info;
  const aOff = channels - 1; // alpha is the last channel

  const rowClear = new Array<number>(H).fill(0);
  const colClear = new Array<number>(W).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * channels + aOff];
      if (a < ALPHA_TRANSPARENT) {
        rowClear[y]++;
        colClear[x]++;
      }
    }
  }

  const rowThresh = W * ROW_COL_FRACTION;
  const colThresh = H * ROW_COL_FRACTION;
  let minX = W,
    maxX = -1,
    minY = H,
    maxY = -1;
  for (let y = 0; y < H; y++) {
    if (rowClear[y] > rowThresh) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  for (let x = 0; x < W; x++) {
    if (colClear[x] > colThresh) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }

  // No majority-transparent rows/cols → no usable opening.
  if (maxX < minX || maxY < minY) return null;

  const win = {
    x: minX / W,
    y: minY / H,
    w: (maxX - minX + 1) / W,
    h: (maxY - minY + 1) / H,
  };
  // Guard against a degenerate sliver (e.g. a 1px transparent line).
  if (win.w < 0.1 || win.h < 0.1) return null;
  return win;
}

/**
 * Composite a raw photo with a frame overlay into a finished magnet JPEG.
 *
 * Two modes:
 * - With `opts.window` (the frame's transparent opening): the photo is
 *   cover-cropped to fill EXACTLY the opening rectangle and the frame sits
 *   around it. This crops once (into the window) instead of the old
 *   crop-to-magnet-then-cover-with-frame, so no content is hidden under the
 *   border/banner and there are no bars or blur to fill — the photo fills the
 *   opening cleanly.
 * - Without a window (legacy / opaque frames): the photo is cover-cropped to the
 *   full magnet and the frame is laid on top (original behavior).
 *
 * Output is always exactly the magnet dimensions for the orientation.
 * Throws if the raw bytes aren't a decodable image (callers map to a 400).
 */
export async function compositeMagnet(
  rawBytes: Buffer,
  frameBytes: Buffer,
  orientation: Orientation,
  opts: { mirrored?: boolean; window?: FrameWindow | null } = {},
): Promise<Buffer> {
  const [W, H] = magnetSize(orientation);

  // Force the frame to exact target dimensions (authored at size; safe).
  const frameBuf = await sharp(frameBytes)
    .resize(W, H, { fit: "fill" })
    .png()
    .toBuffer();

  // Upright + mirror-corrected photo, as a lossless intermediate.
  const photo = await sharp(rawBytes, { failOn: "none" })
    .rotate()
    .flop(Boolean(opts.mirrored))
    .png()
    .toBuffer();

  const win = opts.window ?? null;

  if (!win) {
    // Legacy path: cover-crop the photo to fill the magnet, frame on top.
    return sharp(photo)
      .resize(W, H, { fit: "cover", position: "center" })
      .composite([{ input: frameBuf, top: 0, left: 0 }])
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();
  }

  // Window rect in pixels (clamped to the canvas).
  const wx = Math.max(0, Math.round(win.x * W));
  const wy = Math.max(0, Math.round(win.y * H));
  const ww = Math.min(W - wx, Math.round(win.w * W));
  const wh = Math.min(H - wy, Math.round(win.h * H));

  // Cover-crop the photo to fill the opening exactly (crop once, into the
  // window). No bars, no blur — the frame border trims whatever doesn't fit.
  const windowContent = await sharp(photo)
    .resize(ww, wh, { fit: "cover", position: "center" })
    .toBuffer();

  // Base → place the photo at the opening → frame on top → flatten on white
  // (in case any frame area is semi-transparent) → JPEG.
  return sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([
      { input: windowContent, top: wy, left: wx },
      { input: frameBuf, top: 0, left: 0 },
    ])
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
}
