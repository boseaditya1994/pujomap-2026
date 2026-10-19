import type { MetadataRoute } from "next";
import { FESTIVAL_YEAR } from "@/lib/domain/types";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `PujoMap ${FESTIVAL_YEAR}`,
    short_name: "PujoMap",
    description: "Discover. Explore. Celebrate. A map of Durga Puja pandals across Kolkata.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf5e9",
    theme_color: "#7b1626",
    lang: "en",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
