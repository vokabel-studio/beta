// Fach-Registry: neue Fächer hier ergänzen.
export const FAECHER = [
  {
    id: 'englisch', name: 'Englisch', icon: '🇬🇧', kurz: 'en',
    fremdsprache: { code: 'en-GB', name: 'Englisch' },
    vorlesen: { stimmeSprache: 'en-GB' },
    spracheingabe: { fremd: 'en-GB', deutsch: 'de-DE' },
    formenTyp: 'englisch'
  },
  {
    id: 'latein', name: 'Latein', icon: '🏛️', kurz: 'la',
    fremdsprache: { code: 'la', name: 'Latein' },
    vorlesen: { stimmeSprache: 'it-IT', hinweis: 'Für Latein wird eine italienische Stimme genutzt. Die Aussprache ist daher nur ungefähr.' },
    spracheingabe: { fremd: null, deutsch: 'de-DE' },
    formenTyp: 'latein'
  }
];

// Vorinstallierte Lehrwerke (nur Angaben, keine Inhalte)
export const LEHRWERKE = [
  { id: 'lw_access_1', fachId: 'englisch', titel: 'English G Access G9', verlag: 'Cornelsen', band: '1', klasse: 5, ausgabe: 'Ausgabe NRW' },
  { id: 'lw_access_3', fachId: 'englisch', titel: 'English G Access G9', verlag: 'Cornelsen', band: '3', klasse: 7, ausgabe: 'Ausgabe NRW' },
  { id: 'lw_adeamus_1', fachId: 'latein', titel: 'Adeamus!', verlag: 'Cornelsen', band: '1', klasse: 7, ausgabe: 'Ausgabe NRW' }
];

export const WORTARTEN = ['nomen', 'verb', 'adjektiv', 'adverb', 'praeposition', 'konjunktion', 'pronomen', 'zahlwort', 'interjektion', 'wendung', 'sonstiges'];
export const WORTART_NAMEN = {
  nomen: 'Nomen', verb: 'Verb', adjektiv: 'Adjektiv', adverb: 'Adverb', praeposition: 'Präposition',
  konjunktion: 'Konjunktion', pronomen: 'Pronomen', zahlwort: 'Zahlwort', interjektion: 'Ausruf',
  wendung: 'Wendung', sonstiges: 'Sonstiges'
};
export const SPRACH_NAMEN = { fr: 'F', la: 'L', en: 'E', es: 'S', it: 'I', de: 'D' };
export const SPRACH_LANG = { fr: 'Französisch', la: 'Latein', en: 'Englisch', es: 'Spanisch', it: 'Italienisch', de: 'Deutsch' };

export const fach = (id) => FAECHER.find((f) => f.id === id);
export const lehrwerkName = (lw) => `${lw.titel}${lw.band ? ' – Band ' + lw.band : ''}`;
/** „Unit“ bzw. „Lektion“ (Latein) */
export const unitWort = (f) => (f?.formenTyp === 'latein' ? 'Lektion' : 'Unit');
