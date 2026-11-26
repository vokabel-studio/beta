// Barrierefreiheit: Alle wichtigen Seiten werden mit axe geprüft (WCAG 2.2 AA + bewährte Regeln).
// Schlägt fehl bei ernsten Verstößen (z. B. zu wenig Kontrast, fehlende Beschriftungen, falsche Überschriften-Reihenfolge).
import AxeBuilder from '@axe-core/playwright';
import { test, expect, geh, profilAnlegen, demoLaden, alle, app, elternPinSetzen } from './helfer.js';

async function pruefe(page, name) {
  const r = await new AxeBuilder({ page }).exclude('#toast').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const ernst = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact) || v.id === 'heading-order');
  const text = ernst.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' ' + (n.any?.[0]?.message || '')).join('\n    ')}`).join('\n');
  expect(ernst, `Barrierefreiheit auf „${name}“:\n${text}`).toEqual([]);
}

for (const stil of ['standard', 'rock', 'pop', 'hiphop']) for (const design of ['light', 'dark']) {
  test(`Alle Seiten barrierefrei (Style ${stil}, ${design === 'dark' ? 'dunkel' : 'hell'})`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.emulateMedia({ colorScheme: design });
    await geh(page, '');
    await pruefe(page, 'Willkommen');
    await profilAnlegen(page, 'Mia', { latein: true });
    await app(page, async (m, st) => { const p = (await m.db.all('profile'))[0]; p.einstellungen.style = st; await m.db.put('profile', p); }, stil);
    await demoLaden(page);
    const units = await alle(page, 'units');
    const en = units.find((u) => /trip/i.test(u.titel));
    const vok = (await alle(page, 'vokabeln')).find((v) => v.unitId === en.id);
    const seiten = [
      ['Start', 'home'], ['Profile', 'profile'], ['Neues Profil', 'profil-neu'], ['Bücher', 'bibliothek'], ['Buch', `lehrwerk/${en.lehrwerkId}`],
      ['Unit', `unit/${en.id}`], ['Unit bearbeiten', `unit-bearbeiten/${en.id}`], ['Vokabel', `vokabel/${vok.id}`], ['Vokabel bearbeiten', `vokabel-bearbeiten/${vok.id}`],
      ['Lernen', 'lernen'], ['Lernplan', 'plan'], ['Neuer Termin', 'termin-neu'], ['Erfolge', 'erfolge'], ['Gutscheine', 'gutscheine'], ['Sichern & Abgleichen', 'backup'],
      ['Einstellungen', 'einstellungen'], ['Einlesen', 'import'], ['Datenschutz', 'datenschutz'], ['Teilen', 'teilen'], ['QR senden', 'qr-senden'], ['QR empfangen', 'qr-empfangen']
    ];
    for (const [name, pfad] of seiten) {
      await geh(page, pfad);
      await page.waitForTimeout(250);
      await pruefe(page, `${name} [${stil}]`);
    }
    for (const [modus, name] of [['abfrage', 'Abfrage'], ['karten', 'Lernkarten'], ['mc', 'Auswahl'], ['satzbau', 'Satzbau']]) {
      await geh(page, 'lernen');
      await page.click(`[data-modus=${modus}]`);
      await page.waitForTimeout(250);
      await pruefe(page, name);
    }
    await elternPinSetzen(page);
    await pruefe(page, 'Eltern');
  });
}
