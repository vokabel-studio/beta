// Sicherung erstellen/laden – und vor allem: Sicherungen aus älteren Versionen müssen weiter funktionieren
import { test, expect, geh, profilAnlegen, demoLaden, alle, app, ALTE_SICHERUNG, elternPinSetzen } from './helfer.js';

async function sicherungLadenAufLeeremGeraet(page, inhalt, name = 'sicherung.json') {
  await geh(page, '');
  await expect(page.getByText('Willkommen bei Vokabel-Studio')).toBeVisible();
  await page.setInputFiles('#pv-sicherung', { name, mimeType: 'application/json', buffer: Buffer.from(inhalt) });
  await expect(page.locator('#pv-info')).toContainText('Sicherung vom');
  await page.click('#pv-go');
}

test('Sicherung erstellen und auf einem neuen Gerät laden', async ({ page, browser }) => {
  await profilAnlegen(page, 'Mia');
  await demoLaden(page);
  await app(page, async (m) => {
    const prof = (await m.db.all('profile'))[0];
    for (const v of (await m.db.all('vokabeln')).slice(0, 5)) await m.L.bewerte(prof.id, v.id, 'fd', 'richtig');
  });
  const json = await app(page, async (m) => JSON.stringify(await m.backup.erstelleBackup()));

  const neu = await (await browser.newContext()).newPage();   // zweites „Gerät“ mit leerem Speicher
  await neu.goto(page.url().split('#')[0]);
  await sicherungLadenAufLeeremGeraet(neu, json);
  await expect(neu.locator('[data-profil]', { hasText: 'Mia' })).toBeVisible();
  expect(await alle(neu, 'vokabeln')).toHaveLength(26);
  expect(await alle(neu, 'lernstand')).toHaveLength(5);
  await neu.context().close();
});

test('Keine Sicherung: falsche Datei wird abgelehnt', async ({ page }) => {
  await geh(page, '');
  await page.setInputFiles('#pv-sicherung', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hallo": 1}') });
  await expect(page.locator('#pv-info')).toContainText('keine Vokabel-Studio-Sicherung');
});

test('Sicherung aus Version 2.7 (alter Live-Stand) funktioniert weiter', async ({ page }) => {
  await sicherungLadenAufLeeremGeraet(page, ALTE_SICHERUNG, 'vokabel-studio-backup-alt.json');
  await page.locator('[data-profil]', { hasText: 'Testkind' }).click();
  await expect(page.getByRole('heading', { name: /Hallo Testkind/ })).toBeVisible();
  await expect(page.getByText('2 Units · 26 Vokabeln auf diesem Gerät')).toBeVisible();

  // Antwortprotokoll: Einträge älter als 60 Tage werden zusammengefasst, die Zahlen bleiben gleich
  const vorher = (await alle(page, 'ereignisse')).length;
  await app(page, async (m) => { await m.db.del('meta', 'archiviertAm'); await m.L.archiviereEreignisse(); });
  const nachher = (await alle(page, 'ereignisse')).length;
  expect(nachher).toBeLessThan(vorher);
  await elternPinSetzen(page);
  await expect(page.locator('.card', { hasText: 'Testkind' }).first()).toContainText(`bei ${vorher} Antworten`);

  // Lernen mit den alten Lernständen
  await geh(page, 'lernen');
  await expect(page.locator('#h-info')).toContainText('fällig');
  await page.click('[data-modus=karten]');
  await expect(page.locator('#k-dreh')).toBeVisible();

  // Erfolge und Gutschein-Bereich mit alten Belohnungsdaten
  await geh(page, 'erfolge');
  await expect(page.getByText('Erste Schritte')).toBeVisible();
});
