// Offline-Start: braucht den Offline-Speicher (Service Worker), der in den übrigen Tests abgeschaltet ist
import { test, expect, geh } from './helfer.js';

test.use({ serviceWorkers: 'allow' });

test('App startet auch ohne Internet', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service Worker im Test nur mit Chromium zuverlässig');
  await geh(page, '');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByText('Willkommen bei Vokabel-Studio')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Willkommen bei Vokabel-Studio')).toBeVisible();
  await context.setOffline(false);
});
