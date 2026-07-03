// Shared TypeScript types, defined once and reused by both the server route
// handlers and the client components so the data shape never drifts.

/** One row of the `events` table. */
export interface EventRecord {
  id: string;
  name: string;
  welcome_heading: string;
  welcome_subheading: string;
  is_open: boolean;
  photos_per_device: number;
  public_slug: string;
  created_at: string;
}

export type Orientation = "portrait" | "landscape";

/** One row of the `frames` table. */
export interface FrameRecord {
  id: string;
  event_id: string;
  storage_path: string;
  orientation: Orientation;
  display_order: number;
  created_at: string;
}

/** A frame plus a temporary signed URL for displaying its (private) image. */
export interface FrameWithUrl extends FrameRecord {
  url: string;
}

/** Frames grouped by orientation, as returned by the list endpoint. */
export interface GroupedFrames {
  portrait: FrameWithUrl[];
  landscape: FrameWithUrl[];
}
