// Lernlogik: Lernstand (Leitner), Antwortvergleich, Ablenker, fällige Wörter
import * as db from './db.js';
import { uid } from './util.js';
import { nachAntwort } from './belohnung.js';

// ---------- Datum ----------
export function isoTag(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export const heute = () => isoTag(new Date());
export function plusTage(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoTag(d); }
export function tageBis(iso) { return Math.round((new Date(iso + 'T12:00:00') - new Date(heute() + 'T12:00:00')) / 86400000); }
export function datumLang(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }); }

// ---------- Leitner ----------
export const INTERVALLE = [0, 1, 2, 4, 8, 16];   // Tage je Kasten 0–5
export const KASTEN_NAMEN = ['neu', 'Kasten 1', 'Kasten 2', 'Kasten 3', 'Kasten 4', 'Kasten 5'];
const lsKey = (p, v, r) => `${p}|${v}|${r}`;

export async function lernstandMap(profilId) {
  const alle = await db.byIndex('lernstand', 'profilId', profilId);
  return new Map(alle.map((l) => [l.key, l]));
}
export const holeLs = (map, profilId, vokabelId, richtung) => map.get(lsKey(profilId, vokabelId, richtung));

/**
 * ergebnis: 'richtig' | 'fast' | 'falsch'. Gibt { punkte, neueAbzeichen } zurück.
 * „fast“ (kleiner Tippfehler): Bei Deutsch → Fremdsprache zählt in der Vokabelarbeit die Rechtschreibung –
 * die Vokabel steigt dann nicht auf, sondern kommt morgen wieder. Bei Fremdsprache → Deutsch zählt „fast“ wie richtig.
 */
export async function bewerte(profilId, vokabelId, richtung, ergebnis, { modus = 'abfrage', antwort = '', zaehlen = true } = {}) {
  const key = lsKey(profilId, vokabelId, richtung);
  const ls = (await db.get('lernstand', key)) || { key, profilId, vokabelId, richtung, box: 0, richtig: 0, falsch: 0, serieRichtig: 0, erstmalsAm: heute() };
  if (ergebnis === 'fast' && richtung === 'df') {
    ls.box = Math.max(1, ls.box);
    ls.richtig++; ls.serieRichtig = 0;
    ls.faelligAm = plusTage(heute(), 1);
  } else if (ergebnis !== 'falsch') {
    ls.box = Math.min(5, ls.box + 1);
    ls.richtig++; ls.serieRichtig++;
    ls.faelligAm = plusTage(heute(), INTERVALLE[ls.box]);
  } else {
    ls.box = 1; ls.falsch++; ls.serieRichtig = 0;
    ls.faelligAm = heute();          // heute noch einmal
  }
  const korrekt = ergebnis !== 'falsch';
  ls.zuletzt = new Date().toISOString();
  await db.batch([
    { store: 'lernstand', op: 'put', value: ls },
    { store: 'ereignisse', op: 'put', value: { id: uid('e'), profilId, zeitpunkt: ls.zuletzt, modus, vokabelId, richtung, korrekt, ergebnis, antwort } }
  ]);
  return zaehlen ? nachAntwort(profilId, ergebnis, modus) : { punkte: 0, neueAbzeichen: [] };
}

// Für Aufgaben ohne Vokabel-Lernstand (Satzbau, Formen, freie Sätze)
export async function protokolliere(profilId, modus, korrekt, { aufgabeId = null, vokabelId = null, antwort = '' } = {}) {
  await db.put('ereignisse', { id: uid('e'), profilId, zeitpunkt: new Date().toISOString(), modus, aufgabeId, vokabelId, korrekt, ergebnis: korrekt ? 'richtig' : 'falsch', antwort });
  return nachAntwort(profilId, korrekt ? 'richtig' : 'falsch', modus);
}

// ---------- Antwortvergleich ----------
const STRIP_ART = /^(der|die|das|ein|eine|einen|einem|einer)\s+/;
export function normAntwort(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̄̆]/g, '').normalize('NFC')   // Längenzeichen weg, Umlaute bleiben
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')   // „Moebel“ = „Möbel“
    .replace(/[’‘`´]/g, "'")
    .replace(/[.,!?;:"„“”‚…–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Erzeugt alle akzeptierten Schreibweisen einer Lösung
export function varianten(text) {
  const out = new Set();
  const basis = String(text || '').replace(/…/g, ' ').trim();
  const formen = new Set([
    basis,
    basis.replace(/\([^)]*\)/g, ' '),          // Klammerinhalt weg: "(to) climb" → "climb"
    basis.replace(/[()]/g, '')                 // Klammern weg: "Beamte(r)" → "Beamter"
  ]);
  for (const f of formen) {
    for (const g of [f, f.replace(/\b(sb|sth|jn|jm|jmdn|jmdm|etw)\b\.?(\s*\/\s*(sb|sth)\.?)?/gi, ' ')]) {
      for (const h of slashVarianten(g)) {
        let n = normAntwort(h);
        if (!n) continue;
        out.add(n);
        out.add(n.replace(/^to /, ''));
        out.add(n.replace(STRIP_ART, ''));
        out.add(n.replace(/^sich /, ''));
      }
    }
  }
  out.delete('');
  return out;
}

function slashVarianten(s) {
  // "Astronaut/in" → Astronaut, Astronautin; "Zimmerer/Zimmerin" → beide
  let liste = [''];
  for (const tok of s.split(/(\s+)/)) {
    let opts;
    const m = /^(.+?)\/(in|innen)$/i.exec(tok);
    if (m) opts = [m[1], m[1] + m[2]];
    else if (/\S\/\S/.test(tok)) opts = tok.split('/');
    else opts = [tok];
    liste = liste.flatMap((a) => opts.map((o) => a + o)).slice(0, 24);
  }
  return liste;
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** loesungen: Array von Strings. Ergebnis 'richtig' | 'fast' | 'falsch' */
export function pruefeAntwort(eingabe, loesungen) {
  const e = normAntwort(eingabe);
  const e2 = e.replace(/^to /, '').replace(STRIP_ART, '').replace(/^sich /, '');
  if (!e) return { ergebnis: 'falsch' };
  let bestes = null;
  for (const l of loesungen) {
    for (const v of varianten(l)) {
      if (v === e || v === e2) return { ergebnis: 'richtig', treffer: l };
      const d = Math.min(levenshtein(v, e), levenshtein(v, e2));
      const grenze = v.length >= 10 ? 2 : v.length >= 5 ? 1 : 0;
      if (d <= grenze && (!bestes || d < bestes.d)) bestes = { d, l };
    }
  }
  return bestes ? { ergebnis: 'fast', treffer: bestes.l } : { ergebnis: 'falsch' };
}

// Frage/Lösung je Richtung. fd = Fremdsprache → Deutsch, df = Deutsch → Fremdsprache
export function frage(v, richtung) { return richtung === 'fd' ? v.wort : v.bedeutungen.join('; '); }
export function loesungen(v, richtung) { return richtung === 'fd' ? v.bedeutungen : [v.wort]; }

// ---------- Ablenker für Multiple Choice ----------
export function ablenker(v, richtung, pool, n = 3) {
  const text = (x) => (richtung === 'fd' ? x.bedeutungen[0] : x.wort);
  const ziel = text(v).toLowerCase();
  const kandidaten = mische(pool.filter((x) => x.id !== v.id && text(x) && text(x).toLowerCase() !== ziel));
  kandidaten.sort((a, b) => (b.wortart === v.wortart) - (a.wortart === v.wortart));
  const out = [], gesehen = new Set([ziel]);
  for (const k of kandidaten) {
    const t = text(k);
    if (gesehen.has(t.toLowerCase())) continue;
    gesehen.add(t.toLowerCase()); out.push(t);
    if (out.length >= n) break;
  }
  return out;
}

export function mische(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- Vokabeln laden ----------
export async function vokabelnFuerUnits(unitIds) {
  const listen = await Promise.all(unitIds.map((id) => db.byIndex('vokabeln', 'unitId', id)));
  return listen.flat();
}

export function richtungen(profil, uebersteuern) {
  const r = uebersteuern || profil?.einstellungen?.abfrageRichtung || 'beide';
  return r === 'fremd-deutsch' || r === 'fd' ? ['fd'] : r === 'deutsch-fremd' || r === 'df' ? ['df'] : ['fd', 'df'];
}

/** Units, die zum Profil passen (Fächer im Profil). Ohne Fächerauswahl: alle. */
export async function profilUnitIds(profil) {
  const [units, lehrwerke] = await Promise.all([db.all('units'), db.all('lehrwerke')]);
  const fach = new Map(lehrwerke.map((l) => [l.id, l.fachId]));
  const f = profil?.fachIds;
  return units.filter((u) => !f?.length || f.includes(fach.get(u.lehrwerkId))).map((u) => u.id);
}

async function vokabelIdsFuerUnits(unitIds) {
  return (await Promise.all(unitIds.map((id) => db.keysByIndex('vokabeln', 'unitId', id)))).flat();
}

/** Wie viele Vokabeln hat das Profil heute zum ersten Mal gesehen? (für das Tagesziel) */
function heuteNeuEingefuehrt(map) {
  const h = heute(), ids = new Set();
  for (const l of map.values()) if (l.erstmalsAm === h) ids.add(l.vokabelId);
  return ids.size;
}

/**
 * Kern: teilt Vokabel-IDs in fällige und neue Paare (Vokabel × Richtung).
 * Neue Vokabeln werden auf das Tagesziel begrenzt („Neue Vokabeln pro Tag“) – gezählt wird über alle Sitzungen des Tages.
 * Ist eine Vokabel in einer Richtung schon bekannt, zählt die andere Richtung nicht gegen das Tagesziel.
 */
function teile(profil, ids, map, richtungOverride, limitNeu) {
  const h = heute();
  const rs = richtungen(profil, richtungOverride);
  const faellig = [], neu = [], neuVokIds = new Set(), faelligVokIds = new Set();
  for (const id of ids) {
    const bekannt = ['fd', 'df'].some((r) => holeLs(map, profil.id, id, r));
    for (const r of rs) {
      const ls = holeLs(map, profil.id, id, r);
      if (!ls) { neu.push({ id, richtung: r, box: 0, ganzNeu: !bekannt }); neuVokIds.add(id); }
      else if ((ls.faelligAm || h) <= h) { faellig.push({ id, richtung: r, box: ls.box }); faelligVokIds.add(id); }
    }
  }
  faellig.sort((a, b) => a.box - b.box);
  const ziel = limitNeu ?? (profil.einstellungen?.tagesziel || 20);
  const rest = Math.max(0, ziel - heuteNeuEingefuehrt(map));
  const erlaubt = new Set([...new Set(neu.filter((p) => p.ganzNeu).map((p) => p.id))].slice(0, rest));
  const neuHeute = neu.filter((p) => !p.ganzNeu || erlaubt.has(p.id));
  return {
    faellig, neu: neuHeute, neuGesamt: neu.length,
    // für Anzeigen: Anzahl Vokabeln (nicht Paare)
    faelligVok: faelligVokIds.size, neuVok: neuVokIds.size, neuHeuteVok: new Set(neuHeute.map((p) => p.id)).size, tagesRest: rest
  };
}

/** Nur Zahlen (lädt keine Vokabeln, nur deren IDs) – für Startseite, Lernplan, Lernen-Übersicht. */
export async function faelligZahlen(profil, { unitIds = null, richtungOverride = null } = {}) {
  const ids = await vokabelIdsFuerUnits(unitIds || (await profilUnitIds(profil)));
  const t = teile(profil, ids, await lernstandMap(profil.id), richtungOverride);
  return { faellig: t.faelligVok, neu: t.neuVok, neuHeute: t.neuHeuteVok, tagesRest: t.tagesRest, paare: t.faellig.length + t.neu.length };
}

/** Fällige und neue Paare (Vokabel × Richtung) mit den Vokabeln selbst. */
export async function faelligePaare(profil, { unitIds = null, richtungOverride = null, limitNeu = null } = {}) {
  const voks = await vokabelnFuerUnits(unitIds || (await profilUnitIds(profil)));
  const nachId = new Map(voks.map((v) => [v.id, v]));
  const t = teile(profil, voks.map((v) => v.id), await lernstandMap(profil.id), richtungOverride, limitNeu);
  const mitV = (p) => ({ v: nachId.get(p.id), richtung: p.richtung, box: p.box });
  return { ...t, faellig: t.faellig.map(mitV), neu: t.neu.map(mitV), alle: voks };
}

/** Übersicht je Profil: wie viele Vokabeln in welchem Kasten (Richtung fd zählt). */
export async function kastenStatistik(profilId, unitIds = null) {
  const ids = unitIds ? await vokabelIdsFuerUnits(unitIds) : await db.keys('vokabeln');
  const map = await lernstandMap(profilId);
  const zaehl = [0, 0, 0, 0, 0, 0];
  for (const id of ids) {
    const ls = holeLs(map, profilId, id, 'fd');
    zaehl[ls ? ls.box : 0]++;
  }
  return { zaehl, gesamt: ids.length, sicher: zaehl[4] + zaehl[5] };
}

// ---------- Antwortprotokoll aufräumen ----------
// Jede Antwort wird als „Ereignis“ gespeichert. Damit Sicherung und Eltern-Ansicht nicht immer größer/langsamer werden,
// werden Einträge älter als 60 Tage je Profil zusammengefasst (Anzahl, richtig, Fehler je Vokabel, letzter Lerntag).
export const PROTOKOLL_TAGE = 60;
export async function archiviereEreignisse() {
  if ((await db.getMeta('archiviertAm')) === heute()) return 0;
  const grenze = plusTage(heute(), -PROTOKOLL_TAGE);
  const alt = (await db.all('ereignisse')).filter((e) => isoTag(e.zeitpunkt) < grenze);
  const proProfil = new Map();
  alt.forEach((e) => { if (!proProfil.has(e.profilId)) proProfil.set(e.profilId, []); proProfil.get(e.profilId).push(e); });
  const ops = [];
  for (const [profilId, liste] of proProfil) {
    const b = (await db.get('belohnungen', profilId)) || { profilId, punkte: 0, serie: { aktuell: 0, rekord: 0 }, abzeichen: [] };
    const a = { antworten: 0, richtig: 0, falschJeVokabel: {}, letzte: '', ...(b.archiv || {}) };
    for (const e of liste) {
      a.antworten++;
      if (e.korrekt) a.richtig++;
      else if (e.vokabelId) a.falschJeVokabel[e.vokabelId] = (a.falschJeVokabel[e.vokabelId] || 0) + 1;
      if (e.zeitpunkt > a.letzte) a.letzte = e.zeitpunkt;
      ops.push({ store: 'ereignisse', op: 'del', key: e.id });
    }
    b.archiv = a;
    ops.push({ store: 'belohnungen', op: 'put', value: b });
  }
  if (ops.length) await db.batch(ops);
  await db.setMeta('archiviertAm', heute());
  return alt.length;
}
