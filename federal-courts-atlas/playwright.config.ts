import { defineConfig, devices } from '@playwright/test';

// Screenshot + smoke tests at desktop and mobile widths. Uses the browsers
// pre-installed under /opt/pw-browsers (@playwright/test pinned to 1.63.0).
const PORT = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 2,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: 'retain-on-failure',
    colorScheme: 'light',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    // Each port builds into its own folder, so two lanes can run the suite at once without clobbering dist/.
    // --bypass-lock: Vite 8 otherwise refuses a second `vite preview` while another lane's server is running.
    command: `npx vite build --outDir .e2e-dist/${PORT} --emptyOutDir && npx vite preview --outDir .e2e-dist/${PORT} --port ${PORT} --strictPort --host 127.0.0.1 --bypass-lock`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
