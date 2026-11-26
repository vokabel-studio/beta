// Automatische Tests (Playwright). Lokal: npm test  ·  nur Android-Profil: npm run test:android
// Mit LIVE_URL=… laufen nur die Kurztests gegen die veröffentlichte App (nach „Live freigeben“).
import { defineConfig, devices } from '@playwright/test';

const LIVE = process.env.LIVE_URL;
const PORT = 4173;

export default defineConfig({
  testDir: 'tests',
  testMatch: LIVE ? /live\.spec\.js/ : /\.spec\.js/,
  testIgnore: LIVE ? [] : [/live\.spec\.js/],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: LIVE || `http://localhost:${PORT}/`,
    trace: process.env.CI ? 'retain-on-failure' : 'off',
    locale: 'de-DE',
    // Offline-Speicher (Service Worker) in den Tests aus – sonst kann WebKit nachgebaute Antworten nicht einspielen.
    // Der Offline-Test schaltet ihn gezielt wieder ein (tests/offline.spec.js).
    serviceWorkers: 'block',
    timezoneId: 'Europe/Berlin'
  },
  projects: LIVE
    ? [{ name: 'android', use: { ...devices['Pixel 7'] } }]
    : [
        { name: 'android', use: { ...devices['Pixel 7'] } },
        { name: 'iphone', use: { ...devices['iPhone 13'] } }
      ],
  webServer: LIVE ? undefined : {
    command: `node tests/server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI
  }
});
