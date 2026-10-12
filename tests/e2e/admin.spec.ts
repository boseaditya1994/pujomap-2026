import { expect, test, type Page } from "@playwright/test";
import { CSV_COLUMNS } from "../../src/lib/domain/csv";

// These tests share one in-memory dataset and build on each other.
test.describe.configure({ mode: "serial" });

const token = process.env.PUJOMAP_DEV_ADMIN_TOKEN as string;

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Development admin token").fill(token);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

const csvRow = (values: Record<string, string>) => CSV_COLUMNS.map((c) => values[c] ?? "").join(",");
const csvFile = (name: string, rows: Record<string, string>[]) => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from([CSV_COLUMNS.join(","), ...rows.map(csvRow)].join("\n")),
});

test.describe("admin authorisation", () => {
  test("signed-out visitors are sent to the login page from every admin screen", async ({ page }) => {
    for (const path of [
      "/admin",
      "/admin/pandals",
      "/admin/pandals/new",
      "/admin/pandals/demo-north-1",
      "/admin/import",
      "/admin/routes",
      "/admin/submissions",
      "/admin/audit",
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/admin\/login$/);
    }
    await expect(page.getByTestId("admin-pandal-table")).toHaveCount(0);
  });

  test("admin API refuses signed-out requests and forged cookies", async ({ request, browser, baseURL }) => {
    expect((await request.get("/api/admin/csv-template")).status()).toBe(401);
    const context = await browser.newContext({ baseURL });
    await context.addCookies([{ name: "pujomap_dev_admin", value: "f".repeat(64), url: baseURL as string }]);
    const page = await context.newPage();
    await page.goto("/admin/pandals");
    await expect(page).toHaveURL(/\/admin\/login$/);
    expect((await context.request.get("/api/admin/csv-template")).status()).toBe(401);
    await context.close();
  });

  test("a wrong token is rejected", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Development admin token").fill("definitely-not-the-token");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "not correct" })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

test.describe("admin workflows", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("validates, creates and publishes a pandal", async ({ page }) => {
    await page.goto("/admin/pandals/new");
    await page.getByLabel("Name *").fill("E2E Test Pandal");
    await page.getByLabel("Address *").fill("1 Test Street, Kolkata");
    await page.getByLabel("Latitude *").fill("28.6139"); // Delhi: outside the allowed area
    await page.getByLabel("Longitude *").fill("88.40");
    await page.getByLabel("Neighbourhood *").fill("Testpara");
    await page.getByLabel("Theme title").fill("Last year's idea");
    await page.getByLabel("Theme year").fill("2025");
    await page.getByLabel("Theme status").selectOption("confirmed");
    await page.getByLabel("Theme source").fill("https://example.org/announcement");
    await page.getByRole("button", { name: "Create pandal" }).click();

    const form = page.getByTestId("pandal-form");
    await expect(form.getByText("Latitude is outside Greater Kolkata")).toBeVisible();
    await expect(form.getByText("Only a 2026 theme can be confirmed")).toBeVisible();

    await page.getByLabel("Latitude *").fill("22.57");
    await expect(
      page.getByTestId("pin-check").getByRole("link", { name: "Open these coordinates in Google Maps" }),
    ).toBeVisible();
    await page.getByLabel("Theme status").selectOption("unknown");
    await page.getByRole("button", { name: "Create pandal" }).click();
    await expect(page).toHaveURL(/\/admin\/pandals\?saved=1/);
    await expect(page.getByTestId("admin-pandal-table")).toContainText("E2E Test Pandal");

    // The public directory reflects the change straight away.
    await page.goto("/en/explore?q=e2e+test");
    await expect(page.getByTestId("pandal-list").getByTestId("pandal-card")).toHaveCount(1);
    await page.goto("/en/pandals/e2e-test-pandal");
    await expect(page.getByTestId("pandal-detail")).toContainText("2025 theme (an earlier year");
    await expect(page.getByTestId("pandal-detail").getByTestId("badge-unverified").first()).toBeVisible();
  });

  test("edits and then deletes a pandal", async ({ page }) => {
    await page.goto("/admin/pandals?q=e2e");
    await page.getByRole("link", { name: "E2E Test Pandal" }).click();
    await page.getByLabel("Verification status").selectOption("verified");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByTestId("pandal-form").getByText("A verified pandal needs a verification source"),
    ).toBeVisible();
    await page.getByLabel("Verification source").fill("Site visit by the test suite");
    await page.getByLabel("Last verified date").fill("2026-10-10");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/saved=1/);
    await page.goto("/en/pandals/e2e-test-pandal");
    await expect(page.getByTestId("verification")).toContainText("Site visit by the test suite");

    await page.goto("/admin/pandals?q=e2e");
    await page.getByRole("link", { name: "E2E Test Pandal" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete pandal" }).click();
    await expect(page).toHaveURL(/deleted=1/);
    await page.goto("/en/pandals/e2e-test-pandal");
    await expect(page.getByRole("heading", { name: "Pandal not found" })).toBeVisible();
  });

  test("CSV import rejects an invalid file as a whole, then imports a valid one", async ({ page }) => {
    const good = {
      name: "CSV Pandal One",
      address: "2 CSV Road",
      latitude: "22.55",
      longitude: "88.35",
      neighbourhood: "Csvpara",
      region: "south",
    };
    await page.goto("/admin/import");
    // The file picker previews in the browser, so wait until the page is interactive.
    await page.waitForLoadState("networkidle");
    await page.getByTestId("csv-file").setInputFiles(
      csvFile("bad.csv", [
        good,
        { ...good, name: "CSV Pandal Two", latitude: "north-ish" },
        {
          ...good,
          name: "CSV Pandal Three",
          theme_status: "confirmed",
          theme_title: "Old",
          theme_year: "2024",
          theme_source: "x",
        },
      ]),
    );
    await expect(page.getByRole("alert").filter({ hasText: "Nothing will be imported" })).toBeVisible();
    await expect(page.getByTestId("csv-errors")).toContainText("latitude");
    await expect(page.getByTestId("csv-errors")).toContainText("theme_year");
    await expect(page.getByTestId("csv-import")).toBeDisabled();

    await page.getByTestId("csv-file").setInputFiles(csvFile("good.csv", [good, { ...good, name: "CSV Pandal Two" }]));
    await expect(page.getByTestId("csv-import")).toHaveText("Import 2 rows");
    await page.getByTestId("csv-import").click();
    await expect(page.getByText("Import complete: 2 created, 0 updated.")).toBeVisible();

    await page.goto("/en/explore?q=csv+pandal");
    await expect(page.getByTestId("pandal-list").getByTestId("pandal-card")).toHaveCount(2);
    await expect(page.getByTestId("pandal-list").getByTestId("badge-unverified")).toHaveCount(2);
  });

  test("a community submission is queued for review and can be decided", async ({ page }) => {
    await page.goto("/en/submit?pandal=demo-south-1&type=theme_correction");
    await expect(page.getByLabel("What would you like to do?")).toHaveValue("theme_correction");
    await page.getByRole("button", { name: "Send suggestion" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "check the highlighted fields" })).toBeVisible();
    await page.getByLabel("Details").fill("The committee announced a different theme this week.");
    await page.getByLabel(/Source link/).fill("https://example.org/post");
    await page.getByRole("button", { name: "Send suggestion" }).click();
    await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();

    // Nothing changes publicly until an admin acts.
    await page.goto("/admin/submissions");
    const item = page.getByTestId("submission-list").getByRole("listitem").filter({ hasText: "Demo Pandal South 1" });
    await expect(item).toContainText("Correct a theme");
    await expect(item).toContainText("different theme this week");
    await item.getByLabel("Review note (optional)").fill("Could not confirm");
    await item.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByText("No pending submissions.")).toBeVisible();
    await page.goto("/admin/submissions?status=rejected");
    await expect(page.getByTestId("submission-list")).toContainText("Could not confirm");
  });

  test("curated routes can be edited and the audit log records every change", async ({ page }) => {
    await page.goto("/admin/routes");
    await page.getByRole("link", { name: /Behala trail/ }).click();
    await page.getByRole("button", { name: "Remove Demo Pandal Behala 3" }).click();
    await page.getByRole("button", { name: "Save route" }).click();
    await expect(page).toHaveURL(/\/admin\/routes\?saved=1/);
    await page.goto("/en/routes");
    await expect(page.getByTestId("route-card").filter({ hasText: "Behala trail" })).toContainText("2 stops");

    await page.goto("/admin/audit");
    const log = page.getByTestId("audit-table");
    for (const entry of [
      'Created "E2E Test Pandal"',
      'Deleted "E2E Test Pandal"',
      "CSV import: 2 created, 0 updated",
      "rejected",
      'Updated route "Behala trail"',
    ]) {
      await expect(log).toContainText(entry);
    }
    await expect(log).toContainText("dev-admin@localhost");
  });

  test("signing out ends access", async ({ page }) => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin/pandals");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
