// Start, Startseite, Beta-Adresse, Offline, Versionsnummern
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { test, expect, geh, profilAnlegen, demoLaden, app } from './helfer.js';

const datei = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test.describe('Versionsnummer und Offline-Dateien', () => {
  test('App-Version und Service-Worker-Version stimmen überein', () => {
    const sw = /PREFIX \+ '([^']+)'/.exec(datei('sw.js'))[1];
    const app = /APP_VERSION = BETA \? '([^']+)-beta' : '([^']+)'/.exec(datei('js/config.js'));
    expect(app, 'APP_VERSION in js/config.js nicht gefunden').toBeTruthy();
    expect(app[1]).toBe(sw);
    expect(app[2]).toBe(sw);
  });

  test('Alle App-Dateien sind offline verfügbar (Liste im Service Worker)', () => {
    const liste = JSON.parse('[' + /const DATEIEN = \[([\s\S]*?)\];/.exec(datei('sw.js'))[1].replace(/'/g, '"') + ']');
    const appDateien = readdirSync(new URL('../js/', import.meta.url), { recursive: true }).filter((f) => /\.m?js$/.test(f));
    for (const js of appDateien) {
      expect(liste, `js/${js} fehlt in sw.js (DATEIEN) – dann geht sie offline nicht`).toContain(`js/${js}`);
    }
    for (const f of liste.filter((x) => x !== './')) expect(existsSync(new URL('../' + f, import.meta.url)), `${f} steht in sw.js, existiert aber nicht`).toBe(true);
  });
});

test('Erster Start: Willkommen, Profil anlegen, Beispiel-Units laden', async ({ page }) => {
  await geh(page, '');
  await expect(page.getByText('Willkommen bei Vokabel-Studio')).toBeVisible();
  await profilAnlegen(page, 'Mia');
  await demoLaden(page);
  await geh(page, 'home');
  await expect(page.getByText('2 Units · 26 Vokabeln auf diesem Gerät')).toBeVisible();
  // Profil nur Englisch → nur die 16 englischen Vokabeln zählen, nicht Vokabel × Richtung
  await expect(page.locator('.card.heute')).toContainText('16 neue Vokabeln warten');
  await expect(page.getByText('Deine Daten liegen bisher nur auf diesem Gerät')).toBeVisible();
});

test('Beta-Adresse nutzt eigenen Speicher und zeigt BETA', async ({ page }) => {
  await page.goto('beta/');
  await expect(page.locator('#title .badge')).toHaveText('BETA');
  expect(await app(page, async () => (await import(new URL('js/config.js', document.baseURI).href)).DB_NAME)).toBe('vokabel-studio-beta');
  await page.goto('./');
  expect(await app(page, async () => (await import(new URL('js/config.js', document.baseURI).href)).DB_NAME)).toBe('vokabel-studio');
});

test('Einstellungen zeigen die Version und speichern', async ({ page }) => {
  await profilAnlegen(page);
  await geh(page, 'einstellungen');
  const sw = /PREFIX \+ '([^']+)'/.exec(datei('sw.js'))[1];
  await expect(page.getByText(`Version ${sw}`)).toBeVisible();
  await page.selectOption('#st-ziel', '5');
  await expect.poll(() => app(page, async (m) => (await m.db.all('profile'))[0].einstellungen.tagesziel)).toBe(5);
});
