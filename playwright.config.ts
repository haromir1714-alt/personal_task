import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        locale: "ko-KR",
        timezoneId: "Asia/Seoul",
      },
    },
  ],
  webServer: {
    command: "npm run build && npm start",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
