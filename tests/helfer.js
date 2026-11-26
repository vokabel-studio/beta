// Gemeinsame Hilfen für die Tests
import { test as basis, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

export { expect };

/** Jeder Test bekommt eine frische App (leerer Speicher). Fehler in der Browser-Konsole lassen den Test scheitern. */
export const test = basis.extend({
  page: async ({ page }, use) => {
    const fehler = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    page.on('console', (m) => {
      // „Failed to load resource“ entsteht bei absichtlich nachgebauten Fehlern (z. B. KI überlastet)
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fehler.push(m.text());
    });
    page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? (page.promptAntwort ?? '') : undefined));
    await use(page);
    expect(fehler, 'Fehler in der Browser-Konsole').toEqual([]);
  }
});

export const DEMO_EN = readFileSync(new URL('../demo/demo-englisch.json', import.meta.url), 'utf8');
export const ALTE_SICHERUNG = readFileSync(new URL('./fixtures/sicherung-2.7.json', import.meta.url), 'utf8');

export async function geh(page, pfad) {
  await page.goto('#/' + pfad);
}

/** Code im Browser mit den Modulen der App ausführen: app((m) => …, arg) – m.db, m.L (lernen), … */
export async function app(page, fn, arg) {
  return page.evaluate(async ([quelle, a]) => {
    const lade = (n) => import(new URL(`js/${n}.js`, document.baseURI).href);
    const m = { db: await lade('db'), L: await lade('lernen'), B: await lade('belohnung'), backup: await lade('backup'), G: await lade('gutscheine') };
    // eslint-disable-next-line no-new-func
    return new Function('m', 'a', `return (${quelle})(m, a);`)(m, a);
  }, [fn.toString(), arg]);
}

export const alle = (page, store) => app(page, (m, s) => m.db.all(s), store);

export async function profilAnlegen(page, name = 'Mia', { latein = false } = {}) {
  await geh(page, 'profil-neu');
  await page.fill('#pf-name', name);
  if (latein) await page.check('#pf-faecher input[value="latein"]');
  await page.click('#pf-save');
  await expect(page.locator('h2', { hasText: `Hallo ${name}` })).toBeVisible();
}

export async function demoLaden(page) {
  await geh(page, 'bibliothek');
  await page.click('#demo-laden');
  await expect(page.locator('#toast')).toContainText('Beispiel-Vokabeln geladen');
  await expect(page.locator('#demo-laden')).toHaveCount(0);
}

/** Beantwortet die aktuelle Tipp-Aufgabe richtig (Fremdsprache→Deutsch oder umgekehrt) */
export async function richtigAntworten(page, voks) {
  const frage = (await page.locator('.card.flash .wort').first().textContent()).trim();
  const fd = voks.find((v) => v.wort === frage);
  const df = voks.find((v) => v.bedeutungen.join('; ') === frage);
  const antwort = fd ? fd.bedeutungen[0] : df?.wort;
  if (!antwort) throw new Error(`Keine Vokabel zur Frage „${frage}“`);
  await page.fill('#t-in', antwort);
  await page.click('#t-ok');
}

/** Spielt einen Abschlusstest mit lauter richtigen Antworten durch */
export async function testRichtigMachen(page, unitId) {
  const voks = await alle(page, 'vokabeln');
  await geh(page, `lernen?unit=${unitId}`);
  await page.click('[data-modus=test]');
  await expect(page.locator('#t-in')).toBeVisible();
  for (let i = 0; i < 40 && await page.locator('#t-in').count(); i++) {
    const vorher = await page.locator('.sess-head').textContent();
    await richtigAntworten(page, voks);
    await expect(page.locator('.sess-head, .prozent').first()).not.toHaveText(vorher);
  }
  await expect(page.locator('.prozent')).toHaveText('100 %');
}

/** Nachgebauter KI-Anbieter (OpenRouter). antworten: Liste von Funktionen/Objekten je Anfrage, die letzte wiederholt sich. */
export async function kiNachbauen(page, antworten) {
  const anfragen = [];
  // Wie der echte Anbieter: Aufrufe aus dem Browser erlauben (CORS) – WebKit/Safari prüft das streng
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  await page.context().route('https://openrouter.ai/**', async (route) => {
    const req = route.request();
    const pfad = new URL(req.url()).pathname;
    const antworte = (o) => route.fulfill({ contentType: 'application/json', ...o, headers: { ...CORS, ...(o.headers || {}) } });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (pfad === '/api/v1/key') {
      // allHeaders(): auch in WebKit mit dem Authorization-Header (headers() lässt ihn dort weg)
      const ok = (await req.allHeaders()).authorization === 'Bearer sk-or-test';
      return antworte({ status: ok ? 200 : 401, body: JSON.stringify(ok ? { data: { label: 'test' } } : { error: { message: 'invalid key' } }) });
    }
    if (pfad === '/api/v1/models') {
      return antworte({ body: JSON.stringify({ data: [
        { id: 'nvidia/nemotron-3.5-super-vl:free', name: 'Nemotron VL (free)', architecture: { input_modalities: ['text', 'image'] }, pricing: { prompt: '0', completion: '0' } },
        { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 (free)', architecture: { input_modalities: ['text', 'image'] }, pricing: { prompt: '0', completion: '0' } },
        { id: 'teuer/modell', name: 'Kostet Geld', architecture: { input_modalities: ['text', 'image'] }, pricing: { prompt: '0.000002', completion: '0.00001' } }
      ] }) });
    }
    if (pfad === '/api/v1/chat/completions') {
      let body = {};
      try { body = JSON.parse(req.postData() ?? req.postDataBuffer()?.toString() ?? '{}'); } catch { /* Inhalt nicht lesbar */ }
      anfragen.push(body);
      const a = antworten[Math.min(anfragen.length - 1, antworten.length - 1)];
      if (a.status) return antworte({ status: a.status, body: JSON.stringify({ error: { message: a.text || 'Fehler', code: a.status } }) });
      return antworte({ body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: a.inhalt } }] }) });
    }
    return antworte({ status: 404, body: '{}' });
  });
  return anfragen;
}

/** Richtet OpenRouter direkt im Speicher ein (ohne Eltern-Oberfläche) */
export async function kiEinrichten(page) {
  await app(page, (m) => m.db.setMeta('ki', { haupt: 'openrouter', konten: { openrouter: { schluessel: 'sk-or-test', modell: 'google/gemma-4-31b-it:free', ausweich: ['nvidia/nemotron-3.5-super-vl:free'] } } }));
}

export async function elternPinSetzen(page, pin = '1234') {
  await geh(page, 'eltern');
  await page.fill('#el-neu', pin);
  await page.fill('#el-neu2', pin);
  await page.click('#el-set');
  await expect(page.locator('#el-zu')).toBeVisible();
}
