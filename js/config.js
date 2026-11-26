// Beta-Testversion läuft unter eigener Adresse (…/vokabel-studio-beta/) auf derselben Domain.
// Damit Test- und Live-Daten sich nicht mischen, bekommt die Beta eigene Speichernamen.
export const BETA = /beta/i.test(location.pathname);
export const DB_NAME = BETA ? 'vokabel-studio-beta' : 'vokabel-studio';
export const LS_PREFIX = BETA ? 'vsb-' : 'vs-';
// Gleiche Nummer wie VERSION in sw.js – bei jeder Änderung beide erhöhen.
export const APP_VERSION = BETA ? '2.11.0-beta' : '2.11.0';

// Umzug (23.11.2026): neue Adresse in der GitHub-Organisation „vokabel-studio“.
// Die alte Adresse bleibt vorerst erreichbar und zeigt einen Umzugshinweis, damit man dort noch eine Sicherung machen kann.
export const ALTE_ADRESSE = location.hostname === 'thereal-menntos.github.io';
export const NEUE_ADRESSE = BETA ? 'https://vokabel-studio.github.io/beta/' : 'https://vokabel-studio.github.io/';

// Cloud-Abgleich: öffentliche App-Kennungen der Anbieter (keine Geheimnisse – sie stehen bei jeder Web-App im Code).
// OneDrive: „Anwendungs-ID (Client)“ aus der App-Registrierung bei Microsoft (Microsoft Entra › App-Registrierungen).
// Weiterleitungs-URIs dort als Typ „Single-Page-Anwendung“: https://vokabel-studio.github.io/ und https://vokabel-studio.github.io/beta/
export const CLOUD = {
  onedrive: ''
};
