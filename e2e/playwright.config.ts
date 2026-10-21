import { defineConfig, devices } from '@playwright/test';
import { ANON_KEY, APP_PORT, APP_URL, BACKEND_URL } from './support/env.ts';

const CI = Boolean(process.env.CI);

/** The app is built against the fake backend, never production (see README.md). */
const BUILD_ENV = {
  VITE_SUPABASE_URL: BACKEND_URL,
  VITE_SUPABASE_ANON_KEY: ANON_KEY,
  VITE_API_URL: BACKEND_URL,
};

/** A Chromium already on the machine (e.g. a container without `playwright install`). */
const executablePath = process.env.E2E_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 3 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: CI
    ? [['github'], ['list'], ['html', { open: 'never' }], ['json', { outputFile: 'results.json' }]]
    : [['list']],
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: 'phone-pt-BR',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
      },
    },
    {
      // The screen checks (smoke, click audit, axe) only: the flows are covered on the phone.
      name: 'desktop-en',
      testMatch: /screens\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        locale: 'en',
        timezoneId: 'Europe/Berlin',
      },
    },
  ],
  // Started one after the other, each once its URL answers.
  webServer: [
    {
      // The fake validates rows with @wayfare/shared, so the workspace packages are built first
      // (shared, i18n: also what the app needs).
      command: [
        'pnpm -w exec turbo run build --filter=@wayfare/e2e^... --filter=@wayfare/web^...',
        'node --experimental-strip-types --no-warnings fake-backend/cli.ts',
      ].join(' && '),
      url: `${BACKEND_URL}/__admin/health`,
      reuseExistingServer: !CI,
      stdout: 'pipe',
      timeout: 120_000,
    },
    {
      // Into its own folder, so a local production build in apps/web/dist is never overwritten.
      command: [
        'pnpm --filter @wayfare/web exec vite build --outDir dist-e2e --emptyOutDir',
        `pnpm --filter @wayfare/web exec vite preview --outDir dist-e2e --port ${APP_PORT} --strictPort`,
      ].join(' && '),
      url: APP_URL,
      env: BUILD_ENV,
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
  ],
});
