import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30000,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8787",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    {name:"chromium",use:{...devices["Desktop Chrome"]}},
    {name:"firefox",use:{...devices["Desktop Firefox"]}},
    {name:"webkit",use:{...devices["Desktop Safari"]}}
  ],
  webServer: {
    command: "python3 -m http.server 8787 --bind 127.0.0.1 --directory dist",
    url: "http://127.0.0.1:8787/",
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
