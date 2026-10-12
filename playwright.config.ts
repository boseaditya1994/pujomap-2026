import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

// A throwaway admin token for this run only. Worker processes inherit it from the
// environment, so every process sees the same value and it is never written to disk.
process.env.PUJOMAP_DEV_ADMIN_TOKEN ??= randomBytes(24).toString("hex");

/**
 * End-to-end tests run against a production build in local mode: no Supabase,
 * no Google keys, sample data only. That exercises the fallbacks (schematic
 * map, "estimates not configured") and never touches a paid service.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 45_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "en-IN",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /admin\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: /admin\.spec\.ts/ },
    // Admin tests change the shared in-memory data, so they run after everything else.
    {
      name: "admin",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /admin\.spec\.ts/,
      dependencies: ["desktop", "mobile"],
    },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/en`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      PUJOMAP_DEV_ADMIN_TOKEN: process.env.PUJOMAP_DEV_ADMIN_TOKEN,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "",
      GOOGLE_ROUTES_API_KEY: "",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    },
  },
});
