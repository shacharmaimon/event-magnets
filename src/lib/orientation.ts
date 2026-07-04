"use client";

import type { Orientation } from "@/lib/types";

// Detect a photo's orientation from its (EXIF-corrected) dimensions.
//
// Phone photos often carry an EXIF rotation flag: the stored pixels may be
// sideways while the flag says "rotate on display". If we read raw pixel
// dimensions we can misjudge a portrait photo as landscape. So we explicitly
// honor EXIF via createImageBitmap({ imageOrientation: "from-image" }), with an
// <img>.decode() fallback for older browsers (which honor EXIF by default).
export async function detectOrientation(file: File): Promise<Orientation> {
  // Primary: createImageBitmap with EXIF applied.
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const { width, height } = bitmap;
    bitmap.close?.();
    return width < height ? "portrait" : "landscape";
  } catch {
    // Fallback: load into an <img> and read natural dimensions.
    const url = URL.createObjectURL(file);
    try {
      const img = document.createElement("img");
      img.src = url;
      await img.decode();
      return img.naturalWidth < img.naturalHeight ? "portrait" : "landscape";
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
