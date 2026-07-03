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
