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
  album_token: string;
  created_at: string;
  // When the admin-uploaded "originals album" finished publishing; also the
  // 30-day expiry clock. null = no active originals album.
  originals_published_at: string | null;
}

export type Orientation = "portrait" | "landscape";

/**
 * A frame's transparent opening (the hole the photo shows through), as fractions
 * (0..1) of the frame's width/height. Detected from the frame's alpha channel and
 * reused by BOTH the server compositor and the on-screen preview so they match.
 * null = not yet detected (compositor falls back to legacy cover behavior).
 */
export interface FrameWindow {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One row of the `frames` table. */
export interface FrameRecord {
  id: string;
  event_id: string;
  storage_path: string;
  orientation: Orientation;
  display_order: number;
  created_at: string;
  window: FrameWindow | null;
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

/** A frame as exposed to guests — only the fields they need (no internal ids/paths). */
export interface PublicFrame {
  id: string;
  orientation: Orientation;
  url: string;
  window: FrameWindow | null;
}

export interface PublicGroupedFrames {
  portrait: PublicFrame[];
  landscape: PublicFrame[];
}

/** The safe subset of event data exposed publicly to guests (open events only). */
export interface PublicEventData {
  name: string;
  welcome_heading: string;
  welcome_subheading: string;
  photos_per_device: number;
  public_slug: string;
  frames: PublicGroupedFrames;
}

/** One row of the `submissions` table. */
export interface SubmissionRecord {
  id: string;
  event_id: string;
  frame_id: string | null;
  device_id: string;
  raw_storage_path: string | null;
  finished_storage_path: string | null;
  orientation: Orientation | null;
  created_at: string;
  downloaded_at: string | null; // set when downloaded as an individual magnet
  printed_at: string | null; // set when downloaded as a 2-up print sheet
}

/** A submission plus a signed URL to its finished (framed) image. */
export interface SubmissionWithUrl extends SubmissionRecord {
  url: string;
}

/**
 * One UNIQUE finished photo for the admin gallery, with its copy count. Copies
 * are stored as N identical rows sharing one finished_storage_path; the gallery
 * shows each photo once and badges it "xN". `path` is the shared
 * finished_storage_path — used as the group key and passed to batch actions.
 */
export interface GroupedSubmission {
  id: string; // representative row id (first of the group)
  path: string; // shared finished_storage_path (group key)
  url: string; // signed URL to the finished image
  orientation: Orientation | null;
  copies: number; // number of rows sharing this path
}

/** The two independent "new" counters shown on the admin print page. */
export interface NewCounts {
  newIndividual: number; // finished rows not yet downloaded individually
  newSheets: number; // finished rows not yet downloaded as print sheets
}

/** One row of the `original_photos` table (admin-uploaded, unframed originals). */
export interface OriginalPhoto {
  id: string;
  event_id: string;
  storage_path: string;
  orientation: Orientation | null;
  created_at: string;
}

/** A single photo as exposed in a public host album (only safe fields). */
export interface PublicAlbumPhoto {
  id: string;
  url: string;
  orientation: Orientation | null;
}

/** The public, read-only album data for hosts (works even when event closed). */
export interface PublicAlbumData {
  name: string;
  welcome_heading: string;
  photos: PublicAlbumPhoto[];
}
