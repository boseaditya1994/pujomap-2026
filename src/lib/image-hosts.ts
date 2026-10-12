/** Hosts whose images may be resized by the Next.js optimiser. Shared with next.config.ts. */
export function optimisableImageHosts(): string[] {
  const hosts = new Set<string>();
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) hosts.add(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname);
  } catch {
    // Malformed URL: no Supabase host to allow.
  }
  for (const h of (process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? "").split(",")) {
    if (h.trim()) hosts.add(h.trim());
  }
  return [...hosts];
}
