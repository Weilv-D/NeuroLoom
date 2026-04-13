import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/studio/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.02
    }
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1536, height: 1060 },
    colorScheme: "dark"
  },
  webServer: {
    command: "pnpm --filter @neuroloom/studio preview --host 127.0.0.1 --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
