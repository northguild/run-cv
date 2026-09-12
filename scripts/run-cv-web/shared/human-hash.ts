// Imported by both halves of the build. The page and the builder must agree on
// this function exactly — if they ever disagreed, every name would 404 and the
// only symptom would be a permanently locked terminal — so there is only one
// copy of it, and it uses `crypto.subtle`, which is global in Node >= 18 and in
// the browser alike.

/**
 * Where a human's payload lives, as an opaque directory name.
 *
 * The salt ships in the bundle, so this is obscurity rather than secrecy: it
 * stops the CVs being *published* — to crawlers, scrapers and `curl` — not a
 * targeted guess by someone who already knows the name.
 */
export async function hashHuman(name: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}\n${name.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
