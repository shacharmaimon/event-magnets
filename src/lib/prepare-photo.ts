"use client";

import type { Orientation } from "@/lib/types";

// Client-side photo prep: shrink the photo to a max 2000px longest edge BEFORE
// uploading, and bake in EXIF orientation so it's upright.
//
// Why on the phone (not the server): the upload is the slowest part of "send"
// on venue wifi. Shrinking here makes the upload ~4x smaller/faster, cuts
// stored size ~4.5x, and avoids the platform's ~4.5MB request-body limit that
// made large phone photos fail. 2000px is still well above the 1200px print
// size, so re-framing later stays sharp and the printed magnet is unaffected.

const MAX_EDGE = 2000;
const QUALITY = 0.88;

// Decode the file with EXIF orientation applied so the pixels are upright.
async function loadUpright(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  try {
    const bmp = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    return {
      source: bmp,
      width: bmp.width,
      height: bmp.height,
      cleanup: () => bmp.close?.(),
    };
  } catch {
    // Fallback for browsers without the options bag: <img> honors EXIF by default.
    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  }
}

export async function preparePhoto(
  file: File,
): Promise<{ file: File; orientation: Orientation }> {
  try {
    const { source, width, height, cleanup } = await loadUpright(file);
    const orientation: Orientation =
      width < height ? "portrait" : "landscape";

    // Scale so the longest edge <= MAX_EDGE (never enlarge small photos).
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      cleanup();
      return { file, orientation };
    }
    ctx.drawImage(source, 0, 0, w, h);
    cleanup();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", QUALITY),
    );
    if (!blob) return { file, orientation };

    const resized = new File([blob], "photo.jpg", { type: "image/jpeg" });
    // Keep whichever is smaller (tiny originals may not benefit).
    return {
      file: resized.size < file.size ? resized : file,
      orientation,
    };
  } catch {
    // Last-resort fallback: upload the original, guess orientation as landscape.
    return { file, orientation: "landscape" };
  }
}
