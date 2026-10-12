import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const TOTAL = 18; // sample pandals in local mode: 6 areas x 3

const cards = (page: Page) => page.getByTestId("pandal-list").getByTestId("pandal-card");

/** On small screens the area/neighbourhood/verified controls live in a bottom sheet. */
async function withFilters(page: Page, isMobile: boolean, fn: (scope: Page | Locator) => Promise<void>) {
  if (!isMobile) return fn(page);
  await page.getByTestId("open-filters").click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await fn(sheet);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
}

test.describe("home", () => {
  test("redirects to a locale and shows the brand, tagline and sample-data banner", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Discover. Explore. Celebrate.")).toBeVisible();
    await expect(page.getByTestId("demo-banner")).toBeVisible();
  });

  test("home search carries the query to the explore page", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("searchbox").fill("behala");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/en\/explore\?q=behala/);
    await expect(cards(page)).toHaveCount(3);
  });
});

test.describe("search and filters", () => {
  test("lists every pandal, then narrows by search text", async ({ page }) => {
    await page.goto("/en/explore");
    await expect(page.getByTestId("result-count")).toContainText(`${TOTAL} pandals`);
    await expect(cards(page)).toHaveCount(TOTAL);

    await page.getByRole("searchbox", { name: "Search pandals" }).fill("salt lake 2");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Demo Pandal Salt Lake 2");
    await expect(page).toHaveURL(/q=salt\+lake\+2/);

    await page.getByRole("searchbox", { name: "Search pandals" }).fill("no such pandal");
    await expect(page.getByText("No pandals match")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(cards(page)).toHaveCount(TOTAL);
  });

  test("filters by area, neighbourhood and verified-only, and keeps them in a shareable URL", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/en/explore");
    await withFilters(page, isMobile, async (scope) => {
      await scope.getByLabel("Area").selectOption("behala");
    });
    await expect(cards(page)).toHaveCount(3);
    await expect(page).toHaveURL(/region=behala/);

    await withFilters(page, isMobile, async (scope) => {
      await scope.getByLabel("Neighbourhood").selectOption("Parnasree");
    });
    await expect(cards(page)).toHaveCount(1);

    await page.goto("/en/explore?verified=1");
    await expect(cards(page)).toHaveCount(6);
    await expect(page.getByTestId("pandal-list").getByTestId("badge-verified")).toHaveCount(6);
    await expect(page.getByTestId("pandal-list").getByTestId("badge-unverified")).toHaveCount(0);
  });

  test("near-me explains itself when location permission is refused", async ({ page }) => {
    await page.goto("/en/explore");
    await page.getByTestId("near-me").click();
    await expect(page.getByText(/Location permission was declined|could not be determined/)).toBeVisible();
    await expect(cards(page)).toHaveCount(TOTAL);
  });

  test("near-me sorts by distance when permission is granted", async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      permissions: ["geolocation"],
      geolocation: { latitude: 22.498, longitude: 88.314 },
    });
    const page = await context.newPage();
    await page.goto("/en/explore");
    await page.getByTestId("near-me").click();
    await expect(page.getByTestId("result-count")).toContainText("Sorted by distance");
    await expect(cards(page).first()).toContainText("Behala");
    await expect(cards(page).first().getByTestId("distance")).toContainText("straight line");
    expect(page.url()).not.toContain("22.4");
    await context.close();
  });
});

test.describe("map markers", () => {
  test("shows one marker per result and stays in sync with filters", async ({ page, isMobile }) => {
    await page.goto("/en/explore");
    if (isMobile) await page.getByTestId("view-map").click();
    const markers = page.getByTestId("map-marker");
    await expect(markers).toHaveCount(TOTAL);
    await expect(page.getByTestId("map")).toHaveAttribute("data-map-kind", "schematic");

    await page.goto("/en/explore?region=north");
    if (isMobile) await page.getByTestId("view-map").click();
    await expect(page.getByTestId("map-marker")).toHaveCount(3);
  });

  test("selecting a marker reveals that pandal", async ({ page, isMobile }) => {
    await page.goto("/en/explore?region=south");
    if (isMobile) await page.getByTestId("view-map").click();
    await page.getByTestId("map").getByRole("button", { name: "Demo Pandal South 2" }).click();
    if (isMobile) {
      const sheet = page.getByTestId("map-sheet");
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText("Demo Pandal South 2");
      await sheet.getByRole("button", { name: "Close" }).click();
      await expect(sheet).toBeHidden();
    } else {
      await expect(page.locator('[data-testid="pandal-card"][data-selected="true"]')).toContainText(
        "Demo Pandal South 2",
      );
    }
  });
});

test.describe("pandal details", () => {
  test("shows verification metadata and Google Maps navigation", async ({ page }) => {
    await page.goto("/en/explore?q=north+1");
    await cards(page).first().getByRole("link", { name: "Demo Pandal North 1", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/pandals\/demo-north-1$/);
    const detail = page.getByTestId("pandal-detail");
    await expect(detail.getByRole("heading", { level: 1 })).toHaveText("Demo Pandal North 1");
    await expect(detail.getByTestId("badge-verified").first()).toBeVisible();
    await expect(detail.getByTestId("verification")).toContainText("Last verified");
    await expect(detail.getByTestId("verification")).toContainText("1 Jan 2026");
    await expect(detail).toContainText("Confirmed 2026 theme");

    const href = await detail.getByTestId("navigate-link").getAttribute("href");
    const url = new URL(href as string);
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("destination")).toBe("22.600000,88.368000");
    await expect(detail.getByTestId("nearby-list").getByRole("link")).not.toHaveCount(0);
  });

  test("never presents an earlier year's theme as this year's", async ({ page }) => {
    await page.goto("/en/pandals/demo-north-2");
    const detail = page.getByTestId("pandal-detail");
    await expect(detail).toContainText("2025 theme (an earlier year, not this year's)");
    await expect(detail).not.toContainText("Confirmed 2026 theme");
    await expect(detail.getByTestId("badge-needs-review").first()).toBeVisible();
  });

  test("says so when information is unknown instead of guessing", async ({ page }) => {
    await page.goto("/en/pandals/demo-north-3");
    const detail = page.getByTestId("pandal-detail");
    await expect(detail).toContainText("The 2026 theme has not been confirmed.");
    await expect(detail).toContainText("This location has not been verified yet");
    await expect(detail.getByText("Not recorded").first()).toBeVisible();
  });

  test("handles an unknown pandal and an unknown page", async ({ page }) => {
    await page.goto("/en/pandals/does-not-exist");
    await expect(page.getByRole("heading", { name: "Pandal not found" })).toBeVisible();
    await page.goto("/en/nothing/here");
    await expect(page.getByTestId("not-found")).toContainText("Page not found");
  });
});

test.describe("favourites and visited", () => {
  test("saves on the device, survives a reload and can be undone", async ({ page }) => {
    await page.goto("/en/explore?q=central+1");
    const card = cards(page).first();
    await card.getByTestId("favourite-toggle").click();
    await expect(card.getByTestId("favourite-toggle")).toHaveAttribute("aria-pressed", "true");
    await card.getByTestId("visited-toggle").click();

    await page.goto("/en/saved");
    await expect(page.getByTestId("favourites-list").getByTestId("pandal-card")).toHaveCount(1);
    await expect(page.getByTestId("favourites-list")).toContainText("Demo Pandal Central 1");
    await expect(page.getByTestId("visited-progress")).toContainText(`1 of ${TOTAL}`);

    await page.reload();
    await expect(page.getByTestId("favourites-list")).toContainText("Demo Pandal Central 1");
    await page.getByTestId("favourites-list").getByTestId("favourite-toggle").click();
    await expect(page.getByText("No favourites yet")).toBeVisible();
  });
});

test.describe("route planning", () => {
  test("builds, reorders, saves and opens a route in Google Maps", async ({ page }) => {
    await page.goto("/en/plan");
    await expect(page.getByText("No stops yet")).toBeVisible();

    for (const name of ["Demo Pandal North 1", "Demo Pandal North 2", "Demo Pandal North 3"]) {
      await page.getByLabel("Add a pandal").fill(name);
      await page
        .getByTestId("stop-suggestions")
        .getByRole("button", { name: `Add: ${name}` })
        .click();
    }
    const stops = page.getByTestId("plan-stops").getByRole("listitem");
    await expect(stops).toHaveCount(3);
    await expect(page.getByTestId("stop-count")).toHaveText("3/10");
    await expect(page.getByTestId("straight-line")).toContainText(/km|m/);

    await page.getByRole("button", { name: "Move Demo Pandal North 3 earlier" }).click();
    await expect(stops.nth(1)).toContainText("Demo Pandal North 3");
    await expect(page).toHaveURL(/stops=demo-north-1%2Cdemo-north-3%2Cdemo-north-2/);

    const link = page.getByTestId("open-in-maps");
    await expect(link).toHaveCount(1);
    const url = new URL((await link.getAttribute("href")) as string);
    expect(url.searchParams.get("travelmode")).toBe("walking");
    expect(url.searchParams.get("waypoints")?.split("|")).toHaveLength(2);
    expect(url.searchParams.has("origin")).toBe(false);

    await page.getByRole("button", { name: "Remove Demo Pandal North 2" }).click();
    await expect(stops).toHaveCount(2);

    await page.getByLabel("Plan name").fill("North evening");
    await page.getByTestId("save-plan").click();
    await expect(page.getByTestId("plan-message")).toContainText("Plan saved");
    await page.goto("/en/saved");
    await expect(page.getByTestId("saved-plans")).toContainText("North evening");
    await page.getByRole("link", { name: "Open: North evening" }).click();
    await expect(page.getByTestId("plan-stops").getByRole("listitem")).toHaveCount(2);
  });

  test("reports honestly when route estimates are not available", async ({ page }) => {
    await page.goto("/en/plan?stops=demo-south-1,demo-south-2");
    await page.getByTestId("estimate").click();
    await expect(page.getByRole("alert").filter({ hasText: "Route estimates are not set up" })).toBeVisible();
    await expect(page.getByTestId("estimate-result")).toHaveCount(0);
    await expect(page.getByTestId("open-in-maps")).toBeVisible();
  });

  test("splits public transport into one Google Maps link per leg", async ({ page }) => {
    await page.goto("/en/plan?stops=demo-south-1,demo-south-2,demo-south-3&mode=transit");
    await expect(page.getByTestId("open-in-maps")).toHaveCount(3);
    await expect(page.getByTestId("estimate")).toBeDisabled();
    await expect(page.getByText("does not offer multi-stop public transport estimates")).toBeVisible();
  });

  test("enforces the stop limit and skips unknown stops from a shared link", async ({ page }) => {
    const regions = ["north", "central", "south", "salt-lake"];
    const twelve = regions.flatMap((r) => [1, 2, 3].map((n) => `demo-${r}-${n}`));
    await page.goto(`/en/plan?stops=${twelve.join(",")}`);
    await expect(page.getByTestId("plan-stops").getByRole("listitem")).toHaveCount(10);
    await expect(page.getByLabel("Add a pandal")).toBeDisabled();

    await page.goto("/en/plan?stops=demo-north-1,gone-pandal");
    await expect(page.getByTestId("plan-stops").getByRole("listitem")).toHaveCount(1);
    await expect(page.getByText("no longer listed")).toBeVisible();
  });

  test("curated routes cover all six areas and open in the planner", async ({ page }) => {
    await page.goto("/en/routes");
    const routes = page.getByTestId("route-card");
    await expect(routes).toHaveCount(6);
    for (const area of ["North Kolkata", "Central Kolkata", "South Kolkata", "Salt Lake", "Dum Dum", "Behala"]) {
      await expect(routes.filter({ hasText: area }).first()).toBeVisible();
    }
    await page.getByRole("link", { name: "Open in planner: Salt Lake blocks" }).click();
    await expect(page.getByTestId("plan-stops").getByRole("listitem")).toHaveCount(3);
    const url = new URL((await page.getByTestId("open-in-maps").getAttribute("href")) as string);
    expect(url.searchParams.get("origin")).toContain("Karunamoyee Metro Station");
    expect(url.searchParams.get("travelmode")).toBe("driving");
  });

  test("a pandal can be added to the plan from its card", async ({ page }) => {
    await page.goto("/en/explore?q=dum+dum+1");
    await cards(page).first().getByTestId("plan-toggle").click();
    await page.goto("/en/plan");
    await expect(page.getByTestId("plan-stops")).toContainText("Demo Pandal Dum Dum 1");
  });
});

test.describe("API error handling", () => {
  test("route estimate endpoint validates input and degrades without a key", async ({ request }) => {
    expect((await request.post("/api/routes/estimate", { data: { stops: [], mode: "walk" } })).status()).toBe(400);
    expect(
      (
        await request.post("/api/routes/estimate", {
          data: "not json",
          headers: { "content-type": "application/json" },
        })
      ).status(),
    ).toBe(400);
    const unknown = await request.post("/api/routes/estimate", { data: { stops: ["nope-1", "nope-2"], mode: "walk" } });
    expect(unknown.status()).toBe(422);
    const res = await request.post("/api/routes/estimate", {
      data: { stops: ["demo-north-1", "demo-north-2"], mode: "walk" },
    });
    expect(res.status()).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(res.headers()["cache-control"]).toBe("no-store");
  });

  test("search endpoint filters and rejects bad input", async ({ request }) => {
    const ok = await request.get("/api/pandals?q=behala&verified=1");
    expect(ok.status()).toBe(200);
    expect((await ok.json()).results).toHaveLength(1);
    const near = await (await request.get("/api/pandals?lat=22.6&lng=88.368&radius=1500")).json();
    expect(near.results[0].slug).toBe("demo-north-1");
    expect(near.results[0].distance_m).toBe(0);
    expect((await request.get("/api/pandals?lat=22.6")).status()).toBe(400);
    expect((await request.get("/api/pandals?region=mars")).status()).toBe(400);
  });
});

test.describe("language and accessibility", () => {
  test("Bengali pages are translated and the switch keeps the current filters", async ({ page }) => {
    await page.goto("/bn/explore?region=south");
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("মণ্ডপ খুঁজুন");
    await expect(cards(page)).toHaveCount(3);
    await page.getByTestId("language-switch").click();
    await expect(page).toHaveURL(/\/en\/explore\?region=south/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Explore pandals");
  });

  test("keyboard users can skip to the content and reach map markers", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard navigation is a desktop concern");
    await page.goto("/en/explore?region=behala");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    const marker = page.getByTestId("map").getByRole("button", { name: "Demo Pandal Behala 1" });
    await marker.focus();
    await page.keyboard.press("Enter");
    await expect(marker).toHaveAttribute("aria-pressed", "true");
  });

  for (const path of [
    "/en",
    "/en/explore",
    "/en/pandals/demo-north-1",
    "/en/plan?stops=demo-north-1,demo-north-2",
    "/en/routes",
    "/en/saved",
    "/en/submit",
    "/bn",
  ]) {
    test(`no automatically detectable WCAG A/AA violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual(
        [],
      );
    });
  }
});

test.describe("mobile layout", () => {
  test("has no horizontal overflow and offers the tab bar and map/list toggle", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-only checks");
    for (const path of [
      "/en",
      "/en/explore",
      "/en/pandals/demo-north-1",
      "/en/plan?stops=demo-north-1,demo-north-2",
      "/en/routes",
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
    await page.goto("/en/explore");
    await expect(page.getByRole("navigation", { name: "Primary" }).last()).toBeVisible();
    await expect(page.getByTestId("view-map")).toBeVisible();
    await page.getByTestId("view-map").click();
    await expect(page.getByTestId("map")).toBeVisible();
    await expect(page.getByTestId("pandal-list")).toBeHidden();
    const box = await page.getByTestId("map-marker").first().boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});
