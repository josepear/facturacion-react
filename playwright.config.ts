import { defineConfig, devices } from "@playwright/test";

import { e2eEnv } from "./e2e/env";
import { USER_STORAGE_PATH } from "./e2e/authStorage";

const baseURL = e2eEnv.baseUrl;
const port = e2eEnv.port;
const apiTarget = e2eEnv.apiTarget;
const nodeExecPath = process.env.E2E_NODE_PATH || "node";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  globalSetup: "./e2e/global-setup.ts",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `E2E_API_TARGET=${apiTarget} "${nodeExecPath}" ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: USER_STORAGE_PATH,
      },
    },
  ],
});
