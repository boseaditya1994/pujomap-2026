import { beforeEach, describe, expect, it } from "vitest";
import { LocalRepository } from "@/lib/data/local-repository";
import { pandalInputSchema } from "@/lib/domain/types";

const actor = { id: "t", email: "tester@example.org" };
const input = (over: Record<string, unknown> = {}) =>
  pandalInputSchema.parse({
    name: "Repo Test",
    slug: "repo-test",
    address: "1 Test Road",
    lat: 22.57,
    lng: 88.36,
    neighbourhood: "Test",
    region: "central",
    ...over,
  });

describe("local repository", () => {
  let repo: LocalRepository;
  beforeEach(() => {
    delete (globalThis as { __pujomapStore?: unknown }).__pujomapStore;
    repo = new LocalRepository();
  });

  it("serves only flagged sample data, including six curated routes", async () => {
    const pandals = await repo.listPandals();
    expect(pandals.length).toBeGreaterThan(0);
    expect(pandals.every((p) => p.isDemo && p.name.startsWith("Demo Pandal"))).toBe(true);
    expect((await repo.listCuratedRoutes()).map((r) => r.region).sort()).toEqual([
      "behala",
      "central",
      "dum-dum",
      "north",
      "salt-lake",
      "south",
    ]);
  });
  it("creates, updates and deletes with an audit trail", async () => {
    const created = await repo.createPandal(input(), actor);
    expect(created.isDemo).toBe(false);
    await expect(repo.createPandal(input(), actor)).rejects.toMatchObject({ code: "conflict" });
    await repo.updatePandal(created.id, input({ name: "Renamed" }), actor);
    expect((await repo.getPandal(created.id))?.name).toBe("Renamed");
    await repo.deletePandal(created.id, actor);
    expect(await repo.getPandal(created.id)).toBeNull();
    expect((await repo.listAudit(10)).map((a) => a.action)).toEqual(["delete", "update", "create"]);
  });
  it("hides unpublished pandals from visitors but not from admins", async () => {
    const p = await repo.createPandal(input({ published: false }), actor);
    expect((await repo.listPandals()).some((x) => x.id === p.id)).toBe(false);
    expect((await repo.listAllPandals()).some((x) => x.id === p.id)).toBe(true);
  });
  it("upserts imports by slug", async () => {
    expect(await repo.importPandals([input(), input({ slug: "second", name: "Second" })], actor)).toEqual({
      created: 2,
      updated: 0,
    });
    expect(await repo.importPandals([input({ name: "Changed" })], actor)).toEqual({ created: 0, updated: 1 });
  });
  it("removes a deleted pandal from curated routes", async () => {
    const [route] = await repo.listAllCuratedRoutes();
    const victim = route.stopPandalIds[0];
    await repo.deletePandal(victim, actor);
    const after = (await repo.listAllCuratedRoutes()).find((r) => r.id === route.id);
    expect(after?.stopPandalIds).not.toContain(victim);
  });
  it("queues submissions as pending and records the review", async () => {
    await repo.createSubmission({
      type: "new_pandal",
      pandalId: null,
      pandalName: "X Pandal",
      details: "Somewhere specific",
      sourceUrl: null,
      lat: null,
      lng: null,
      contactEmail: null,
    });
    const [sub] = await repo.listSubmissions("pending");
    await repo.reviewSubmission(sub.id, "rejected", "Duplicate", actor);
    expect(await repo.listSubmissions("pending")).toHaveLength(0);
    expect((await repo.listSubmissions("rejected"))[0].reviewNote).toBe("Duplicate");
  });
});
