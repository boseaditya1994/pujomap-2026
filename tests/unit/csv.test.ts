import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CSV_COLUMNS, parsePandalCsv } from "@/lib/domain/csv";

const header = CSV_COLUMNS.join(",");
const row = (over: Partial<Record<(typeof CSV_COLUMNS)[number], string>> = {}) => {
  const base: Record<string, string> = {
    name: "Alpha Pandal",
    address: "1 Alpha Road",
    latitude: "22.5726",
    longitude: "88.3639",
    neighbourhood: "Alpha",
    region: "central",
  };
  const merged = { ...base, ...over };
  return CSV_COLUMNS.map((c) => {
    const v = merged[c] ?? "";
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(",");
};
const csv = (...rows: string[]) => [header, ...rows].join("\n");

describe("CSV import validation", () => {
  it("the shipped template header matches the importer's columns", () => {
    expect(readFileSync("data/pandals.template.csv", "utf8").trim()).toBe(header);
  });
  it("the shipped example file validates", () => {
    const r = parsePandalCsv(readFileSync("data/pandals.example.csv", "utf8"));
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
  });
  it("imports a valid row, deriving the slug and defaulting unknowns", () => {
    const r = parsePandalCsv(csv(row()));
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({
      slug: "alpha-pandal",
      lat: 22.5726,
      themeStatus: "unknown",
      verificationStatus: "unverified",
      themeTitle: null,
    });
  });
  it("tolerates a UTF-8 BOM, CRLF line endings and blank lines", () => {
    const r = parsePandalCsv("﻿" + csv(row(), "", row({ name: "Beta Pandal" })).replace(/\n/g, "\r\n"));
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
  });
  it("reports missing required and unknown columns", () => {
    const r = parsePandalCsv("name,address,lat\nA,B,1");
    const fields = r.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["latitude", "longitude", "neighbourhood", "region", "lat"]));
    expect(r.rows).toEqual([]);
  });
  it("rejects non-numeric, missing and out-of-area coordinates with the spreadsheet row number", () => {
    const r = parsePandalCsv(
      csv(
        row(),
        row({ name: "B", latitude: "22.57N" }),
        row({ name: "C", latitude: "28.61", longitude: "77.20" }),
        row({ name: "D", longitude: "" }),
      ),
    );
    expect(r.rows).toEqual([]);
    expect(r.errors.filter((e) => e.row === 3).map((e) => e.field)).toContain("latitude");
    expect(r.errors.filter((e) => e.row === 4).map((e) => e.field)).toEqual(
      expect.arrayContaining(["latitude", "longitude"]),
    );
    expect(r.errors.filter((e) => e.row === 5).map((e) => e.field)).toContain("longitude");
  });
  it("refuses to import a historical theme as confirmed", () => {
    const r = parsePandalCsv(
      csv(
        row({
          theme_status: "confirmed",
          theme_title: "Last year's theme",
          theme_year: "2025",
          theme_source: "https://example.org",
        }),
      ),
    );
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([expect.objectContaining({ row: 2, field: "theme_year" })]);
  });
  it("accepts a sourced 2026 theme, and a historical theme stored as not confirmed", () => {
    const r = parsePandalCsv(
      csv(
        row({ theme_status: "confirmed", theme_title: "T", theme_year: "2026", theme_source: "https://example.org" }),
        row({ name: "Beta", theme_title: "Old", theme_year: "2025" }),
      ),
    );
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
  });
  it("requires a source and date for verified rows", () => {
    const r = parsePandalCsv(csv(row({ verification_status: "verified" })));
    expect(r.errors.map((e) => e.field).sort()).toEqual(["last_verified_date", "verification_source"]);
  });
  it("rejects duplicate slugs, bad regions and bad dates", () => {
    const r = parsePandalCsv(
      csv(row(), row(), row({ name: "G", region: "mumbai" }), row({ name: "H", last_verified_date: "12/10/2026" })),
    );
    expect(r.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 3, field: "slug" }),
        expect.objectContaining({ row: 4, field: "region" }),
        expect.objectContaining({ row: 5, field: "last_verified_date" }),
      ]),
    );
    expect(r.rows).toEqual([]);
  });
  it("handles quoted fields containing commas and newlines", () => {
    const r = parsePandalCsv(csv(row({ address: "12, Some Lane\nNear the park" })));
    expect(r.errors).toEqual([]);
    expect(r.rows[0].address).toBe("12, Some Lane\nNear the park");
  });
  it("returns no rows and no errors for a header-only file", () => {
    expect(parsePandalCsv(header)).toEqual({ rows: [], errors: [], totalRows: 0 });
  });
});
