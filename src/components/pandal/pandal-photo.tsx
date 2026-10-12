import Image from "next/image";
import { optimisableImageHosts } from "@/lib/image-hosts";

const SIZES = "(min-width: 640px) 240px, 45vw";

/**
 * Photos hosted on an allow-listed host (Supabase Storage by default) go
 * through the Next.js image optimiser. Anything else is shown as a plain
 * lazy-loaded image rather than turning the optimiser into an open proxy.
 */
export function PandalPhoto({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  let host = "";
  try {
    host = new URL(src).hostname;
  } catch {
    return null;
  }
  const className = "aspect-[4/3] w-full rounded-xl border object-cover";
  if (optimisableImageHosts().includes(host)) {
    return (
      <Image src={src} alt={alt} width={480} height={360} sizes={SIZES} priority={priority} className={className} />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- host is not allow-listed for optimisation
    <img
      src={src}
      alt={alt}
      width={480}
      height={360}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
    />
  );
}
