// Kurztest gegen die veröffentlichte App – läuft nach „Live freigeben“ (LIVE_URL=https://vokabel-studio.github.io/)
import { test, expect, geh, profilAnlegen } from './helfer.js';

test('Live-App startet mit der freigegebenen Version', async ({ page }) => {
  await geh(page, '');
  await expect(page.getByText('Willkommen bei Vokabel-Studio')).toBeVisible();
  await profilAnlegen(page, 'Livetest');
  await geh(page, 'einstellungen');
  if (process.env.ERWARTETE_VERSION) await expect(page.getByText(`Version ${process.env.ERWARTETE_VERSION}`)).toBeVisible();
  await geh(page, 'bibliothek');
  await page.click('#demo-laden');
  await expect(page.locator('#toast')).toContainText('Beispiel-Vokabeln geladen');
});
