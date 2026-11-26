// Lernarten, Lernlogik, Fortsetzen
import { test, expect, geh, profilAnlegen, demoLaden, alle, app, richtigAntworten, testRichtigMachen } from './helfer.js';

test.beforeEach(async ({ page }) => {
  await profilAnlegen(page);
  await demoLaden(page);
});

test('Lernkarten bis zum Ende durchspielen', async ({ page }) => {
  await geh(page, 'lernen');
  await page.selectOption('#h-anzahl', '10');
  await page.click('[data-modus=karten]');
  const geschafft = page.getByRole('heading', { name: 'Geschafft!' });
  for (let i = 0; i < 30; i++) {
    await page.click('#k-dreh');
    await page.click('#k-ja');
    // warten, bis die nächste Karte oder das Ende angezeigt wird
    await expect(page.locator('#k-dreh').or(geschafft)).toBeVisible();
    if (await geschafft.count()) break;
  }
  await expect(geschafft).toBeVisible();
  await expect(page.getByText('10 von 10 richtig')).toBeVisible();
});

test('Abfrage: richtig, falsch mit Lösung, Wiederholung am Ende', async ({ page }) => {
  const voks = await alle(page, 'vokabeln');
  await geh(page, 'lernen');
  await page.selectOption('#h-anzahl', '10');
  await page.click('[data-modus=abfrage]');
  await richtigAntworten(page, voks);
  await expect(page.locator('.msg.ok')).toContainText('Richtig');
  await page.click('#t-weiter');
  await page.fill('#t-in', 'xyz');
  await page.click('#t-ok');
  await expect(page.locator('.msg.err')).toContainText('Lösung');
  await page.click('#t-weiter');
  // falsch beantwortete Vokabel kommt am Ende noch einmal → 11 Aufgaben
  await expect(page.locator('.sess-head')).toContainText('/ 11');
});

test('Auswahl (Multiple Choice) zeigt 4 Antworten', async ({ page }) => {
  await geh(page, 'lernen');
  await page.click('[data-modus=mc]');
  await expect(page.locator('.mc [data-o]')).toHaveCount(4);
  await page.locator('.mc [data-o]').first().click();
  await expect(page.locator('.mc .btn.ok')).toHaveCount(1);
});

test('Satzbau: richtige Reihenfolge wird erkannt', async ({ page }) => {
  const aufgaben = await alle(page, 'satzbau');
  await geh(page, 'lernen');
  await page.click('[data-modus=satzbau]');
  const deutsch = (await page.locator('.card.flash .de').textContent()).trim();
  const a = aufgaben.find((x) => x.deutsch === deutsch);
  for (const wort of a.loesung.split(/\s+/)) await page.locator('.sb-pool .sb-tok:not([disabled])', { hasText: new RegExp(`^${wort.replace(/[.?*+()[\]]/g, '\\$&')}$`) }).first().click();
  await page.click('#sb-ok');
  await expect(page.locator('.msg.ok')).toContainText('Richtig');
});

test('Abschlusstest mit 100 % und Abzeichen', async ({ page }) => {
  const unit = (await alle(page, 'units')).find((u) => /trip/i.test(u.titel));
  await testRichtigMachen(page, unit.id);
  await expect(page.getByText('Perfekt')).toBeVisible();
  const tests = await alle(page, 'tests');
  expect(tests).toHaveLength(1);
  expect(tests[0].prozent).toBe(100);
});

test('Angefangene Übung nach Neustart fortsetzen', async ({ page }) => {
  const voks = await alle(page, 'vokabeln');
  await geh(page, 'lernen');
  await page.selectOption('#h-anzahl', '10');
  await page.click('[data-modus=abfrage]');
  await richtigAntworten(page, voks);
  await page.click('#t-weiter');
  await expect(page.locator('.sess-head')).toContainText('2 / 10');
  await page.reload();
  await geh(page, 'home');
  await expect(page.getByText('Angefangene Übung')).toBeVisible();
  await expect(page.getByText('1 von 10 geschafft')).toBeVisible();
  await page.getByRole('link', { name: 'Weitermachen' }).click();
  await expect(page.locator('.sess-head')).toContainText('2 / 10');
});

test('Lernlogik: Tippfehler, Tagesziel, Fächer des Profils', async ({ page }) => {
  const r = await app(page, async (m) => {
    const prof = (await m.db.all('profile'))[0];
    const voks = await m.db.all('vokabeln');
    const v = voks.find((x) => x.wort.length >= 6);
    const fast = m.L.pruefeAntwort(v.wort.slice(0, -1) + 'q', [v.wort]).ergebnis;
    // „fast“ bei Deutsch → Fremdsprache: bleibt im Kasten, morgen wieder; Fremdsprache → Deutsch: steigt auf
    await m.L.bewerte(prof.id, v.id, 'df', 'richtig');
    await m.L.bewerte(prof.id, v.id, 'df', 'fast');
    await m.L.bewerte(prof.id, v.id, 'fd', 'richtig');
    await m.L.bewerte(prof.id, v.id, 'fd', 'fast');
    const df = await m.db.get('lernstand', `${prof.id}|${v.id}|df`);
    const fd = await m.db.get('lernstand', `${prof.id}|${v.id}|fd`);
    // Tagesziel 3: nach 3 neuen Vokabeln heute keine weiteren neuen
    prof.einstellungen.tagesziel = 3; await m.db.put('profile', prof);
    const englisch = voks.filter((x) => x.unitId === v.unitId && x.id !== v.id).slice(0, 2);
    for (const x of englisch) await m.L.bewerte(prof.id, x.id, 'fd', 'richtig');
    const z = await m.L.faelligZahlen(prof, { richtungOverride: 'fd' });
    const ids = await m.L.profilUnitIds(prof);
    return { fast, df: df.box, fd: fd.box, morgen: df.faelligAm, z, nUnits: ids.length };
  });
  expect(r.fast).toBe('fast');
  expect(r.df).toBe(1);          // nicht aufgestiegen
  expect(r.fd).toBe(2);          // aufgestiegen
  expect(r.z.neuHeute).toBe(0);  // Tagesziel erreicht
  expect(r.z.tagesRest).toBe(0);
  expect(r.nUnits).toBe(1);      // Profil nur Englisch → Latein-Unit zählt nicht
});

test('Hör-Quiz: starten, Pause, beenden', async ({ page }) => {
  await geh(page, 'lernen');
  await page.click('#h-auto');
  await expect(page.locator('h2', { hasText: 'Hör-Quiz' })).toBeVisible();
  test.skip(await page.locator('#hq-start').isDisabled(), 'Dieser Test-Browser kann nicht vorlesen');
  await page.selectOption('#hq-pause', '3');
  await page.click('#hq-start');
  await expect(page.locator('#hq-nr')).toHaveText(/1 \/ \d+/, { timeout: 20_000 });
  await page.click('#hq-pp');
  await expect(page.locator('#hq-status')).toHaveText('Pause');
  await page.click('#hq-stop');
  await expect(page).toHaveURL(/#\/lernen/);
});
