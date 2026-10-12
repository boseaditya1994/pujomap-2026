import { FESTIVAL_YEAR, type CuratedRoute, type Pandal, type RegionId } from "@/lib/domain/types";

/**
 * SAMPLE DATA FOR LOCAL DEVELOPMENT ONLY.
 *
 * These are not real pandals. Names are placeholders, pins are arbitrary
 * points inside each region, and "themes" exist only to exercise the UI
 * states. They are served only when Supabase is not configured, are flagged
 * `isDemo`, and the site shows a banner whenever they are on screen. Real
 * records come from the admin portal or a CSV import (docs/data-sourcing.md).
 */

const UPDATED_AT = "2026-01-01T00:00:00.000Z";
const DEMO_SOURCE = "Sample record for local development (not a real source)";

type Area = { region: RegionId; label: string; neighbourhoods: string[]; lat: number; lng: number };

const AREAS: Area[] = [
  { region: "north", label: "North", neighbourhoods: ["Bagbazar", "Shyambazar", "Hatibagan"], lat: 22.6, lng: 88.368 },
  {
    region: "central",
    label: "Central",
    neighbourhoods: ["College Square", "Bowbazar", "Sealdah"],
    lat: 22.572,
    lng: 88.364,
  },
  { region: "south", label: "South", neighbourhoods: ["Ballygunge", "Gariahat", "Kalighat"], lat: 22.522, lng: 88.356 },
  {
    region: "salt-lake",
    label: "Salt Lake",
    neighbourhoods: ["Sector I", "Sector II", "Sector III"],
    lat: 22.586,
    lng: 88.412,
  },
  {
    region: "dum-dum",
    label: "Dum Dum",
    neighbourhoods: ["Dum Dum Park", "Nagerbazar", "Lake Town"],
    lat: 22.618,
    lng: 88.412,
  },
  {
    region: "behala",
    label: "Behala",
    neighbourhoods: ["Behala Chowrasta", "Sakherbazar", "Parnasree"],
    lat: 22.498,
    lng: 88.314,
  },
];

const OFFSETS = [
  [0, 0],
  [0.006, 0.005],
  [-0.005, 0.007],
] as const;

function demoPandal(area: Area, i: number): Pandal {
  const n = i + 1;
  const [dLat, dLng] = OFFSETS[i];
  const verified = i === 0;
  const theme =
    i === 0
      ? {
          themeYear: FESTIVAL_YEAR,
          themeTitle: `Sample theme ${area.label} ${n}`,
          themeStatus: "confirmed" as const,
          themeSource: DEMO_SOURCE,
        }
      : i === 1
        ? {
            themeYear: FESTIVAL_YEAR - 1,
            themeTitle: `Sample earlier theme ${area.label}`,
            themeStatus: "unknown" as const,
            themeSource: null,
          }
        : { themeYear: null, themeTitle: null, themeStatus: "unknown" as const, themeSource: null };
  return {
    id: `demo-${area.region}-${n}`,
    slug: `demo-${area.region}-${n}`,
    name: `Demo Pandal ${area.label} ${n}`,
    nameBn: null,
    address: `Sample address, ${area.neighbourhoods[i]}, Kolkata`,
    lat: area.lat + dLat,
    lng: area.lng + dLng,
    neighbourhood: area.neighbourhoods[i],
    region: area.region,
    committee: null,
    description: "Placeholder record used to demonstrate the interface. It does not describe a real pandal.",
    ...theme,
    nearestMetro: null,
    openingSchedule: null,
    wheelchairAccess: i === 0 ? "partial" : "unknown",
    accessibilityNotes: i === 0 ? "Sample accessibility note." : null,
    verificationStatus: verified ? "verified" : i === 1 ? "needs_review" : "unverified",
    verificationSource: verified ? DEMO_SOURCE : null,
    lastVerifiedAt: verified ? "2026-01-01" : null,
    images: [],
    published: true,
    isDemo: true,
    updatedAt: UPDATED_AT,
  };
}

export function buildDemoPandals(): Pandal[] {
  return AREAS.flatMap((area) => OFFSETS.map((_, i) => demoPandal(area, i)));
}

/** Route shells for the six required areas. Start points are place names Google resolves itself. */
export const CURATED_ROUTE_SHELLS: Omit<CuratedRoute, "id" | "updatedAt" | "stopPandalIds">[] = [
  {
    slug: "north-kolkata-heritage-walk",
    region: "north",
    title: "North Kolkata walk",
    titleBn: "উত্তর কলকাতা পদযাত্রা",
    description: "A walking loop through the old neighbourhoods of North Kolkata.",
    descriptionBn: "উত্তর কলকাতার পুরনো পাড়াগুলির মধ্য দিয়ে হাঁটাপথ।",
    startLabel: "Shobhabazar Sutanuti Metro Station, Kolkata",
    travelMode: "walk",
    published: true,
  },
  {
    slug: "central-kolkata-circuit",
    region: "central",
    title: "Central Kolkata circuit",
    titleBn: "মধ্য কলকাতা পরিক্রমা",
    description: "Pandals around the central business and college district.",
    descriptionBn: "মধ্য কলকাতার অফিসপাড়া ও কলেজপাড়ার পুজো।",
    startLabel: "Central Metro Station, Kolkata",
    travelMode: "walk",
    published: true,
  },
  {
    slug: "south-kolkata-evening",
    region: "south",
    title: "South Kolkata evening",
    titleBn: "দক্ষিণ কলকাতার সন্ধ্যা",
    description: "An evening route through South Kolkata.",
    descriptionBn: "দক্ষিণ কলকাতার সন্ধ্যার পুজো পরিক্রমা।",
    startLabel: "Kalighat Metro Station, Kolkata",
    travelMode: "walk",
    published: true,
  },
  {
    slug: "salt-lake-blocks",
    region: "salt-lake",
    title: "Salt Lake blocks",
    titleBn: "সল্টলেকের ব্লকে ব্লকে",
    description: "Block pujas across Salt Lake, best covered by car or two-wheeler.",
    descriptionBn: "সল্টলেকের ব্লকের পুজো, গাড়ি বা বাইকে সুবিধাজনক।",
    startLabel: "Karunamoyee Metro Station, Salt Lake, Kolkata",
    travelMode: "drive",
    published: true,
  },
  {
    slug: "dum-dum-lake-town",
    region: "dum-dum",
    title: "Dum Dum and Lake Town",
    titleBn: "দমদম ও লেকটাউন",
    description: "Pandals around Dum Dum, Nagerbazar and Lake Town.",
    descriptionBn: "দমদম, নাগেরবাজার ও লেকটাউনের পুজো।",
    startLabel: "Dum Dum Metro Station, Kolkata",
    travelMode: "drive",
    published: true,
  },
  {
    slug: "behala-trail",
    region: "behala",
    title: "Behala trail",
    titleBn: "বেহালা পরিক্রমা",
    description: "A route along the Behala stretch of Diamond Harbour Road.",
    descriptionBn: "ডায়মন্ড হারবার রোড ধরে বেহালার পুজো।",
    startLabel: "Behala Chowrasta Metro Station, Kolkata",
    travelMode: "drive",
    published: true,
  },
];

export function buildDemoRoutes(pandals: Pandal[]): CuratedRoute[] {
  return CURATED_ROUTE_SHELLS.map((shell) => ({
    ...shell,
    id: `demo-route-${shell.region}`,
    updatedAt: UPDATED_AT,
    stopPandalIds: pandals.filter((p) => p.region === shell.region).map((p) => p.id),
  }));
}
