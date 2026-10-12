import Papa from "papaparse";
import { slugify } from "./pandal";
import { pandalInputSchema, type PandalInput } from "./types";

/** Column order of data/pandals.template.csv. */
export const CSV_COLUMNS = [
  "name",
  "name_bn",
  "slug",
  "address",
  "latitude",
  "longitude",
  "neighbourhood",
  "region",
  "committee",
  "description",
  "theme_year",
  "theme_title",
  "theme_status",
  "theme_source",
  "nearest_metro",
  "opening_schedule",
  "wheelchair_access",
  "accessibility_notes",
  "verification_status",
  "verification_source",
  "last_verified_date",
] as const;

const REQUIRED_COLUMNS = ["name", "address", "latitude", "longitude", "neighbourhood", "region"] as const;

export const MAX_IMPORT_ROWS = 2000;

export type CsvRowError = { row: number; field: string; message: string };
export type CsvImportResult = {
  rows: PandalInput[];
  errors: CsvRowError[];
  totalRows: number;
};

const FIELD_TO_COLUMN: Record<string, string> = {
  nameBn: "name_bn",
  lat: "latitude",
  lng: "longitude",
  themeYear: "theme_year",
  themeTitle: "theme_title",
  themeStatus: "theme_status",
  themeSource: "theme_source",
  nearestMetro: "nearest_metro",
  openingSchedule: "opening_schedule",
  wheelchairAccess: "wheelchair_access",
  accessibilityNotes: "accessibility_notes",
  verificationStatus: "verification_status",
  verificationSource: "verification_source",
  lastVerifiedAt: "last_verified_date",
};

const blank = (v: string | undefined) => (v == null || v.trim() === "" ? undefined : v.trim());

function strictNumber(v: string | undefined): number | undefined | typeof NaN {
  const s = blank(v);
  if (s === undefined) return undefined;
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

/**
 * Parses and validates a pandal CSV. Nothing is imported unless every row is
 * valid: `rows` is empty whenever `errors` is not. Row numbers are 1-based and
 * count the header as row 1, matching what a spreadsheet shows.
 */
export function parsePandalCsv(text: string): CsvImportResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const errors: CsvRowError[] = [];
  const headers = parsed.meta.fields ?? [];

  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) errors.push({ row: 1, field: col, message: `Missing required column "${col}"` });
  }
  for (const h of headers) {
    if (!(CSV_COLUMNS as readonly string[]).includes(h)) {
      errors.push({ row: 1, field: h, message: `Unknown column "${h}"` });
    }
  }
  for (const e of parsed.errors) {
    errors.push({ row: (e.row ?? 0) + 2, field: "", message: e.message });
  }
  if (parsed.data.length > MAX_IMPORT_ROWS) {
    errors.push({ row: 1, field: "", message: `Too many rows (limit ${MAX_IMPORT_ROWS})` });
  }
  if (errors.length) return { rows: [], errors, totalRows: parsed.data.length };

  const rows: PandalInput[] = [];
  const seenSlugs = new Map<string, number>();

  parsed.data.forEach((r, i) => {
    const rowNo = i + 2;
    const name = blank(r.name) ?? "";
    const candidate = {
      name,
      nameBn: blank(r.name_bn),
      slug: blank(r.slug) ?? slugify(name),
      address: blank(r.address) ?? "",
      lat: strictNumber(r.latitude),
      lng: strictNumber(r.longitude),
      neighbourhood: blank(r.neighbourhood) ?? "",
      region: blank(r.region)?.toLowerCase(),
      committee: blank(r.committee),
      description: blank(r.description),
      themeYear: strictNumber(r.theme_year),
      themeTitle: blank(r.theme_title),
      themeStatus: blank(r.theme_status)?.toLowerCase(),
      themeSource: blank(r.theme_source),
      nearestMetro: blank(r.nearest_metro),
      openingSchedule: blank(r.opening_schedule),
      wheelchairAccess: blank(r.wheelchair_access)?.toLowerCase(),
      accessibilityNotes: blank(r.accessibility_notes),
      verificationStatus: blank(r.verification_status)?.toLowerCase(),
      verificationSource: blank(r.verification_source),
      lastVerifiedAt: blank(r.last_verified_date),
    };
    const result = pandalInputSchema.safeParse(candidate);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        errors.push({ row: rowNo, field: FIELD_TO_COLUMN[key] ?? key, message: issue.message });
      }
      return;
    }
    const firstSeen = seenSlugs.get(result.data.slug);
    if (firstSeen) {
      errors.push({
        row: rowNo,
        field: "slug",
        message: `Duplicate slug "${result.data.slug}" (also row ${firstSeen})`,
      });
      return;
    }
    seenSlugs.set(result.data.slug, rowNo);
    rows.push(result.data);
  });

  return { rows: errors.length ? [] : rows, errors, totalRows: parsed.data.length };
}
