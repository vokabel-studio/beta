// Geräte abgleichen: Sync-Kern, QR-Übertragung, OneDrive (nachgebauter Microsoft-Server)
import { test, expect, geh, profilAnlegen, demoLaden, alle, app } from './helfer.js';

/** Zweites „Gerät“: eigener Browser-Kontext mit leerem Speicher */
async function zweitesGeraet(browser, page) {
  const ctx = await browser.newContext({ ...test.info().project.use, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  await p.goto(page.url().split('#')[0]);
  return p;
}
const exportiere = (page, opts) => app(page, async (m, o) => (await import(new URL('js/sync.js', document.baseURI).href)).exportiere(o), opts);
const fuehreZusammen = (page, paket) => app(page, async (m, p) => (await import(new URL('js/sync.js', document.baseURI).href)).fuehreZusammen(p), paket);

test.describe('Sync-Kern', () => {
  test('Zwei Geräte: übertragen, löschen, neuere Änderung gewinnt', async ({ page, browser }) => {
    await profilAnlegen(page, 'Mia');
    await demoLaden(page);
    await app(page, async (m) => {
      const p = (await m.db.all('profile'))[0];
      for (const v of (await m.db.all('vokabeln')).slice(0, 5)) await m.L.bewerte(p.id, v.id, 'fd', 'richtig');
    });
    // Gerät B bekommt alles von A
    const b = await zweitesGeraet(browser, page);
    const r1 = await fuehreZusammen(b, await exportiere(page));
    expect(r1.neu).toBeGreaterThan(30);
    expect(await alle(b, 'vokabeln')).toHaveLength(26);
    expect(await alle(b, 'lernstand')).toHaveLength(5);

    // B löscht die Latein-Unit und lernt weiter; A ändert gleichzeitig einen Unit-Titel
    const la = (await alle(b, 'units')).find((u) => !/trip/i.test(u.titel));
    await app(b, async (m, id) => {
      await m.db.deleteUnit(id);
      const p = (await m.db.all('profile'))[0];
      for (const v of (await m.db.all('vokabeln')).slice(5, 8)) await m.L.bewerte(p.id, v.id, 'fd', 'richtig');
    }, la.id);
    await app(page, async (m) => { const u = (await m.db.all('units')).find((x) => /trip/i.test(x.titel)); await m.db.put('units', { ...u, titel: 'Neu auf A' }); });

    // Abgleich in beide Richtungen
    await fuehreZusammen(page, await exportiere(b));
    await fuehreZusammen(b, await exportiere(page));
    const englisch = new Set((await alle(b, 'vokabeln')).map((v) => v.id));
    const lsB = (await alle(b, 'lernstand')).map((l) => l.key).sort();
    for (const g of [page, b]) {
      const units = await alle(g, 'units');
      expect(units.map((u) => u.titel)).toEqual(['Neu auf A']);          // Löschung von B + Titel von A
      expect(await alle(g, 'vokabeln')).toHaveLength(16);
      const ls = await alle(g, 'lernstand');
      expect(ls.map((l) => l.key).sort()).toEqual(lsB);                  // beide Geräte gleicher Lernstand
      expect(ls.every((l) => englisch.has(l.vokabelId))).toBe(true);    // keiner zu gelöschten Vokabeln
    }
    expect(lsB.length).toBeGreaterThanOrEqual(3);
    // Belohnungen: Punkte beider Geräte gehen nicht verloren (Maximum)
    const pa = (await alle(page, 'belohnungen'))[0].punkte, pb = (await alle(b, 'belohnungen'))[0].punkte;
    expect(pa).toBe(pb);
    await b.context().close();
  });

  test('Sicherung laden holt versehentlich Gelöschtes zurück', async ({ page }) => {
    await profilAnlegen(page);
    await demoLaden(page);
    const sicherung = await app(page, async (m) => m.backup.erstelleBackup());
    const unitId = (await alle(page, 'units'))[0].id;
    await app(page, (m, id) => m.db.deleteUnit(id), unitId);
    expect(await alle(page, 'units')).toHaveLength(1);
    await app(page, (m, s) => m.backup.spieleEin(s), sicherung);
    expect(await alle(page, 'units')).toHaveLength(2);
    expect(await alle(page, 'vokabeln')).toHaveLength(26);
  });

  test('Gelöschter Gutschein kommt durch Abgleich nicht zurück', async ({ page, browser }) => {
    await profilAnlegen(page);
    await app(page, async (m) => {
      const p = (await m.db.all('profile'))[0];
      await m.G.erstelle([p.id], { text: 'Eis', emoji: '🍦', art: 'tests', anzahl: 2, minProzent: 75, wiederholen: true });
    });
    const b = await zweitesGeraet(browser, page);
    await fuehreZusammen(b, await exportiere(page));
    await app(page, async (m) => { const p = (await m.db.all('profile'))[0]; const { b } = await m.G.daten(p.id); await m.G.loesche(p.id, b.gutscheine[0].id); });
    await fuehreZusammen(page, await exportiere(b));    // B hat ihn noch
    expect((await alle(page, 'belohnungen'))[0].gutscheine).toHaveLength(0);
    await b.context().close();
  });
});

test.describe('QR-Übertragung', () => {
  test('Daten → viele QR-Codes → zurückgelesen → auf zweitem Gerät übernommen', async ({ page, browser }) => {
    await profilAnlegen(page, 'Mia');
    await demoLaden(page);
    const ergebnis = await page.evaluate(async () => {
      const Q = await import(new URL('js/qr.js', document.baseURI).href);
      const S = await import(new URL('js/sync.js', document.baseURI).href);
      const paket = await S.exportiere();
      const { teile, bytes, rohBytes } = await Q.inTeile(paket);
      const lies = await Q.leser();
      const sammler = new Q.Sammler();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 720;
      // in vertauschter Reihenfolge und mit Wiederholungen „einscannen“ – wie bei der Kamera
      const reihe = [...teile.keys()].reverse().concat([0, 1]);
      let unlesbar = 0;
      for (const i of reihe) {
        Q.zeichne(canvas, teile[i]);
        const texte = await lies(canvas);
        if (!texte.length) unlesbar++;
        texte.forEach((t) => sammler.hinzu(t));
      }
      const zurueck = await sammler.ergebnis();
      return { teile: teile.length, bytes, rohBytes, unlesbar, gleich: JSON.stringify(zurueck) === JSON.stringify(paket), zurueck };
    });
    expect(ergebnis.unlesbar).toBe(0);
    expect(ergebnis.gleich).toBe(true);
    expect(ergebnis.bytes).toBeLessThan(ergebnis.rohBytes / 3);   // gepackt
    const b = await zweitesGeraet(browser, page);
    await fuehreZusammen(b, ergebnis.zurueck);
    expect(await alle(b, 'vokabeln')).toHaveLength(26);
    await b.context().close();
  });

  test('Senden-Seite zeigt QR-Codes, Empfangen-Seite ohne Profil erreichbar', async ({ page, browser }) => {
    await profilAnlegen(page);
    await demoLaden(page);
    await geh(page, 'backup');
    await page.getByRole('link', { name: /Senden/ }).click();
    await page.click('#qr-start');
    await expect(page.locator('#qr-zaehler')).toContainText(/Teil \d+ von \d+/);
    const neu = await zweitesGeraet(browser, page);   // neues Handy ohne Profil
    await neu.goto(page.url().split('#')[0] + '#/');
    await neu.getByRole('link', { name: /Von einem anderen Handy übertragen/ }).click();
    await expect(neu.locator('#qr-kamera')).toBeVisible();
    await neu.context().close();
  });
});

// ---------- Nachgebauter Microsoft-Server (Anmeldung + OneDrive) ----------
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, if-match', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Expose-Headers': 'etag' };
function neueCloud() { return { datei: null, etag: 0, puts: 0, konflikteNochZuMelden: 0, tokenGueltig: true }; }

async function microsoftNachbauen(context, cloud) {
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  await context.route('https://login.microsoftonline.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    if (url.pathname.endsWith('/authorize')) {
      const ziel = new URL(url.searchParams.get('redirect_uri'));
      ziel.searchParams.set('code', 'code-123');
      ziel.searchParams.set('state', url.searchParams.get('state'));
      return route.fulfill({ status: 302, headers: { location: ziel.toString() } });
    }
    if (url.pathname.endsWith('/token')) {
      const form = new URLSearchParams(req.postData() ?? req.postDataBuffer()?.toString() ?? '');
      if (form.get('grant_type') === 'refresh_token' && !cloud.tokenGueltig) return json(route, 400, { error: 'invalid_grant' });
      if (form.get('grant_type') === 'authorization_code' && !form.get('code_verifier')) return json(route, 400, { error: 'invalid_request' });
      return json(route, 200, { access_token: 'tok', refresh_token: 'ref', expires_in: 3600 });
    }
    return route.fulfill({ status: 404 });
  });
  await context.route('https://graph.microsoft.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const auth = (await req.allHeaders()).authorization;
    if (auth !== 'Bearer tok') return json(route, 401, { error: { code: 'InvalidAuthenticationToken' } });
    const pfad = decodeURIComponent(new URL(req.url()).pathname);
    if (pfad.endsWith('/me')) return json(route, 200, { mail: 'familie@example.com' });
    if (pfad.endsWith('vokabel-studio-sync.json') && req.method() === 'GET') {
      if (!cloud.datei) return json(route, 404, { error: { code: 'itemNotFound' } });
      return json(route, 200, { eTag: `"e${cloud.etag}"`, '@microsoft.graph.downloadUrl': `https://download.example.com/datei?e=${cloud.etag}` });
    }
    if (pfad.endsWith('vokabel-studio-sync.json:/content') && req.method() === 'PUT') {
      const ifMatch = (await req.allHeaders())['if-match'];
      if (cloud.konflikteNochZuMelden > 0 || (ifMatch && ifMatch !== `"e${cloud.etag}"`)) {
        cloud.konflikteNochZuMelden = Math.max(0, cloud.konflikteNochZuMelden - 1);
        return json(route, 412, { error: { code: 'resourceModified' } });
      }
      cloud.datei = req.postData(); cloud.etag++; cloud.puts++;
      return json(route, 200, { eTag: `"e${cloud.etag}"` });
    }
    return json(route, 404, {});
  });
  await context.route('https://download.example.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: cloud.datei || '{}' }));
}

async function oneDriveFreischalten(page) {
  await page.evaluate(() => localStorage.setItem('vs-onedrive-client-id', 'test-client-id'));
}

test.describe('OneDrive', () => {
  test('Verbinden über Microsoft-Anmeldung, dann automatisch hochladen', async ({ page }) => {
    const cloud = neueCloud();
    await microsoftNachbauen(page.context(), cloud);
    await profilAnlegen(page, 'Mia');
    await demoLaden(page);
    await geh(page, 'backup');
    await expect(page.locator('[data-verbinden="onedrive"]')).toHaveCount(0);      // ohne Freischaltung kein Knopf
    await expect(page.getByText('Freischaltung bei Microsoft fehlt noch')).toBeVisible();
    await oneDriveFreischalten(page);
    await page.reload();
    await page.click('[data-verbinden="onedrive"]');
    await expect(page.locator('#toast')).not.toBeEmpty();
    expect(await page.locator('#toast').textContent(), 'Meldung der App nach der Anmeldung').toContain('Mit OneDrive verbunden');
    await expect(page).toHaveURL(/#\/backup$/);
    expect(page.url()).not.toContain('code=');
    await expect.poll(() => cloud.puts).toBe(1);
    await geh(page, 'home'); await geh(page, 'backup');
    await expect(page.locator('#abgleich-karte')).toContainText('familie@example.com');
    await expect(page.locator('#ab-status')).toContainText('Zuletzt abgeglichen');
    const inhalt = JSON.parse(cloud.datei);
    expect(inhalt.format).toBe('vokabel-studio-sync');
    expect(inhalt.daten.vokabeln).toHaveLength(26);
  });

  test('Zwei Geräte gleichen über OneDrive ab (inkl. Konflikt)', async ({ page, browser }) => {
    const cloud = neueCloud();
    const verbinde = async (p) => {
      await microsoftNachbauen(p.context(), cloud);
      await app(p, async (m) => {
        await m.db.setMeta('onedrive', { access: 'tok', refresh: 'ref', ablauf: Date.now() + 3_600_000 });
        await m.db.setMeta('cloud', { anbieter: 'onedrive', konto: 'familie@example.com', status: 'ok' });
      });
    };
    const jetztAbgleichen = (p) => p.evaluate(async () => (await import(new URL('js/cloud.js', document.baseURI).href)).abgleichen());
    await profilAnlegen(page, 'Mia');
    await demoLaden(page);
    await verbinde(page);
    await jetztAbgleichen(page);
    expect(cloud.puts).toBe(1);

    const b = await zweitesGeraet(browser, page);
    await verbinde(b);
    const r = await jetztAbgleichen(b);
    expect(r.neu).toBeGreaterThan(30);
    expect(await alle(b, 'vokabeln')).toHaveLength(26);

    // B lernt, A löscht eine Unit; beim Hochladen von A meldet der Server einmal „anderes Gerät war schneller“
    await app(b, async (m) => { const p = (await m.db.all('profile'))[0]; for (const v of (await m.db.all('vokabeln')).slice(0, 4)) await m.L.bewerte(p.id, v.id, 'fd', 'richtig'); });
    await jetztAbgleichen(b);
    const la = (await alle(page, 'units')).find((u) => !/trip/i.test(u.titel));
    await app(page, (m, id) => m.db.deleteUnit(id), la.id);
    cloud.konflikteNochZuMelden = 1;
    await jetztAbgleichen(page);
    await jetztAbgleichen(b);
    for (const g of [page, b]) {
      expect(await alle(g, 'units')).toHaveLength(1);
      expect((await alle(g, 'lernstand')).length).toBeGreaterThanOrEqual(3);   // Lernstand von B (ohne gelöschte Latein-Vokabeln)
    }
    // Nichts geändert → kein erneutes Hochladen
    const vorher = cloud.puts;
    await jetztAbgleichen(page);
    expect(cloud.puts).toBe(vorher);
    await b.context().close();
  });

  test('Abgelaufene Anmeldung: Hinweis auf Startseite und unter Sicherung', async ({ page }) => {
    const cloud = neueCloud();
    cloud.tokenGueltig = false;
    await microsoftNachbauen(page.context(), cloud);
    await profilAnlegen(page);
    await oneDriveFreischalten(page);
    await app(page, async (m) => {
      await m.db.setMeta('onedrive', { access: 'alt', refresh: 'abgelaufen', ablauf: 0 });
      await m.db.setMeta('cloud', { anbieter: 'onedrive', konto: 'familie@example.com', status: 'ok' });
    });
    await page.reload();   // App-Start versucht abzugleichen → Anmeldung abgelaufen
    await expect.poll(() => app(page, async (m) => (await m.db.getMeta('cloud')).status)).toBe('anmelden');
    await geh(page, 'backup');
    await expect(page.locator('#ab-status')).toContainText('Bitte kurz neu anmelden');
    await expect(page.locator('#ab-neu-anmelden')).toBeVisible();
    await geh(page, 'home');
    await expect(page.getByText('Abgleich pausiert')).toBeVisible();
  });
});
