// Captures reference screenshots of the main screens against a running server.
// Usage: node tests/screenshots.mjs <baseURL> <outDir>
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const [baseURL = "http://localhost:3000", outDir = "screenshots"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const shots = [
  ["home", "/en", {}],
  ["explore", "/en/explore", {}],
  ["detail", "/en/pandals/demo-north-1", {}],
  ["plan", "/en/plan?stops=demo-south-1,demo-south-2,demo-south-3", {}],
  ["routes", "/en/routes", {}],
  ["home-bn", "/bn", {}],
];

const browser = await chromium.launch();
for (const [device, label] of [
  [devices["Desktop Chrome"], "desktop"],
  [devices["Pixel 7"], "mobile"],
]) {
  const context = await browser.newContext({ ...device, baseURL });
  const page = await context.newPage();
  for (const [name, path] of shots) {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${outDir}/${label}-${name}.png`, fullPage: name !== "explore" });
  }
  if (label === "mobile") {
    await page.goto("/en/explore?region=south", { waitUntil: "networkidle" });
    await page.getByTestId("view-map").click();
    await page.getByTestId("map").getByRole("button", { name: "Demo Pandal South 2" }).click();
    await page.screenshot({ path: `${outDir}/${label}-map-sheet.png` });
  }
  await context.close();
}
await browser.close();
