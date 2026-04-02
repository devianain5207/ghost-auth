import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 120000,
  use: {
    baseURL: "http://127.0.0.1:1420",
    headless: true,
    navigationTimeout: 45000,
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 1420",
    port: 1420,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
