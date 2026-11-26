// Hör-Quiz („Auto-Modus“): Die App liest ein Wort vor, macht eine Denkpause, sagt dann die Lösung.
// Gedacht für unterwegs: Handy per CarPlay/Android Auto/Bluetooth verbunden, der Ton kommt über das Auto.
// Kein Antippen nötig, keine Bewertung (die App hört nicht zu) – der Lernstand bleibt unverändert.
// Einschränkung: Browser lesen nur vor, solange die App im Vordergrund und der Bildschirm an ist → Wake Lock.
import { $, toast, plural } from './util.js';
import { sprich, ttsVerfuegbar } from './speech.js';
import * as L from './lernen.js';
import { unitKontext } from './lern-views.js';

let Q = null;   // { cfg, items, i, laeuft, pause, token, neustart, wake }
const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));
const sprechText = (v) => v.wort.replace(/^\(to\)\s*/, 'to ').replace(/…/g, '');

/** Aufruf aus dem Lernen-Bereich: hoerquiz?units=…&richtung=…&anzahl=… */
export async function hoerquizView({ query }, ctx) {
  if (!ctx.profil) { ctx.go('profile'); return null; }
  const unitIds = (query.units || '').split(',').filter(Boolean);
  if (!unitIds.length) { ctx.go('lernen'); return null; }
  stoppe();
  const { fachVonUnit } = await unitKontext();
  const voks = await L.vokabelnFuerUnits(unitIds);
  const e = ctx.profil.einstellungen || {};
  const gemerkt = (() => { try { return JSON.parse(localStorage.getItem('hq-einstellung') || '{}'); } catch { return {}; } })();
  const html = `
    <div class="card">
      <h2 style="margin-top:0">🚗 Hör-Quiz</h2>
      <p>Die App sagt ein Wort, ihr antwortet laut, dann kommt die Lösung. Ideal im Auto: Handy per <strong>CarPlay, Android Auto oder Bluetooth</strong> verbinden – der Ton läuft über die Lautsprecher.</p>
      <p class="small muted">${plural(voks.length, 'Vokabel', 'Vokabeln')} ausgewählt. Das Hör-Quiz zählt nicht für den Lernstand.</p>
    </div>
    ${ttsVerfuegbar() ? '' : '<div class="msg err">Dieser Browser kann nicht vorlesen.</div>'}
    <div class="field-row">
      <div><label for="hq-richtung">Was wird gesagt?</label><select id="hq-richtung">
        <option value="fd">Fremdwort → Deutsch</option><option value="df">Deutsch → Fremdwort</option><option value="beide">gemischt</option></select></div>
      <div><label for="hq-pause">Denkpause</label><select id="hq-pause">
        ${[3, 5, 8, 12].map((s) => `<option value="${s}">${s} Sekunden</option>`).join('')}</select></div>
    </div>
    <div class="field-row">
      <div><label for="hq-anzahl">Wie viele?</label><select id="hq-anzahl">
        ${[10, 20, 30, 0].map((n) => `<option value="${n}">${n || 'alle'}</option>`).join('')}</select></div>
      <div><label for="hq-tempo">Sprechtempo</label><select id="hq-tempo">
        ${[[0.75, 'langsam'], [0.9, 'normal'], [1.05, 'schnell']].map(([w, t]) => `<option value="${w}">${t}</option>`).join('')}</select></div>
    </div>
    <label class="switch" style="margin-top:12px"><input type="checkbox" id="hq-bsp"> Beispielsatz nach der Lösung vorlesen</label>
    <label class="switch"><input type="checkbox" id="hq-wdh"> Fremdwort am Ende noch einmal zum Nachsprechen</label>
    <button class="btn block" id="hq-start" style="min-height:72px;font-size:20px;margin-top:16px" ${voks.length && ttsVerfuegbar() ? '' : 'disabled'}>▶️ Hör-Quiz starten</button>
    <div class="msg info small" style="margin-top:14px"><strong>Gut zu wissen:</strong> Der Bildschirm muss an und die App geöffnet bleiben – bei gesperrtem Handy hört das Vorlesen auf. Die App hält den Bildschirm wach, soweit das Gerät es erlaubt.
      Bedienen sollte das Kind oder der Beifahrer, nicht wer fährt. Spiel-Idee: Wer zuerst richtig ruft, bekommt den Punkt.</div>`;
  return {
    title: 'Hör-Quiz', back: 'lernen', html,
    bind(root) {
      const setze = (id, w) => { if (w !== undefined && w !== null) $(id, root).value = String(w); };
      setze('#hq-richtung', gemerkt.richtung || (query.richtung && query.richtung !== 'beide' ? query.richtung : e.abfrageRichtung === 'deutsch-fremd' ? 'df' : 'fd'));
      setze('#hq-pause', gemerkt.pause || 5);
      setze('#hq-anzahl', query.anzahl ?? 20);
      setze('#hq-tempo', gemerkt.tempo || 0.9);
      $('#hq-bsp', root).checked = !!gemerkt.beispiel;
      $('#hq-wdh', root).checked = gemerkt.wiederholen !== false;
      $('#hq-start', root).onclick = () => {
        const cfg = {
          richtung: $('#hq-richtung', root).value, pause: +$('#hq-pause', root).value, anzahl: +$('#hq-anzahl', root).value,
          tempo: +$('#hq-tempo', root).value, beispiel: $('#hq-bsp', root).checked, wiederholen: $('#hq-wdh', root).checked
        };
        try { localStorage.setItem('hq-einstellung', JSON.stringify(cfg)); } catch { /* egal */ }
        // iOS/Android: Vorlesen muss durch ein Tippen „freigeschaltet“ werden → sofort eine leere Ansage
        try { speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch { /* egal */ }
        const rs = cfg.richtung === 'beide' ? ['fd', 'df'] : [cfg.richtung];
        const auswahl = L.mische(voks);
        const items = (cfg.anzahl ? auswahl.slice(0, cfg.anzahl) : auswahl).map((v) => ({ v, fach: fachVonUnit.get(v.unitId), richtung: rs[Math.floor(Math.random() * rs.length)] }));
        starte(root, cfg, items, ctx);
      };
    }
  };
}

function stoppe() {
  if (!Q) return;
  Q.token = null;
  try { speechSynthesis.cancel(); } catch { /* egal */ }
  Q.wake?.release?.().catch(() => {});
  document.removeEventListener('visibilitychange', Q.sichtbar);
  window.removeEventListener('hashchange', Q.weg);
  Q = null;
}

async function wachHalten() {
  if (!Q || !('wakeLock' in navigator)) return false;
  try { Q.wake = await navigator.wakeLock.request('screen'); return true; } catch { return false; }
}

function starte(root, cfg, items, ctx) {
  stoppe();
  const token = {};
  Q = { cfg, items, i: 0, pause: false, neustart: false, token };
  root.innerHTML = `
    <div class="sess-head"><span id="hq-nr"></span><span class="grow"><span class="bar"><span id="hq-bar" style="width:0%"></span></span></span></div>
    <div class="card flash hq-karte">
      <div class="muted small" id="hq-hinweis">&nbsp;</div>
      <div class="wort hq-wort" id="hq-frage">…</div>
      <div class="hq-status" id="hq-status">Gleich geht's los</div>
      <div class="de hq-loesung" id="hq-loesung">&nbsp;</div>
    </div>
    <div class="hq-knoepfe">
      <button class="btn" id="hq-pp">⏸ Pause</button>
      <button class="btn secondary" id="hq-skip">⏭ Weiter</button>
    </div>
    <button class="btn danger block" id="hq-stop">⏹ Beenden</button>
    <p class="muted small" id="hq-wach" style="text-align:center"></p>`;
  wachHalten().then((ok) => { const w = $('#hq-wach', root); if (w) w.textContent = ok ? '🔆 Bildschirm bleibt an.' : 'Tipp: Automatische Bildschirmsperre für die Fahrt ausschalten.'; });
  Q.sichtbar = () => {
    if (!Q) return;
    if (document.visibilityState === 'visible') { wachHalten(); Q.neustart = true; }   // nach dem Zurückkommen das Wort neu beginnen
    else try { speechSynthesis.cancel(); } catch { /* egal */ }
  };
  Q.weg = () => stoppe();
  document.addEventListener('visibilitychange', Q.sichtbar);
  window.addEventListener('hashchange', Q.weg);

  $('#hq-pp', root).onclick = () => {
    if (!Q) return;
    Q.pause = !Q.pause;
    $('#hq-pp', root).textContent = Q.pause ? '▶️ Weiter' : '⏸ Pause';
    if (Q.pause) { Q.neustart = true; try { speechSynthesis.cancel(); } catch { /* egal */ } $('#hq-status', root).textContent = 'Pause'; }
  };
  $('#hq-skip', root).onclick = () => { if (Q) { Q.skip = true; try { speechSynthesis.cancel(); } catch { /* egal */ } } };
  $('#hq-stop', root).onclick = () => { stoppe(); ctx.go('lernen'); };
  lauf(root, token, ctx).catch((e) => { console.error(e); toast('Hör-Quiz: ' + e.message); });
}

async function lauf(root, token, ctx) {
  const cfg = Q.cfg;
  const aktiv = () => Q && Q.token === token;
  const zeige = (id, t) => { const el = $(id, root); if (el) el.textContent = t; };
  // wartet bis Pause vorbei; true = aktuelles Wort neu beginnen bzw. überspringen
  const unterbrochen = async () => {
    while (aktiv() && Q.pause) await schlaf(200);
    return !aktiv() || Q.neustart || Q.skip;
  };
  const sag = async (text, lang) => { if (await unterbrochen()) return false; await sprich(text, lang, { rate: cfg.tempo }); return !(await unterbrochen()); };
  const denk = async (sek) => {
    for (let s = sek; s > 0; s--) {
      if (await unterbrochen()) return false;
      zeige('#hq-status', `🤔 ${s}`);
      for (let t = 0; t < 10; t++) { await schlaf(100); if (!aktiv() || Q.pause || Q.neustart || Q.skip) break; }
    }
    return !(await unterbrochen());
  };

  const erstes = Q.items[0];
  const zielSprache = erstes.richtung === 'fd' ? 'auf Deutsch' : `auf ${erstes.fach.fremdsprache.name}`;
  zeige('#hq-status', '🔊');
  await sag(`Los geht's! Ich sage ein Wort, ihr sagt es ${cfg.richtung === 'beide' ? 'in der anderen Sprache' : zielSprache}.`, 'de-DE');
  if (Q) Q.neustart = false;

  while (aktiv() && Q.i < Q.items.length) {
    const it = Q.items[Q.i];
    Q.neustart = false; Q.skip = false;
    const fremd = it.fach.vorlesen.stimmeSprache;
    const fd = it.richtung === 'fd';
    const frage = fd ? sprechText(it.v) : it.v.bedeutungen.join(', ');
    const loesung = fd ? it.v.bedeutungen.join(', ') : sprechText(it.v);
    zeige('#hq-nr', `${Q.i + 1} / ${Q.items.length}`);
    const bar = $('#hq-bar', root); if (bar) bar.style.width = `${Math.round(Q.i / Q.items.length * 100)}%`;
    zeige('#hq-hinweis', fd ? `${it.fach.fremdsprache.name} → Deutsch` : `Deutsch → ${it.fach.fremdsprache.name}`);
    zeige('#hq-frage', fd ? it.v.wort : it.v.bedeutungen.join('; '));
    zeige('#hq-loesung', ' ');
    zeige('#hq-status', '🔊');
    let ok = await sag(frage, fd ? fremd : 'de-DE')
      && await denk(cfg.pause);
    if (ok) {
      zeige('#hq-loesung', fd ? it.v.bedeutungen.join('; ') : it.v.wort);
      zeige('#hq-status', '✅');
      ok = await sag(loesung, fd ? 'de-DE' : fremd);
    }
    const b = it.v.beispiele?.[0];
    if (ok && cfg.beispiel && b?.fremd) ok = await schlaf(400).then(() => sag(b.fremd, fremd));
    if (ok && cfg.wiederholen) ok = await schlaf(600).then(() => sag(sprechText(it.v), fremd));
    if (ok) await schlaf(1200);
    if (!aktiv()) return;
    if (Q.neustart && !Q.skip) continue;   // nach Pause oder Zurückkommen: dasselbe Wort noch einmal
    Q.i++;
  }
  if (!aktiv()) return;
  const n = Q.items.length;
  zeige('#hq-frage', '🎉'); zeige('#hq-loesung', 'Geschafft!'); zeige('#hq-status', ''); zeige('#hq-hinweis', ' ');
  const bar = $('#hq-bar', root); if (bar) bar.style.width = '100%';
  await sag(`Super, geschafft! Das waren ${n} Vokabeln.`, 'de-DE');
  if (!aktiv()) return;
  Q.wake?.release?.().catch(() => {});
  const knoepfe = root.querySelector('.hq-knoepfe');
  if (knoepfe) knoepfe.innerHTML = '<button class="btn" id="hq-nochmal">↻ Noch eine Runde</button>';
  $('#hq-nochmal', root).onclick = () => { const items = L.mische(Q.items); starte(root, Q.cfg, items, ctx); };
  $('#hq-stop', root).textContent = 'Fertig';
}
