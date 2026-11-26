// Gutscheine der Eltern: anlegen, freischalten, nur mit PIN einlösen
import { test, expect, geh, profilAnlegen, demoLaden, alle, elternPinSetzen, testRichtigMachen } from './helfer.js';

test('Gutschein anlegen, durch Test freischalten, mit PIN einlösen', async ({ page }) => {
  await profilAnlegen(page, 'Lena', { latein: true });
  await demoLaden(page);
  await elternPinSetzen(page, '4711');
  await page.click('#gs-neu');
  await page.fill('#gs-text', 'Eis essen gehen');
  await page.click('#gs-emojis [data-e="🍦"]');
  await page.selectOption('#gs-art', 'tests');
  await page.fill('#gs-anzahl', '2');
  await page.click('#gs-save');
  await expect(page.locator('#gs-karte')).toContainText('Eis essen gehen');

  const [en, la] = await alle(page, 'units');
  await testRichtigMachen(page, en.id);
  await expect(page.locator('.gs-overlay')).toHaveCount(0);
  // derselbe Test am selben Tag zählt nicht doppelt
  await testRichtigMachen(page, en.id);
  await expect(page.locator('.gs-overlay')).toHaveCount(0);
  await testRichtigMachen(page, la.id);
  await expect(page.locator('.gs-overlay')).toContainText('Eis essen gehen');
  await page.locator('.gs-overlay button').click();

  await geh(page, 'home');
  await expect(page.getByText('Du hast einen Gutschein zum Einlösen')).toBeVisible();
  await geh(page, 'erfolge');
  await page.click('[data-einloesen]');
  await page.fill('.gs-pin input', '0000');
  await page.locator('.gs-pin .btn').first().click();
  await expect(page.locator('#toast')).toContainText('Falsche PIN');
  await page.fill('.gs-pin input', '4711');
  await page.locator('.gs-pin .btn').first().click();
  await expect(page.locator('#toast')).toContainText('Eingelöst');
  const b = (await alle(page, 'belohnungen'))[0];
  expect(b.freigeschaltet).toHaveLength(1);
  expect(b.freigeschaltet[0].eingeloestAm).toBeTruthy();
});

test('Eltern-Bereich sperrt sich beim Verlassen', async ({ page }) => {
  await profilAnlegen(page);
  await elternPinSetzen(page);
  await geh(page, 'home');
  await geh(page, 'eltern');
  await expect(page.locator('#el-pin')).toBeVisible();
});
