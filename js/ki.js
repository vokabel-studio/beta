// Direkte KI-Anbindung (optional): Foto → Vokabel-JSON, eigene Sätze prüfen.
// Der Schlüssel liegt nur auf diesem Gerät (IndexedDB „meta“) und ist NICHT Teil der Sicherungsdatei.
// Aufrufe gehen direkt vom Browser an den Anbieter (alle drei erlauben das, geprüft 23.11.2026).
// Robustheit (nach Test 23.11.: Gemini 503 „high demand“, Test hing):
//   Zeitlimit je Anfrage, automatische Wiederholung bei Überlastung, Ausweichen auf weitere Modelle.
import * as db from './db.js';

export const ANBIETER = {
  gemini: {
    name: 'Google Gemini', schluesselUrl: 'https://aistudio.google.com/apikey',
    daten: 'Kostenlos ohne Kreditkarte. Achtung: Im Gratis-Zugang darf Google eingesendete Inhalte zur Verbesserung nutzen. Die neuesten Modelle sind manchmal überlastet – die App weicht dann automatisch auf andere aus.',
    standard: /flash/i
  },
  mistral: {
    name: 'Mistral', schluesselUrl: 'https://console.mistral.ai/api-keys',
    daten: 'Kostenloser „Experiment“-Plan mit Telefonnummer; dafür muss man dem Training mit den Daten zustimmen. Gedacht zum Ausprobieren.',
    standard: /(pixtral|mistral-(small|medium))/i
  },
  groq: {
    name: 'Groq', schluesselUrl: 'https://console.groq.com/keys',
    daten: 'Kostenlos ohne Kreditkarte, begrenzt durch Nutzungslimits. Laut Groq kein Training mit den Daten.',
    standard: /(llama-4|vision|qwen.*vl|scout|maverick)/i
  },
  openrouter: {
    name: 'OpenRouter', schluesselUrl: 'https://openrouter.ai/settings/keys',
    daten: 'Kostenlos ohne Kreditkarte: Die App zeigt nur Gratis-Modelle („free“). Limit: 50 Anfragen am Tag, 20 pro Minute (mit einmalig 10 $ Guthaben 1000 am Tag). Achtung: Die Betreiber der Gratis-Modelle dürfen Eingaben teils speichern und zum Training nutzen. Die Auswahl an Gratis-Modellen ändert sich oft.',
    standard: /(vl\b|vl[-:]|vision|gemma|openrouter\/free)/i
  }
};
// Bei diesen Anbietern gilt das Limit (429) fürs ganze Konto → warten statt nächstes Modell
const KONTO_LIMIT = ['mistral', 'groq'];

// Einstellungen: mehrere Anbieter gleichzeitig möglich.
// { haupt: 'gemini', konten: { gemini: { schluessel, modell, ausweich: [] }, groq: {…} } }
export async function einstellungen() {
  const e = await db.getMeta('ki');
  if (!e) return { haupt: 'gemini', konten: {} };
  if (!e.konten) {   // altes Format (ein Anbieter) übernehmen
    return { haupt: e.anbieter || 'gemini', konten: e.schluessel ? { [e.anbieter]: { schluessel: e.schluessel, modell: e.modell, ausweich: e.ausweich || [] } } : {} };
  }
  return e;
}
const eingerichtet = (k) => !!(k && k.schluessel && k.modell);
export async function speichereKonto(anbieter, konto) {
  const e = await einstellungen();
  e.konten[anbieter] = konto;
  if (!eingerichtet(e.konten[e.haupt])) e.haupt = anbieter;
  await db.setMeta('ki', e);
}
export async function entferneKonto(anbieter) {
  const e = await einstellungen();
  delete e.konten[anbieter];
  if (e.haupt === anbieter) e.haupt = Object.keys(e.konten).find((a) => eingerichtet(e.konten[a])) || 'gemini';
  await db.setMeta('ki', e);
}
export async function setzeHaupt(anbieter) { const e = await einstellungen(); e.haupt = anbieter; await db.setMeta('ki', e); }
export async function entferne() { await db.del('meta', 'ki'); }
/** Eingerichtete Anbieter in der Reihenfolge, in der sie versucht werden (Hauptanbieter zuerst) */
export function reihenfolge(e) {
  const alle = Object.keys(ANBIETER).filter((a) => eingerichtet(e.konten[a]));
  return alle.sort((a, b) => (b === e.haupt) - (a === e.haupt));
}
export async function aktiv() { return reihenfolge(await einstellungen()).length > 0; }
export async function anzeigeName() {
  const r = reihenfolge(await einstellungen());
  return r.map((a) => ANBIETER[a].name).join(' + ');
}

// ---------- Fehler ----------
export class KiFehler extends Error {
  constructor(text, { status = 0, uebergang = false, detail = '', warten = 0 } = {}) { super(text); this.status = status; this.uebergang = uebergang; this.detail = detail; this.warten = warten; }
}
const UEBERLAST = [429, 500, 502, 503, 504];

async function pruefeAntwort(res, anbieter, modell) {
  if (res.ok) return res.json();
  let detail = '';
  try { const j = await res.json(); detail = j.error?.message || j.detail || j.message || JSON.stringify(j).slice(0, 200); } catch { /* egal */ }
  const n = ANBIETER[anbieter].name;
  const m = modell ? ` (${modell})` : '';
  const text = {
    400: `${n} hat die Anfrage abgelehnt. ${/key/i.test(detail) ? 'Der Schlüssel ist ungültig.' : 'Vielleicht kann das gewählte Modell keine Fotos lesen – anderes Modell wählen.'}`,
    401: `Der Schlüssel für ${n} ist ungültig oder abgelaufen.`,
    402: `Bei ${n} fehlt Guthaben (oder das Konto ist im Minus). Gratis-Modelle gehen dann auch nicht.`,
    403: `${n} verweigert den Zugriff. Ist der Schlüssel freigeschaltet?`,
    404: `Das Modell${m} gibt es bei ${n} nicht (mehr). Bitte in den Eltern-Einstellungen ein anderes wählen.`,
    413: 'Das Foto ist zu groß.',
    429: `Das kostenlose Limit bei ${n}${m} ist gerade erreicht.`,
    503: `${n}${m} ist gerade überlastet.`
  }[res.status] || `${n}${m} meldet einen Fehler (${res.status}).`;
  const warten = Math.min(30, parseFloat(res.headers.get('retry-after')) || 0);
  throw new KiFehler(text + (detail ? `\n(Details: ${detail.slice(0, 160)})` : ''), { status: res.status, uebergang: UEBERLAST.includes(res.status), detail, warten });
}

async function hole(url, opts, anbieter, { timeoutMs = 60000, modell = '' } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  let res;
  try { res = await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) {
    clearTimeout(t);
    if (e.name === 'AbortError') throw new KiFehler(`${ANBIETER[anbieter].name} hat nach ${Math.round(timeoutMs / 1000)} Sekunden nicht geantwortet.`, { status: 'zeit', uebergang: true });
    throw new KiFehler('Keine Verbindung zum KI-Dienst. Ist das Internet an?', { status: 'netz' });
  }
  clearTimeout(t);
  return pruefeAntwort(res, anbieter, modell);
}

// ---------- Modelle ----------
export async function modelle(anbieter, schluessel) {
  if (anbieter === 'gemini') {
    const j = await hole('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': schluessel } }, anbieter, { timeoutMs: 20000 });
    return (j.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini|gemma/i.test(m.name) && !/embedding|tts|image-generation|live|audio/i.test(m.name))
      .map((m) => ({ id: m.name.replace(/^models\//, ''), name: m.displayName || m.name }))
      .sort(sortiere);
  }
  if (anbieter === 'openrouter') {
    // Die Modell-Liste ist öffentlich – deshalb zuerst den Schlüssel selbst prüfen
    await hole('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${schluessel}` } }, anbieter, { timeoutMs: 20000 });
    const j = await hole('https://openrouter.ai/api/v1/models', {}, anbieter, { timeoutMs: 20000 });
    const gratis = (m) => /:free$/.test(m.id) || m.id === 'openrouter/free' || (m.pricing && +m.pricing.prompt === 0 && +m.pricing.completion === 0 && !+m.pricing.request);
    return (j.data || []).filter(gratis)
      .map((m) => ({ id: m.id, name: m.name || m.id, bild: Array.isArray(m.architecture?.input_modalities) ? m.architecture.input_modalities.includes('image') : undefined }))
      .sort((a, b) => ((b.bild === true) - (a.bild === true)) || sortiere(a, b));
  }
  const url = anbieter === 'mistral' ? 'https://api.mistral.ai/v1/models' : 'https://api.groq.com/openai/v1/models';
  const j = await hole(url, { headers: { Authorization: `Bearer ${schluessel}` } }, anbieter, { timeoutMs: 20000 });
  return (j.data || [])
    .filter((m) => m.active !== false && !/embed|whisper|tts|guard|moderation|ocr|codestral|transcri/i.test(m.id))
    .map((m) => ({ id: m.id, name: m.id, bild: m.capabilities?.vision }))
    .sort(sortiere);
}
function sortiere(a, b) {
  const v = (x) => parseFloat((/(\d+(\.\d+)?)/.exec(x.id) || [0, 0])[1]);
  return v(b) - v(a) || a.id.localeCompare(b.id);
}
export function vorschlag(anbieter, liste) {
  const re = ANBIETER[anbieter].standard;
  const passend = liste.filter((m) => re.test(m.id) && m.bild !== false && !/lite|preview|exp|thinking/i.test(m.id));
  return (passend[0] || liste.find((m) => re.test(m.id)) || liste[0])?.id || '';
}
/**
 * Bis zu 4 Ausweichmodelle. Erfahrung (Test 23.11.2026): Die neuesten Vorschau-Modelle sind im Gratis-Zugang
 * oft gleichzeitig überlastet – deshalb zuerst stabile Modelle (ohne „preview“), gern ältere Generationen.
 */
export function ausweichListe(anbieter, liste, gewaehlt) {
  const re = ANBIETER[anbieter].standard;
  const kandidaten = liste.filter((m) => m.id !== gewaehlt && re.test(m.id) && m.bild !== false && !/exp|thinking|tts|image/i.test(m.id));
  const stabil = (m) => !/preview/i.test(m.id);
  const generation = (m) => (/\d+(\.\d+)?/.exec(m.id) || ['0'])[0];
  kandidaten.sort((x, y) => (stabil(y) - stabil(x)) || sortiere(x, y));
  // möglichst verschiedene Generationen mischen (z. B. 2.5 und 2.0), damit nicht alle gleichzeitig ausfallen
  const out = [], gesehen = new Set();
  for (const m of kandidaten) { const g = generation(m) + (/lite/i.test(m.id) ? 'l' : ''); if (!gesehen.has(g)) { gesehen.add(g); out.push(m.id); } }
  for (const m of kandidaten) if (!out.includes(m.id)) out.push(m.id);
  return out.slice(0, 4);
}

// ---------- Bild vorbereiten ----------
export function bildVorbereiten(file, maxSeite = 1800, qualitaet = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const f = Math.min(1, maxSeite / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * f); c.height = Math.round(img.naturalHeight * f);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const daten = c.toDataURL('image/jpeg', qualitaet);
      resolve({ mime: 'image/jpeg', base64: daten.split(',')[1], dataUrl: daten, breite: c.width, hoehe: c.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new KiFehler('Das Bild konnte nicht gelesen werden. Bitte ein Foto im JPG- oder PNG-Format wählen.')); };
    img.src = url;
  });
}

// ---------- eine Anfrage an ein bestimmtes Modell ----------
async function anfrage(anbieter, schluessel, modell, prompt, { bilder, json, timeoutMs }) {
  const zuLang = () => new KiFehler('Die Antwort war zu lang und wurde abgeschnitten. Bitte weniger Vokabeln pro Foto (z. B. halbe Seite).', { status: 'inhalt' });
  if (anbieter === 'gemini') {
    // „Nachdenken“ der neueren Modelle kostet viel Zeit und hilft beim Abschreiben nicht → möglichst abschalten
    const denken = /gemini-2\.5-flash/i.test(modell) ? { thinkingBudget: 0 } : /gemini-3/i.test(modell) ? { thinkingLevel: 'low' } : null;
    const senden = (mitDenken) => {
      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }, ...bilder.map((b) => ({ inline_data: { mime_type: b.mime, data: b.base64 } }))] }],
        generationConfig: { temperature: 0.2, ...(json ? { responseMimeType: 'application/json' } : {}), ...(mitDenken && denken ? { thinkingConfig: denken } : {}) }
      };
      return hole(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modell)}:generateContent`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': schluessel }, body: JSON.stringify(body) }, 'gemini', { timeoutMs, modell });
    };
    let j;
    try { j = await senden(true); }
    catch (err) { if (denken && err.status === 400 && /think/i.test(err.detail || '')) j = await senden(false); else throw err; }
    const kand = j.candidates?.[0];
    if (!kand) throw new KiFehler('Gemini hat keine Antwort geliefert' + (j.promptFeedback?.blockReason ? ` (blockiert: ${j.promptFeedback.blockReason})` : '') + '.', { status: 'leer', uebergang: true });
    if (kand.finishReason === 'MAX_TOKENS') throw zuLang();
    return (kand.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  }
  const url = { mistral: 'https://api.mistral.ai/v1/chat/completions', groq: 'https://api.groq.com/openai/v1/chat/completions', openrouter: 'https://openrouter.ai/api/v1/chat/completions' }[anbieter];
  // Viele Gratis-Modelle bei OpenRouter kennen keinen JSON-Modus → dort weglassen (die App repariert/prüft die Antwort ohnehin)
  if (anbieter === 'openrouter') json = false;
  const inhalt = bilder.length
    ? [{ type: 'text', text: prompt }, ...bilder.map((b) => (anbieter === 'mistral'
      ? { type: 'image_url', image_url: b.dataUrl }
      : { type: 'image_url', image_url: { url: b.dataUrl } }))]
    : prompt;
  const body = { model: modell, temperature: 0.2, messages: [{ role: 'user', content: inhalt }], ...(json ? { response_format: { type: 'json_object' } } : {}) };
  const j = await hole(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${schluessel}` }, body: JSON.stringify(body) }, anbieter, { timeoutMs, modell });
  // OpenRouter meldet Fehler des eigentlichen Modell-Betreibers teils mit Status 200 im Inhalt
  if (j.error) {
    const st = +j.error.code || 'leer';
    throw new KiFehler(`${ANBIETER[anbieter].name} (${modell}): ${j.error.message || 'Fehler beim Modell-Betreiber'}`, { status: st, uebergang: true, detail: j.error.message || '' });
  }
  const wahl = j.choices?.[0];
  if (!wahl) throw new KiFehler('Keine Antwort erhalten.', { status: 'leer', uebergang: true });
  if (wahl.finish_reason === 'length') throw zuLang();
  const c = wahl.message?.content;
  return Array.isArray(c) ? c.map((x) => x.text || '').join('') : (c || '');
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const kurz = (st) => ({ 429: 'Limit erreicht', 503: 'überlastet', 500: 'Serverfehler', 502: 'Serverfehler', 504: 'Serverfehler', zeit: 'keine Antwort', netz: 'keine Verbindung', 400: 'abgelehnt', 401: 'Schlüssel ungültig', 403: 'kein Zugriff', 404: 'Modell fehlt', leer: 'leere Antwort' }[st] || `Fehler ${st}`);

/**
 * Schickt Text (+ optional Bilder) an die eingerichteten Anbieter der Reihe nach (Hauptanbieter zuerst).
 * Je Modell: bei Überlastung 1 Wiederholung nach 3 s; bei Zeitüberschreitung sofort weiter.
 * Limit (429): Gemini → nächstes Modell; Mistral/Groq (Kontolimit) → warten (Retry-After, mind. 2 s), 1× wiederholen, dann nächster Anbieter.
 * Danach Ausweichmodelle, danach nächster Anbieter. onStatus(text) meldet Zwischenstände.
 */
export async function frage(prompt, { bilder = [], json = false, onStatus = () => {}, timeoutMs } = {}) {
  const e = await einstellungen();
  const anbieterListe = reihenfolge(e);
  if (!anbieterListe.length) throw new KiFehler('Die KI ist noch nicht eingerichtet (Eltern › KI-Anbindung).');
  const zeit = timeoutMs || (bilder.length ? 90000 : 30000);
  const protokoll = [];
  let erster = true;
  for (const anbieter of anbieterListe) {
    const konto = e.konten[anbieter];
    const name = ANBIETER[anbieter].name;
    const kontoLimit = KONTO_LIMIT.includes(anbieter);
    for (const modell of [konto.modell, ...(konto.ausweich || [])]) {
      if (!erster) onStatus(`Versuche ${name} (${modell}) …`);
      erster = false;
      let naechster = false;
      for (let versuch = 0; versuch < 2 && !naechster; versuch++) {
        try {
          const text = await anfrage(anbieter, konto.schluessel, modell, prompt, { bilder, json, timeoutMs: zeit });
          if (protokoll.length) onStatus(`Geklappt mit ${name} (${modell}).`);
          return text;
        } catch (err) {
          if (!(err instanceof KiFehler) || err.status === 'inhalt') throw err;     // Inhaltsproblem: anderer Anbieter hilft nicht
          const det = err.detail ? ` („${err.detail.replace(/\s+/g, ' ').slice(0, 70)}“)` : '';
          protokoll.push(`${name} ${modell}: ${kurz(err.status)}${det}`);
          if (!err.uebergang) { naechster = 'anbieter'; break; }                     // Schlüssel/Zugriff → nächster Anbieter
          if (err.status === 'zeit' || versuch === 1) { naechster = err.status === 429 && kontoLimit ? 'anbieter' : true; break; }
          if (err.status === 429) {
            // Gemini: Limit gilt je Modell → nächstes Modell. Mistral/Groq: Limit gilt fürs ganze Konto → kurz warten, dann gleiches Modell
            if (!kontoLimit) { naechster = true; break; }
            const s = Math.max(2, Math.ceil(err.warten || 2));
            for (let r = s; r > 0; r--) { onStatus(`${name}: Limit erreicht. Neuer Versuch in ${r} s …`); await warte(1000); }
            continue;
          }
          for (let r = 3; r > 0; r--) { onStatus(`${name} (${modell}) ist überlastet. Neuer Versuch in ${r} s …`); await warte(1000); }
        }
      }
      if (naechster === 'anbieter') break;
    }
  }
  const tipp = anbieterListe.length === 1
    ? 'Tipp: Einen zweiten Anbieter (z. B. Groq oder OpenRouter) unter Eltern › KI-Anbindung einrichten – dann weicht die App automatisch aus.'
    : 'Bitte später noch einmal versuchen.';
  throw new KiFehler(`Kein KI-Dienst hat geantwortet. ${tipp} Oder den Weg über Kopieren nutzen.\nVersucht: ${[...new Set(protokoll)].join(' · ')}`, { status: 'alle' });
}

/** Verbindungstest für einen Anbieter (oder die ganze Kette) */
export async function teste(onStatus) {
  const t = await frage('Antworte nur mit dem Wort: OK', { onStatus, timeoutMs: 25000 });
  return t.trim().slice(0, 40);
}
