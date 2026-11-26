// Gutscheine der Eltern: anlegen, freischalten, nur mit PIN einlösen
import { test, expect, geh, profilAnlegen, demoLaden, alle, app, elternPinSetzen, testRichtigMachen } from './helfer.js';

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
  // eigene Seite „Meine Gutscheine“, erreichbar von der Startseite
  await page.getByRole('link', { name: /Meine Gutscheine/ }).click();
  await expect(page.getByRole('heading', { name: /Bereit zum Einlösen/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Auf dem Weg/ })).toBeVisible();
  // das Kind löst selbst ein (ohne PIN, mit Rückfrage)
  await page.getByRole('button', { name: /Eis essen gehen als eingelöst markieren/ }).click();
  await expect(page.locator('#toast')).toContainText('Eingelöst');
  await expect(page.getByRole('heading', { name: /Schon eingelöst \(1\)/ })).toBeVisible();
  const b = (await alle(page, 'belohnungen'))[0];
  expect(b.freigeschaltet).toHaveLength(1);
  expect(b.freigeschaltet[0].eingeloestAm).toBeTruthy();
});

test('Eltern markieren einen Gutschein als eingelöst', async ({ page }) => {
  await profilAnlegen(page, 'Tim');
  await app(page, async (m) => {
    const p = (await m.db.all('profile'))[0];
    await m.G.erstelle([p.id], { text: 'Kino', emoji: '🎬', art: 'punkte', anzahl: 1, minProzent: 75, wiederholen: false });
    await m.B.nachSitzung(p.id, {});
    await m.G.pruefe(p.id);
  });
  await elternPinSetzen(page);
  await expect(page.locator('#gs-karte')).toContainText('Kino');
  await page.click('[data-gs-ein]');
  await expect(page.locator('#toast')).toContainText('eingelöst');
  await expect(page.locator('#gs-karte')).toContainText('Schon eingelöst (1)');
  await geh(page, 'gutscheine');
  await expect(page.getByRole('heading', { name: /Schon eingelöst \(1\)/ })).toBeVisible();
});

test('Eltern-Bereich sperrt sich beim Verlassen', async ({ page }) => {
  await profilAnlegen(page);
  await elternPinSetzen(page);
  await geh(page, 'home');
  await geh(page, 'eltern');
  await expect(page.locator('#el-pin')).toBeVisible();
});
