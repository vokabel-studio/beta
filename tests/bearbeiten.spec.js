// Bearbeiten und Löschen: Unit, Vokabel, Part, Buch, Termin
import { test, expect, geh, profilAnlegen, demoLaden, alle, app } from './helfer.js';

let en;   // englische Beispiel-Unit
test.beforeEach(async ({ page }) => {
  await profilAnlegen(page, 'Ben', { latein: true });
  await demoLaden(page);
  en = (await alle(page, 'units')).find((u) => /trip/i.test(u.titel));
});

test('Unit bearbeiten: Titel ändern, Lernsatz löschen', async ({ page }) => {
  const vorher = (await alle(page, 'lernsaetze')).filter((s) => s.unitId === en.id).length;
  await geh(page, `unit-bearbeiten/${en.id}`);
  await page.fill('#uf-titel', 'Neuer Titel');
  await page.locator('.bearb-zeile[data-zeile="satz"] [data-weg]').first().click();
  await page.click('#uf-save');
  await expect(page.getByRole('heading', { name: /Neuer Titel/ })).toBeVisible();
  expect((await alle(page, 'lernsaetze')).filter((s) => s.unitId === en.id)).toHaveLength(vorher - 1);
});

test('Vokabel von Hand hinzufügen (mit neuem Part und Beispielsatz)', async ({ page }) => {
  page.promptAntwort = 'C';
  await geh(page, `vokabel-neu/${en.id}`);
  await page.fill('#vf-wort', 'drawbridge');
  await page.fill('#vf-bedeutungen', 'Zugbrücke');
  await page.selectOption('#vf-part', '__neu');
  await page.fill('#vf-beispiele', 'The drawbridge is down. | Die Zugbrücke ist unten.');
  await page.click('#vf-save');
  await expect(page.locator('.vok-wort', { hasText: 'drawbridge' })).toBeVisible();
  const v = (await alle(page, 'vokabeln')).find((x) => x.wort === 'drawbridge');
  const part = (await alle(page, 'parts')).find((p) => p.id === v.partId);
  expect(part.kennung).toBe('C');
  expect(v.beispiele[0]).toMatchObject({ fremd: 'The drawbridge is down.', deutsch: 'Die Zugbrücke ist unten.' });
});

test('Part löschen entfernt seine Vokabeln', async ({ page }) => {
  const partB = (await alle(page, 'parts')).find((p) => p.unitId === en.id && p.kennung === 'B');
  const vorher = (await alle(page, 'vokabeln')).length;
  const imPart = (await alle(page, 'vokabeln')).filter((v) => v.partId === partB.id).length;
  await geh(page, `unit-bearbeiten/${en.id}`);
  await page.click(`.bearb-zeile[data-key="${partB.id}"] [data-weg]`);
  await page.click('#uf-save');
  await expect(page).toHaveURL(new RegExp(`#/unit/${en.id}$`));
  await expect.poll(async () => (await alle(page, 'vokabeln')).length).toBe(vorher - imPart);
  expect((await alle(page, 'parts')).map((p) => p.id)).not.toContain(partB.id);
});

test('Buch löschen entfernt Units, Vokabeln und Lernstand', async ({ page }) => {
  const la = (await alle(page, 'units')).find((u) => u.id !== en.id);
  await app(page, async (m, unitId) => {
    const prof = (await m.db.all('profile'))[0];
    for (const v of (await m.db.all('vokabeln')).filter((x) => x.unitId === unitId)) await m.L.bewerte(prof.id, v.id, 'fd', 'richtig');
  }, la.id);
  await geh(page, `lehrwerk/${la.lehrwerkId}`);
  await page.click('#lw-del');
  await expect(page).toHaveURL(/#\/bibliothek/);
  expect((await alle(page, 'lehrwerke')).map((l) => l.id)).not.toContain(la.lehrwerkId);
  expect((await alle(page, 'units')).map((u) => u.id)).toEqual([en.id]);
  expect((await alle(page, 'vokabeln')).every((v) => v.unitId === en.id)).toBe(true);
  expect(await alle(page, 'lernstand')).toHaveLength(0);
});

test('Termin anlegen und bearbeiten', async ({ page }) => {
  await geh(page, `termin-neu?unit=${en.id}`);
  await page.click('#tf-save');
  await expect(page.getByRole('heading', { name: 'Vokabeltest' })).toBeVisible();
  const t = (await alle(page, 'termine'))[0];
  await geh(page, `termin-neu?id=${t.id}`);
  await page.fill('#tf-titel', 'Englisch-Test');
  await page.click('#tf-save');
  await expect(page.getByRole('heading', { name: 'Englisch-Test' })).toBeVisible();
  expect(await alle(page, 'termine')).toHaveLength(1);
});
