// Einlesen: Chatbot-Weg (Kopieren/Einfügen) und KI-Weg (nachgebaute KI, kein echter Anbieter)
import { test, expect, geh, profilAnlegen, alle, DEMO_EN, kiNachbauen, kiEinrichten, elternPinSetzen } from './helfer.js';

test.beforeEach(async ({ page }) => {
  await profilAnlegen(page);
});

async function bisZumPrompt(page, nummer = '3') {
  await geh(page, 'import');
  await page.fill('#w-nr', nummer);
  await page.click('#w-weiter');
}

async function uebernehmen(page) {
  const kontrolle = page.getByRole('heading', { name: '4. Kontrollieren' });
  const kiFehler = page.locator('#w-ki-status .msg.err, #w-meldungen .msg.err');
  await expect(kontrolle.or(kiFehler).first()).toBeVisible({ timeout: 30_000 });
  // Bei einem Fehler die Meldung der App ins Testprotokoll schreiben (statt nur „nicht gefunden“)
  if (await kiFehler.count()) throw new Error('Die App meldet: ' + (await kiFehler.first().innerText()));
  await page.click('#w-speichern');
  await expect(page.getByRole('heading', { name: 'Geschafft!' })).toBeVisible();
  await expect(page.locator('#app')).toContainText('gespeichert');
}

test('Chatbot-Weg: Antwort einfügen, prüfen, übernehmen', async ({ page }) => {
  await bisZumPrompt(page);
  await page.click('#w-weiter');   // „Antwort einfügen ›“
  await page.fill('#w-text', 'Hier ist das Ergebnis:\n```json\n' + DEMO_EN + '\n```');
  await page.click('#w-pruefen');
  await uebernehmen(page);
  const units = await alle(page, 'units');
  expect(units.map((u) => u.nummer)).toContain('3');
  expect(await alle(page, 'vokabeln')).toHaveLength(16);
});

test('Chatbot-Weg: kaputte Antwort wird verständlich gemeldet', async ({ page }) => {
  await bisZumPrompt(page);
  await page.click('#w-weiter');
  await page.fill('#w-text', '{"parts": [ {"kennung": "A", "vokabeln": [ {"wort": "hill"');
  await page.click('#w-pruefen');
  await expect(page.locator('#w-meldungen')).toContainText('unvollständig');
});

test('KI: OpenRouter einrichten – falscher Schlüssel, nur Gratis-Modelle', async ({ page }) => {
  await kiNachbauen(page, [{ inhalt: 'OK' }]);
  await elternPinSetzen(page);
  await page.click('[data-bearb="openrouter"]');
  await page.fill('#ki-key', 'sk-or-falsch');
  await page.click('#ki-laden');
  await expect(page.locator('#ki-modelle')).toContainText('ungültig');
  await page.fill('#ki-key', 'sk-or-test');
  await page.click('#ki-laden');
  await expect(page.locator('#ki-modelle')).not.toContainText('ungültig');
  // nur die beiden Gratis-Modelle, nicht das kostenpflichtige
  const meldung = page.locator('#ki-modelle .msg');
  await expect(page.locator('#ki-modell').or(meldung).first()).toBeVisible();
  if (await meldung.count()) throw new Error('Die App meldet: ' + (await meldung.first().innerText()));
  await expect(page.locator('#ki-modell option')).toHaveCount(2);
  await expect(page.locator('#ki-modell')).not.toContainText('Kostet Geld');
  await page.click('#ki-speichern');
  await expect(page.locator('#ki-karte .msg.ok')).toContainText('OpenRouter');
});

test('KI: Text statt Foto, erstes Modell überlastet → Ausweichmodell', async ({ page }) => {
  const anfragen = await kiNachbauen(page, [{ status: 429, text: 'Rate limit' }, { inhalt: '```json\n' + DEMO_EN + '\n```' }]);
  await kiEinrichten(page);
  await bisZumPrompt(page);
  await page.locator('.text-weg summary').click();
  await page.fill('#w-lens', 'Unit 3\nmountain [ˈmaʊntən] Berg\nsteep steil\nvalley Tal');
  await page.click('#w-lens-ok');
  await uebernehmen(page);
  expect(anfragen.map((a) => a.model)).toEqual(['google/gemma-4-31b-it:free', 'nvidia/nemotron-3.5-super-vl:free']);
  expect(JSON.stringify(anfragen[1].messages)).toContain('ES GIBT KEIN FOTO');
  expect(anfragen[1].response_format).toBeUndefined();
});

test('KI: alle Modelle überlastet → klare Meldung, Kopier-Weg bleibt', async ({ page }) => {
  await kiNachbauen(page, [{ status: 503, text: 'overloaded' }]);
  await kiEinrichten(page);
  await bisZumPrompt(page);
  await page.locator('.text-weg summary').click();
  await page.fill('#w-lens', 'mountain Berg, steep steil, valley Tal');
  await page.click('#w-lens-ok');
  await expect(page.locator('#w-ki-status')).toContainText('Kein KI-Dienst hat geantwortet', { timeout: 40_000 });
  await expect(page.getByText('Ohne KI: über ChatGPT/Gemini kopieren')).toBeVisible();
});
