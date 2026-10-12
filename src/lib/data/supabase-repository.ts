import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditEntry,
  CuratedRoute,
  CuratedRouteInput,
  Pandal,
  PandalInput,
  Submission,
  SubmissionInput,
  SubmissionStatus,
} from "@/lib/domain/types";
import { RepositoryError, type AdminRepository, type PublicRepository } from "./repository";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows are mapped by hand; no generated DB types yet */
type Row = Record<string, any>;

const PANDAL_SELECT = "*, pandal_images(url, alt, credit, source_url, sort_order)";
const ROUTE_SELECT = "*, route_stops(pandal_id, position)";

function fail(error: { message: string; code?: string } | null): asserts error is null {
  if (!error) return;
  if (error.code === "23505") throw new RepositoryError("That slug is already in use", "conflict");
  if (error.code === "42501") throw new RepositoryError("Not allowed", "forbidden");
  throw new RepositoryError(error.message);
}

function toPandal(r: Row): Pandal {
  const images = [...(r.pandal_images ?? [])].sort((a: Row, b: Row) => a.sort_order - b.sort_order);
  return {
    id: r.id,
    name: r.name,
    nameBn: r.name_bn,
    slug: r.slug,
    address: r.address,
    lat: r.latitude,
    lng: r.longitude,
    neighbourhood: r.neighbourhood,
    region: r.region,
    committee: r.committee,
    description: r.description,
    themeYear: r.theme_year,
    themeTitle: r.theme_title,
    themeStatus: r.theme_status,
    themeSource: r.theme_source,
    nearestMetro: r.nearest_metro,
    openingSchedule: r.opening_schedule,
    wheelchairAccess: r.wheelchair_access,
    accessibilityNotes: r.accessibility_notes,
    verificationStatus: r.verification_status,
    verificationSource: r.verification_source,
    lastVerifiedAt: r.last_verified_at,
    images: images.map((i: Row) => ({ url: i.url, alt: i.alt ?? "", credit: i.credit, sourceUrl: i.source_url })),
    published: r.published,
    isDemo: false,
    updatedAt: r.updated_at,
  };
}

function fromPandal(p: PandalInput): Row {
  return {
    name: p.name,
    name_bn: p.nameBn,
    slug: p.slug,
    address: p.address,
    latitude: p.lat,
    longitude: p.lng,
    neighbourhood: p.neighbourhood,
    region: p.region,
    committee: p.committee,
    description: p.description,
    theme_year: p.themeYear,
    theme_title: p.themeTitle,
    theme_status: p.themeStatus,
    theme_source: p.themeSource,
    nearest_metro: p.nearestMetro,
    opening_schedule: p.openingSchedule,
    wheelchair_access: p.wheelchairAccess,
    accessibility_notes: p.accessibilityNotes,
    verification_status: p.verificationStatus,
    verification_source: p.verificationSource,
    last_verified_at: p.lastVerifiedAt,
    published: p.published,
  };
}

function toRoute(r: Row): CuratedRoute {
  const stops = [...(r.route_stops ?? [])].sort((a: Row, b: Row) => a.position - b.position);
  return {
    id: r.id,
    slug: r.slug,
    region: r.region,
    title: r.title,
    titleBn: r.title_bn,
    description: r.description,
    descriptionBn: r.description_bn,
    startLabel: r.start_label,
    travelMode: r.travel_mode,
    published: r.published,
    stopPandalIds: stops.map((s: Row) => s.pandal_id),
    updatedAt: r.updated_at,
  };
}

function toSubmission(r: Row): Submission {
  return {
    id: r.id,
    type: r.type,
    pandalId: r.pandal_id,
    pandalName: r.pandal_name,
    details: r.details,
    sourceUrl: r.source_url,
    lat: r.latitude,
    lng: r.longitude,
    contactEmail: r.contact_email,
    status: r.status,
    reviewNote: r.review_note,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Supabase-backed repository. Authorisation is enforced by row-level security,
 * so the same class serves visitors (anon client) and admins (session client).
 * The audit log is written by database triggers, not by this code.
 */
export class SupabaseRepository implements PublicRepository, AdminRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listPandals() {
    const { data, error } = await this.db.from("pandals").select(PANDAL_SELECT).eq("published", true).order("name");
    fail(error);
    return (data ?? []).map(toPandal);
  }

  async listCuratedRoutes() {
    const { data, error } = await this.db
      .from("curated_routes")
      .select(ROUTE_SELECT)
      .eq("published", true)
      .order("title");
    fail(error);
    return (data ?? []).map(toRoute);
  }

  async createSubmission(input: SubmissionInput) {
    // No .select(): visitors have insert-only access to this table.
    const { error } = await this.db.from("submissions").insert({
      type: input.type,
      pandal_id: input.pandalId && UUID.test(input.pandalId) ? input.pandalId : null,
      pandal_name: input.pandalName,
      details: input.details,
      source_url: input.sourceUrl,
      latitude: input.lat,
      longitude: input.lng,
      contact_email: input.contactEmail,
    });
    fail(error);
  }

  async listAllPandals() {
    const { data, error } = await this.db.from("pandals").select(PANDAL_SELECT).order("name");
    fail(error);
    return (data ?? []).map(toPandal);
  }

  async getPandal(id: string) {
    if (!UUID.test(id)) return null;
    const { data, error } = await this.db.from("pandals").select(PANDAL_SELECT).eq("id", id).maybeSingle();
    fail(error);
    return data ? toPandal(data) : null;
  }

  private async replaceImages(pandalId: string, images: PandalInput["images"]) {
    const del = await this.db.from("pandal_images").delete().eq("pandal_id", pandalId);
    fail(del.error);
    if (images.length === 0) return;
    const ins = await this.db.from("pandal_images").insert(
      images.map((img, i) => ({
        pandal_id: pandalId,
        url: img.url,
        alt: img.alt,
        credit: img.credit,
        source_url: img.sourceUrl,
        sort_order: i,
      })),
    );
    fail(ins.error);
  }

  async createPandal(input: PandalInput) {
    const { data, error } = await this.db.from("pandals").insert(fromPandal(input)).select("id").single();
    fail(error);
    await this.replaceImages(data.id, input.images);
    return (await this.getPandal(data.id)) as Pandal;
  }

  async updatePandal(id: string, input: PandalInput) {
    const { data, error } = await this.db.from("pandals").update(fromPandal(input)).eq("id", id).select("id");
    fail(error);
    if (!data?.length) throw new RepositoryError("Pandal not found", "not_found");
    await this.replaceImages(id, input.images);
    return (await this.getPandal(id)) as Pandal;
  }

  async deletePandal(id: string) {
    const { data, error } = await this.db.from("pandals").delete().eq("id", id).select("id");
    fail(error);
    if (!data?.length) throw new RepositoryError("Pandal not found", "not_found");
  }

  async importPandals(rows: PandalInput[]) {
    const slugs = rows.map((r) => r.slug);
    const existing = await this.db.from("pandals").select("slug").in("slug", slugs);
    fail(existing.error);
    const known = new Set((existing.data ?? []).map((r: Row) => r.slug));
    // One statement, so the import is applied entirely or not at all.
    const { error } = await this.db.from("pandals").upsert(rows.map(fromPandal), { onConflict: "slug" });
    fail(error);
    const updated = slugs.filter((s) => known.has(s)).length;
    return { created: slugs.length - updated, updated };
  }

  async listAllCuratedRoutes() {
    const { data, error } = await this.db.from("curated_routes").select(ROUTE_SELECT).order("title");
    fail(error);
    return (data ?? []).map(toRoute);
  }

  async saveCuratedRoute(id: string | null, input: CuratedRouteInput) {
    const row = {
      slug: input.slug,
      region: input.region,
      title: input.title,
      title_bn: input.titleBn,
      description: input.description,
      description_bn: input.descriptionBn,
      start_label: input.startLabel,
      travel_mode: input.travelMode,
      published: input.published,
    };
    const res = id
      ? await this.db.from("curated_routes").update(row).eq("id", id).select("id")
      : await this.db.from("curated_routes").insert(row).select("id");
    fail(res.error);
    const routeId = res.data?.[0]?.id as string | undefined;
    if (!routeId) throw new RepositoryError("Route not found", "not_found");

    const del = await this.db.from("route_stops").delete().eq("route_id", routeId);
    fail(del.error);
    if (input.stopPandalIds.length) {
      const ins = await this.db
        .from("route_stops")
        .insert(input.stopPandalIds.map((pandal_id, position) => ({ route_id: routeId, pandal_id, position })));
      fail(ins.error);
    }
    const { data, error } = await this.db.from("curated_routes").select(ROUTE_SELECT).eq("id", routeId).single();
    fail(error);
    return toRoute(data);
  }

  async deleteCuratedRoute(id: string) {
    const { error } = await this.db.from("curated_routes").delete().eq("id", id);
    fail(error);
  }

  async listSubmissions(status?: SubmissionStatus) {
    let query = this.db.from("submissions").select("*").order("created_at", { ascending: false }).limit(500);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    fail(error);
    return (data ?? []).map(toSubmission);
  }

  async reviewSubmission(
    id: string,
    status: Exclude<SubmissionStatus, "pending">,
    note: string | null,
    actor: { id: string },
  ) {
    const { data, error } = await this.db
      .from("submissions")
      .update({ status, review_note: note, reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    fail(error);
    if (!data?.length) throw new RepositoryError("Submission not found", "not_found");
  }

  async listAudit(limit: number): Promise<AuditEntry[]> {
    const { data, error } = await this.db
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    fail(error);
    return (data ?? []).map((r: Row) => ({
      id: String(r.id),
      actor: r.actor_email ?? r.actor_id ?? "unknown",
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      summary: r.summary,
      createdAt: r.created_at,
    }));
  }
}
