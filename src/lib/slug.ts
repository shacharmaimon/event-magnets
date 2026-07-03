import { randomBytes } from "crypto";

// Event names are Hebrew and don't slugify cleanly, so guest links use a short
// random code instead (e.g. /e/a1b2c3). 6 base36 chars ≈ 2 billion options, so
// collisions are effectively nil; the POST route also retries + the DB column
// is UNIQUE as a backstop.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateSlug(len = 6): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
