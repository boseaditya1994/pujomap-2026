import { z } from "zod";

export const DEFAULT_FESTIVAL_YEAR = 2026;

/** Reads a festival year from configuration, falling back to the default when unset or invalid. */
export function parseFestivalYear(value: string | undefined): number {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : DEFAULT_FESTIVAL_YEAR;
}

/**
 * The festival year this deployment covers. Themes from any other year are
 * historical. Set NEXT_PUBLIC_FESTIVAL_YEAR (and the database setting, see
 * docs/admin-guide.md) to roll over to a new year; it is read at build time.
 */
export const FESTIVAL_YEAR = parseFestivalYear(process.env.NEXT_PUBLIC_FESTIVAL_YEAR);

export const REGIONS = ["north", "central", "south", "salt-lake", "dum-dum", "behala", "other"] as const;
export type RegionId = (typeof REGIONS)[number];

export const THEME_STATUSES = ["confirmed", "unconfirmed", "unknown"] as const;
export type ThemeStatus = (typeof THEME_STATUSES)[number];

export const VERIFICATION_STATUSES = ["verified", "needs_review", "unverified"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const WHEELCHAIR_VALUES = ["yes", "partial", "no", "unknown"] as const;
export type WheelchairAccess = (typeof WHEELCHAIR_VALUES)[number];

/** Greater Kolkata bounding box. Coordinates outside it are rejected as data-entry errors. */
export const GREATER_KOLKATA_BOUNDS = {
  south: 22.3,
  north: 22.95,
  west: 88.1,
  east: 88.65,
} as const;

/** Default map centre (central Kolkata). */
export const KOLKATA_CENTER = { lat: 22.5726, lng: 88.3639 } as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");

export const latitudeSchema = z
  .number()
  .min(GREATER_KOLKATA_BOUNDS.south, "Latitude is outside Greater Kolkata")
  .max(GREATER_KOLKATA_BOUNDS.north, "Latitude is outside Greater Kolkata");

export const longitudeSchema = z
  .number()
  .min(GREATER_KOLKATA_BOUNDS.west, "Longitude is outside Greater Kolkata")
  .max(GREATER_KOLKATA_BOUNDS.east, "Longitude is outside Greater Kolkata");

export const pandalImageSchema = z.object({
  url: z.url().max(2000),
  alt: z.string().trim().max(300).default(""),
  credit: optionalText(200),
  sourceUrl: optionalText(2000),
});
export type PandalImage = z.infer<typeof pandalImageSchema>;

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Not a real date");

/**
 * Fields an editor can set. The refinements encode the two provenance rules:
 * a theme is only "confirmed" for the current festival year with a source, and
 * a pandal is only "verified" with a source and a verification date.
 */
export const pandalInputSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    nameBn: optionalText(200),
    slug: slugSchema,
    address: z.string().trim().min(3).max(500),
    lat: latitudeSchema,
    lng: longitudeSchema,
    neighbourhood: z.string().trim().min(2).max(120),
    region: z.enum(REGIONS),
    committee: optionalText(200),
    description: optionalText(4000),
    themeYear: z
      .number()
      .int()
      .min(1900)
      .max(2100)
      .nullish()
      .transform((v) => v ?? null),
    themeTitle: optionalText(300),
    themeStatus: z.enum(THEME_STATUSES).default("unknown"),
    themeSource: optionalText(2000),
    nearestMetro: optionalText(200),
    openingSchedule: optionalText(1000),
    wheelchairAccess: z.enum(WHEELCHAIR_VALUES).default("unknown"),
    accessibilityNotes: optionalText(1000),
    verificationStatus: z.enum(VERIFICATION_STATUSES).default("unverified"),
    verificationSource: optionalText(2000),
    lastVerifiedAt: isoDate.nullish().transform((v) => v ?? null),
    images: z.array(pandalImageSchema).max(12).default([]),
    published: z.boolean().default(true),
  })
  .superRefine((p, ctx) => {
    if (p.themeStatus === "confirmed") {
      if (!p.themeTitle) {
        ctx.addIssue({ code: "custom", path: ["themeTitle"], message: "A confirmed theme needs a title" });
      }
      if (!p.themeSource) {
        ctx.addIssue({ code: "custom", path: ["themeSource"], message: "A confirmed theme needs a source" });
      }
      if (p.themeYear !== FESTIVAL_YEAR) {
        ctx.addIssue({
          code: "custom",
          path: ["themeYear"],
          message: `Only a ${FESTIVAL_YEAR} theme can be confirmed; earlier themes are historical`,
        });
      }
    }
    if (p.verificationStatus === "verified") {
      if (!p.verificationSource) {
        ctx.addIssue({
          code: "custom",
          path: ["verificationSource"],
          message: "A verified pandal needs a verification source",
        });
      }
      if (!p.lastVerifiedAt) {
        ctx.addIssue({
          code: "custom",
          path: ["lastVerifiedAt"],
          message: "A verified pandal needs a last-verified date",
        });
      }
    }
  });
export type PandalInput = z.infer<typeof pandalInputSchema>;

export type Pandal = PandalInput & {
  id: string;
  /** True only for bundled sample records used in local development. */
  isDemo: boolean;
  updatedAt: string;
};

export const TRAVEL_MODES = ["walk", "drive", "two_wheeler", "transit"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const curatedRouteInputSchema = z.object({
  slug: slugSchema,
  region: z.enum(REGIONS),
  title: z.string().trim().min(2).max(200),
  titleBn: optionalText(200),
  description: optionalText(2000),
  descriptionBn: optionalText(2000),
  /** A place name Google Maps can resolve (e.g. a Metro station). Never coordinates we made up. */
  startLabel: optionalText(200),
  travelMode: z.enum(TRAVEL_MODES).default("walk"),
  stopPandalIds: z.array(z.string().min(1)).max(10).default([]),
  published: z.boolean().default(true),
});
export type CuratedRouteInput = z.infer<typeof curatedRouteInputSchema>;
export type CuratedRoute = CuratedRouteInput & { id: string; updatedAt: string };

export const SUBMISSION_TYPES = [
  "new_pandal",
  "location_report",
  "theme_correction",
  "accessibility_correction",
] as const;
export type SubmissionType = (typeof SUBMISSION_TYPES)[number];

export const SUBMISSION_STATUSES = ["pending", "accepted", "rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const submissionInputSchema = z
  .object({
    type: z.enum(SUBMISSION_TYPES),
    pandalId: optionalText(80),
    pandalName: z.string().trim().min(2).max(200),
    details: z.string().trim().min(10).max(3000),
    sourceUrl: z
      .union([z.url().max(2000), z.literal("")])
      .nullish()
      .transform((v) => (v ? v : null)),
    lat: latitudeSchema.nullish().transform((v) => v ?? null),
    lng: longitudeSchema.nullish().transform((v) => v ?? null),
    contactEmail: z
      .union([z.email().max(320), z.literal("")])
      .nullish()
      .transform((v) => (v ? v : null)),
  })
  .refine((s) => (s.lat === null) === (s.lng === null), {
    path: ["lng"],
    message: "Provide both latitude and longitude, or neither",
  });
export type SubmissionInput = z.infer<typeof submissionInputSchema>;

export type Submission = SubmissionInput & {
  id: string;
  status: SubmissionStatus;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
};

export type Actor = { id: string; email: string };
