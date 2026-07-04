import { NextResponse } from "next/server";

export const runtime = "nodejs";

// POST /api/e/[slug]/submit — PUBLIC (no auth). Guests submit their chosen
// photo + frame here.
//
// PHASE 6 will implement this fully. The contract:
//   - multipart/form-data: file (the raw photo), frameId, orientation, deviceId
//   - validate the event exists AND is_open
//   - enforce photos_per_device: count existing submissions for (event, deviceId);
//     reject with 429/409 if the limit is reached
//   - composite with sharp: sharp(photo).rotate() [apply EXIF] .resize(W,H,{fit:"cover"})
//     then overlay the frame PNG (1200x900 landscape / 900x1200 portrait)
//   - upload raw photo + finished image to the private `submissions` bucket
//   - insert a `submissions` row (event_id, frame_id, device_id, raw/finished paths, orientation)
//
// Until then, return 501 so the client shows a friendly "coming soon" message.
export async function POST() {
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}
