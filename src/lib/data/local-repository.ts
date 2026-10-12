import type {
  Actor,
  AuditEntry,
  CuratedRoute,
  CuratedRouteInput,
  Pandal,
  PandalInput,
  Submission,
  SubmissionInput,
  SubmissionStatus,
} from "@/lib/domain/types";
import { buildDemoPandals, buildDemoRoutes } from "./demo-data";
import { RepositoryError, type AdminRepository, type PublicRepository } from "./repository";

type Store = {
  pandals: Pandal[];
  routes: CuratedRoute[];
  submissions: Submission[];
  audit: AuditEntry[];
};

// Kept on globalThis so the store survives dev-server module reloads. It is
// process memory: restarting the server resets it to the sample data.
const g = globalThis as unknown as { __pujomapStore?: Store };

function store(): Store {
  if (!g.__pujomapStore) {
    const pandals = buildDemoPandals();
    g.__pujomapStore = { pandals, routes: buildDemoRoutes(pandals), submissions: [], audit: [] };
  }
  return g.__pujomapStore;
}

const now = () => new Date().toISOString();
const clone = <T>(v: T): T => structuredClone(v);

function audit(actor: Actor, action: string, entityType: string, entityId: string | null, summary: string) {
  store().audit.unshift({
    id: crypto.randomUUID(),
    actor: actor.email,
    action,
    entityType,
    entityId,
    summary,
    createdAt: now(),
  });
}

function assertSlugFree(slug: string, exceptId?: string) {
  if (store().pandals.some((p) => p.slug === slug && p.id !== exceptId)) {
    throw new RepositoryError(`A pandal with slug "${slug}" already exists`, "conflict");
  }
}

export class LocalRepository implements PublicRepository, AdminRepository {
  async listPandals() {
    return clone(store().pandals.filter((p) => p.published));
  }

  async listCuratedRoutes() {
    return clone(store().routes.filter((r) => r.published));
  }

  async createSubmission(input: SubmissionInput) {
    store().submissions.unshift({
      ...input,
      id: crypto.randomUUID(),
      status: "pending",
      reviewNote: null,
      createdAt: now(),
      reviewedAt: null,
    });
  }

  async listAllPandals() {
    return clone(store().pandals);
  }

  async getPandal(id: string) {
    const p = store().pandals.find((x) => x.id === id);
    return p ? clone(p) : null;
  }

  async createPandal(input: PandalInput, actor: Actor) {
    assertSlugFree(input.slug);
    const pandal: Pandal = { ...input, id: crypto.randomUUID(), isDemo: false, updatedAt: now() };
    store().pandals.push(pandal);
    audit(actor, "create", "pandal", pandal.id, `Created "${pandal.name}"`);
    return clone(pandal);
  }

  async updatePandal(id: string, input: PandalInput, actor: Actor) {
    const s = store();
    const i = s.pandals.findIndex((p) => p.id === id);
    if (i < 0) throw new RepositoryError("Pandal not found", "not_found");
    assertSlugFree(input.slug, id);
    s.pandals[i] = { ...s.pandals[i], ...input, updatedAt: now() };
    audit(actor, "update", "pandal", id, `Updated "${input.name}"`);
    return clone(s.pandals[i]);
  }

  async deletePandal(id: string, actor: Actor) {
    const s = store();
    const p = s.pandals.find((x) => x.id === id);
    if (!p) throw new RepositoryError("Pandal not found", "not_found");
    s.pandals = s.pandals.filter((x) => x.id !== id);
    s.routes = s.routes.map((r) => ({ ...r, stopPandalIds: r.stopPandalIds.filter((x) => x !== id) }));
    audit(actor, "delete", "pandal", id, `Deleted "${p.name}"`);
  }

  async importPandals(rows: PandalInput[], actor: Actor) {
    const s = store();
    let created = 0;
    let updated = 0;
    const next = [...s.pandals];
    for (const row of rows) {
      const i = next.findIndex((p) => p.slug === row.slug);
      if (i >= 0) {
        // A CSV carries no image columns, so existing images are kept.
        next[i] = { ...next[i], ...row, images: next[i].images, updatedAt: now() };
        updated++;
      } else {
        next.push({ ...row, id: crypto.randomUUID(), isDemo: false, updatedAt: now() });
        created++;
      }
    }
    s.pandals = next;
    audit(actor, "import", "pandal", null, `CSV import: ${created} created, ${updated} updated`);
    return { created, updated };
  }

  async listAllCuratedRoutes() {
    return clone(store().routes);
  }

  async saveCuratedRoute(id: string | null, input: CuratedRouteInput, actor: Actor) {
    const s = store();
    if (s.routes.some((r) => r.slug === input.slug && r.id !== id)) {
      throw new RepositoryError(`A route with slug "${input.slug}" already exists`, "conflict");
    }
    const known = new Set(s.pandals.map((p) => p.id));
    const stopPandalIds = input.stopPandalIds.filter((x) => known.has(x));
    if (id) {
      const i = s.routes.findIndex((r) => r.id === id);
      if (i < 0) throw new RepositoryError("Route not found", "not_found");
      s.routes[i] = { ...s.routes[i], ...input, stopPandalIds, updatedAt: now() };
      audit(actor, "update", "curated_route", id, `Updated route "${input.title}"`);
      return clone(s.routes[i]);
    }
    const route: CuratedRoute = { ...input, stopPandalIds, id: crypto.randomUUID(), updatedAt: now() };
    s.routes.push(route);
    audit(actor, "create", "curated_route", route.id, `Created route "${route.title}"`);
    return clone(route);
  }

  async deleteCuratedRoute(id: string, actor: Actor) {
    const s = store();
    const r = s.routes.find((x) => x.id === id);
    if (!r) throw new RepositoryError("Route not found", "not_found");
    s.routes = s.routes.filter((x) => x.id !== id);
    audit(actor, "delete", "curated_route", id, `Deleted route "${r.title}"`);
  }

  async listSubmissions(status?: SubmissionStatus) {
    return clone(store().submissions.filter((x) => !status || x.status === status));
  }

  async reviewSubmission(id: string, status: Exclude<SubmissionStatus, "pending">, note: string | null, actor: Actor) {
    const sub = store().submissions.find((x) => x.id === id);
    if (!sub) throw new RepositoryError("Submission not found", "not_found");
    sub.status = status;
    sub.reviewNote = note;
    sub.reviewedAt = now();
    audit(
      actor,
      status === "accepted" ? "accept" : "reject",
      "submission",
      id,
      `Submission about "${sub.pandalName}" ${status}`,
    );
  }

  async listAudit(limit: number) {
    return clone(store().audit.slice(0, limit));
  }
}
