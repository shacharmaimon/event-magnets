import { createAdminClient } from "@/lib/supabase";
import { detectWindow } from "@/lib/composite";
import type { FrameWindow } from "@/lib/types";

// A raw frame row as stored, with the window split across four nullable columns.
export interface FrameRowRaw {
  id: string;
  storage_path: string;
  window_x: number | null;
  window_y: number | null;
  window_w: number | null;
  window_h: number | null;
  [key: string]: unknown;
}

// Assemble the four window columns into a FrameWindow (or null if unset).
function windowFromRow(row: FrameRowRaw): FrameWindow | null {
  if (
    row.window_x == null ||
    row.window_y == null ||
    row.window_w == null ||
    row.window_h == null
  ) {
    return null;
  }
  return { x: row.window_x, y: row.window_y, w: row.window_w, h: row.window_h };
}

/**
 * Ensure every frame row has its transparent-opening window detected, returning
 * a Map of frame id -> FrameWindow | null.
 *
 * Frames uploaded before this feature have null window columns. The FIRST time
 * such a frame is read (admin frames list or a guest opening the event), we
 * download it once, detect the opening, and persist it back — so it's a one-time
 * cost per old frame, never repeated. New frames already have it from upload.
 *
 * A frame with no detectable opening stores nothing (stays null) → the
 * compositor uses the legacy cover behavior for it.
 */
export async function ensureFrameWindows(
  rows: FrameRowRaw[],
): Promise<Map<string, FrameWindow | null>> {
  const admin = createAdminClient();
  const result = new Map<string, FrameWindow | null>();

  const missing: FrameRowRaw[] = [];
  for (const row of rows) {
    const win = windowFromRow(row);
    if (win) result.set(row.id, win);
    else missing.push(row);
  }

  // Backfill the ones without a window (download + detect + persist).
  await Promise.all(
    missing.map(async (row) => {
      try {
        const { data: blob } = await admin.storage
          .from("frames")
          .download(row.storage_path);
        if (!blob) {
          result.set(row.id, null);
          return;
        }
        const win = await detectWindow(Buffer.from(await blob.arrayBuffer()));
        result.set(row.id, win);
        if (win) {
          await admin
            .from("frames")
            .update({
              window_x: win.x,
              window_y: win.y,
              window_w: win.w,
              window_h: win.h,
            })
            .eq("id", row.id);
        }
      } catch {
        result.set(row.id, null); // detection failure → legacy fallback
      }
    }),
  );

  return result;
}

export { windowFromRow };
