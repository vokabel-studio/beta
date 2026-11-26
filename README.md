# Vokabel-Studio

Vokabel-Lern-App für Schülerinnen und Schüler am Gymnasium (NRW), Englisch und Latein.
Web-App (PWA) für iPhone, iPad und Android, alle Daten bleiben lokal auf dem Gerät. KI-Auswertung ist optional (eigener Gratis-Schlüssel, bleibt auf dem Gerät).

**App öffnen:** https://vokabel-studio.github.io/

*Umgezogen am 23.11.2026 von thereal-menntos.github.io/vokabel-studio – die alte Adresse zeigt vorerst einen Umzugshinweis.*

## So kommen die Vokabeln in die App

1. In der App „Vokabelseite einlesen“ → Buch und Unit wählen → **Text kopieren**.
2. In ChatGPT oder Gemini (Gratis-Version) einfügen, **Foto der Vokabelseite** anhängen, abschicken.
3. Antwort kopieren → in der App einfügen → **Prüfen** → in der Kontrollansicht vergleichen → **Übernehmen**.

## Auf dem iPhone/iPad installieren

Safari → Seite öffnen → Teilen ⬆︎ → **Zum Home-Bildschirm**.
Wichtig: Safari und die Home-Bildschirm-App haben getrennte Speicher. Am besten nur die Home-Bildschirm-App benutzen und regelmäßig eine **Sicherung** erstellen.

## Stand

| Stufe | Inhalt | Status |
|---|---|---|
| 1 | Profile, Import mit Prüfung und Kontrollansicht, Bibliothek, Lernkarten-Ansicht, Backup, Gerätetest | ✅ |
| 2 | Lernkarten, Abfrage beide Richtungen, Multiple Choice, Satzbau, eigene Sätze, Latein-Formen, Vorlesen | ✅ |
| 3 | Wiederholungsplan, Termin der Vokabelarbeit, Abschlusstest, Druck/PDF | ✅ |
| 4 | Punkte, Serien, Abzeichen, Eltern-Ansicht, Sicherung (Cloud/Ordner), dunkler Modus, Animationen | ✅ |
| + | Direkte KI-Auswertung von Fotos (Gemini, Groq, Mistral; eigener Gratis-Schlüssel, automatischer Anbieterwechsel), Vokabelpakete zum Teilen ohne Profile | ✅ |
| + | Alles nachträglich bearbeiten/löschen (Bücher, Units, Parts, Vokabeln, Lernsätze, Satzbau, Termine), Vokabeln/Units von Hand anlegen, Lernstand je Unit zurücksetzen, angefangene Übung fortsetzen, Tagesziel pro Tag | ✅ (Beta) |

**Bekannte Einschränkung iPhone/iPad:** Die Spracheingabe der App liefert unter iOS nur beim ersten Versuch nach dem App-Start Ton (Gerätetests Nov. 2026). Auf iOS wird deshalb das Tastatur-Diktat empfohlen; der App-Mikrofonknopf ist dort ausgeblendet.

Testversion: https://vokabel-studio.github.io/beta/ (Branch `beta`, eigene Daten)

## Technik

Reines HTML/CSS/JavaScript (ES-Module), kein Build-Schritt. Speicherung in IndexedDB, Offline über Service Worker.

- `docs/01-datenmodell.md` – Datenmodell
- `schema/import-schema-v1.json` – JSON-Schema der Chatbot-Antwort
- `prompt/import-prompt.md` – Prompt-Vorlage und Fehlertoleranz
- `demo/` – selbst geschriebene Beispiel-Units (keine Schulbuchinhalte)

Lokal starten: `python -m http.server 8765` und http://localhost:8765 öffnen.

## Urheberrecht

Dieses Repository enthält **keine** Inhalte aus Schulbüchern. Abgeschriebene Vokabellisten bleiben nur lokal auf dem Gerät der Nutzer.
Lehrwerkstitel werden nur zur Zuordnung genannt; die Marken gehören den jeweiligen Verlagen.
