// Datenschutz & Sicherheit: verständliche Elterninformation + formale Datenschutzerklärung (DSGVO).
// Ohne Profil und ohne Eltern-PIN erreichbar, damit Eltern sie vor dem Einrichten lesen können.
import { esc } from './util.js';
import { BETREIBER } from './config.js';

const STAND = '26.11.2026';
const link = (url, text) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;

function verantwortlicher() {
  const b = BETREIBER || {};
  const fehlt = '<span class="badge warn">wird ergänzt</span>';
  return `<p>${b.name ? esc(b.name) : fehlt}<br>${b.anschrift ? esc(b.anschrift).replace(/\n/g, '<br>') : fehlt}<br>
    E-Mail: ${b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : fehlt}</p>`;
}

export async function datenschutzView({ query }, ctx) {
  const html = `
    <nav class="card" aria-label="Inhalt" style="padding:10px 16px">
      <ul class="small" style="margin:0;padding-left:18px">
        <li><a href="#/datenschutz?teil=info">Datenschutz & Sicherheit – verständlich erklärt</a></li>
        <li><a href="#/datenschutz?teil=erklaerung">Datenschutzerklärung (DSGVO)</a></li>
      </ul>
    </nav>

    <section class="card text-seite" id="info" aria-labelledby="ds-info">
      <h2 id="ds-info" style="margin-top:0">🔒 Datenschutz & Sicherheit – was Eltern wissen sollten</h2>
      <h3>Kurz gesagt</h3>
      <p>Vokabel-Studio speichert alles <strong>nur auf diesem Gerät</strong>. Es gibt <strong>keine Anmeldung beim Betreiber, keinen eigenen Server, keine Werbung und keine Nutzungs-Statistik</strong>. Daten verlassen das Gerät nur, wenn Sie selbst eine Funktion dafür einschalten – etwa die KI-Auswertung oder den OneDrive-Abgleich.</p>

      <h3>Wo liegen die Daten?</h3>
      <ul>
        <li>Profile, Vokabeln, Lernstände und Gutscheine liegen im Speicher des Browsers auf diesem Handy oder Tablet. Nur Vokabel-Studio selbst kann ihn lesen – andere Webseiten und Apps nicht, dafür sorgt der Browser.</li>
        <li>Gespeichert werden nur der <strong>Vorname oder Spitzname</strong> des Kindes, eine Figur, die Vokabeln und der Lernfortschritt. <strong>Keine</strong> E-Mail-Adresse, kein Geburtsdatum, keine Anschrift, keine Fotos.</li>
      </ul>

      <h3>Ist die App ein Einfallstor für Angriffe auf meine Daten?</h3>
      <p>Nach allem, was die App technisch kann: <strong>nein</strong>. Vokabel-Studio ist eine Web-App und läuft im abgeschotteten Bereich des Browsers („Sandbox“). Sie kann deshalb</p>
      <ul>
        <li><strong>nicht</strong> auf Ihre Fotos, Kontakte, Nachrichten, E-Mails oder andere Apps zugreifen,</li>
        <li><strong>keine</strong> Programme installieren oder Einstellungen am Gerät ändern,</li>
        <li>Kamera und Mikrofon <strong>nur</strong> benutzen, wenn Sie gerade selbst darauf tippen und der Browser Sie um Erlaubnis gefragt hat,</li>
        <li>Fotos <strong>nur</strong> sehen, die Sie zum Einlesen selbst auswählen oder aufnehmen.</li>
      </ul>
      <p>Zusätzlich gilt eine <strong>Sicherheitsregel</strong> (Content-Security-Policy): Der Browser erlaubt der App nur, Dateien von ihrer eigenen Adresse zu laden und nur mit diesen Diensten zu sprechen: den KI-Anbietern (Google Gemini, Mistral, Groq, OpenRouter) und Microsoft (Anmeldung und OneDrive). Jede andere Verbindung blockiert der Browser – selbst dann, wenn im Code ein Fehler wäre.</p>
      <p>Halten Sie Browser und Betriebssystem aktuell – Updates schließen Sicherheitslücken.</p>

      <h3>Wann verlassen Daten das Gerät?</h3>
      <p>Nur bei diesen Funktionen – und nur, wenn Sie sie nutzen:</p>
      <div class="tabelle-scroll" tabindex="0" role="region" aria-label="Tabelle: Wann Daten das Gerät verlassen"><table class="info-tabelle">
        <thead><tr><th scope="col">Funktion</th><th scope="col">Was übertragen wird</th><th scope="col">An wen</th></tr></thead>
        <tbody>
          <tr><td>Vokabelseite per KI einlesen</td><td>Foto der Buchseite bzw. kopierter Text</td><td>der eingerichtete KI-Anbieter</td></tr>
          <tr><td>Eigene Sätze von der KI prüfen lassen</td><td>Satz des Kindes und das Vokabelwort</td><td>der KI-Anbieter</td></tr>
          <tr><td>OneDrive-Abgleich</td><td>alle Daten der App (ohne KI-Schlüssel und PIN)</td><td>Ihr <strong>eigenes</strong> OneDrive, Ordner „Apps/Vokabel-Studio“</td></tr>
          <tr><td>Spracheingabe (Mikrofon)</td><td>die gesprochene Antwort</td><td>je nach Gerät die Spracherkennung von Google oder Apple – wie beim Diktieren auf der Tastatur</td></tr>
          <tr><td>Weg über ChatGPT/Gemini</td><td>was Sie dort selbst einfügen</td><td>der jeweilige Chatbot (nicht über die App)</td></tr>
        </tbody>
      </table></div>
      <p><strong>Wichtig bei kostenlosen KI-Zugängen:</strong> Manche Anbieter dürfen Eingaben speichern und zum Verbessern ihrer KI nutzen (z. B. Google im Gratis-Zugang). Fotos von Vokabelseiten sind unbedenklich – bei eigenen Sätzen sollten Kinder aber <strong>keine persönlichen Dinge</strong> schreiben (keine Namen, Adressen, Schulnamen).</p>

      <h3>Der OneDrive-Abgleich</h3>
      <ul>
        <li>Die App bekommt bei Microsoft nur Zugriff auf <strong>ihren eigenen Ordner</strong> – nicht auf Ihre anderen Dateien, Fotos oder Dokumente.</li>
        <li>Die Anmeldung läuft direkt bei Microsoft. Ihr Passwort sieht die App nie.</li>
        <li>Die Daten gehen direkt von Ihrem Gerät in Ihr OneDrive. Der Betreiber der App hat <strong>keinen Zugriff</strong> darauf – es gibt keinen Server dazwischen.</li>
        <li>Beenden: in der App mit „Trennen“ oder bei Microsoft unter ${link('https://account.microsoft.com/privacy/app-access', 'account.microsoft.com › Datenschutz › App-Zugriff')}.</li>
      </ul>

      <h3>KI-Schlüssel und Eltern-PIN</h3>
      <ul>
        <li><strong>KI-Schlüssel</strong> bleiben nur auf diesem Gerät. Sie kommen weder in Sicherungsdateien noch in den OneDrive-Abgleich.</li>
        <li><strong>Eltern-PIN:</strong> Die PIN selbst wird nicht gespeichert, nur eine verschlüsselte Prüfsumme. Sie ist eine <strong>Kindersicherung, kein Tresor</strong>: Wer das Gerät entsperrt in der Hand hat und sich technisch auskennt, kann die App-Daten trotzdem auslesen. Schützen Sie das Gerät deshalb mit einer Bildschirmsperre.</li>
      </ul>

      <h3>Sicherungsdateien und Vokabelpakete</h3>
      <p>Eine <strong>Sicherungsdatei</strong> enthält alle Daten der App im Klartext – Vornamen der Kinder, Lernstände, Vokabeln. Bewahren Sie sie auf wie andere private Dateien und schicken Sie sie nicht an Fremde. <strong>Vokabelpakete</strong> zum Weitergeben enthalten dagegen nur Vokabeln, keine Namen und keinen Lernstand.</p>

      <h3>Restrisiken – ehrlich benannt</h3>
      <ul>
        <li><strong>Verlorenes oder ungesperrtes Gerät:</strong> Wer es entsperrt hat, sieht die Daten → Bildschirmsperre verwenden.</li>
        <li><strong>App gelöscht oder Browser-Speicher geleert:</strong> Daten weg → OneDrive-Abgleich oder regelmäßig sichern.</li>
        <li><strong>Veränderung der App selbst:</strong> Würde jemand das Entwicklerkonto übernehmen, könnte er den App-Code verändern. Dagegen schützen ${BETREIBER?.zweiFaktor ? 'die Zwei-Faktor-Anmeldung des Entwicklerkontos, ' : ''}automatische Tests bei jeder Änderung und die Sicherheitsregel, die begrenzt, wohin Daten überhaupt gehen könnten.</li>
      </ul>
    </section>

    <section class="card text-seite" id="erklaerung" aria-labelledby="ds-erkl">
      <h2 id="ds-erkl" style="margin-top:0">📄 Datenschutzerklärung</h2>
      <p class="muted small">Stand: ${STAND}</p>

      <h3>1. Verantwortlicher</h3>
      <p>Verantwortlich für die Web-App „Vokabel-Studio“ (vokabel-studio.github.io) im Sinne der Datenschutz-Grundverordnung (DSGVO):</p>
      ${verantwortlicher()}

      <h3>2. Grundsätzliches</h3>
      <p>Vokabel-Studio ist ein kostenloses, nicht-kommerzielles Lernangebot ohne eigenen Server. Die App verarbeitet Daten grundsätzlich <strong>ausschließlich lokal auf dem Gerät</strong> der Nutzerin bzw. des Nutzers. Der Verantwortliche erhält, speichert und sieht keine Daten, die in der App eingegeben werden. Es gibt keine Nutzerkonten beim Verantwortlichen, keine Werbung, keine Analyse- oder Tracking-Dienste und keine Cookies.</p>

      <h3>3. Bereitstellung der App (Hosting)</h3>
      <p>Die Dateien der App werden über <strong>GitHub Pages</strong> bereitgestellt (GitHub, Inc., 88 Colin P. Kelly Jr. St., San Francisco, CA 94107, USA; ein Unternehmen von Microsoft). Beim Aufruf verarbeitet GitHub technisch notwendige Verbindungsdaten, insbesondere die <strong>IP-Adresse</strong>, Datum und Uhrzeit sowie Browser-Informationen, um die Dateien auszuliefern und den Dienst abzusichern. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer sicheren und zuverlässigen Bereitstellung). GitHub ist unter dem EU-US Data Privacy Framework zertifiziert (Art. 45 DSGVO). Näheres: ${link('https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement', 'Datenschutzerklärung von GitHub')}.</p>

      <h3>4. Lokale Speicherung auf dem Gerät</h3>
      <p>Die App speichert ihre Daten im Speicher des Browsers (IndexedDB und localStorage) auf dem Gerät: Profilname (Vor- oder Spitzname) und Figur, eingelesene Vokabeln, Lernstände, Termine, Testergebnisse, Punkte, Abzeichen und Gutscheine sowie Einstellungen. Diese Daten verlassen das Gerät nicht, außer durch die unten beschriebenen, von den Nutzern selbst eingeschalteten Funktionen. Sie bleiben gespeichert, bis sie in der App gelöscht werden („Sichern & Abgleichen › Gefahrenzone“) oder der Browser-Speicher geleert bzw. die App entfernt wird. Die Speicherung ist für die Funktion der App erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG; Art. 6 Abs. 1 lit. b bzw. f DSGVO).</p>

      <h3>5. Optionale Funktionen mit Datenübertragung</h3>
      <p>Die folgenden Funktionen sind freiwillig und werden von den Nutzern bzw. Eltern selbst eingerichtet und ausgelöst. Die Übertragung erfolgt direkt vom Gerät an den jeweiligen Anbieter, nicht über den Verantwortlichen. Rechtsgrundlage ist die Einwilligung durch das Einrichten und Nutzen der Funktion (Art. 6 Abs. 1 lit. a DSGVO); sie kann jederzeit durch Entfernen bzw. Trennen in der App widerrufen werden.</p>
      <p><strong>a) KI-Auswertung (Foto/Text einlesen, Sätze prüfen).</strong> Mit einem eigenen Zugangsschlüssel der Eltern werden das Foto bzw. der Text einer Vokabelseite oder ein selbst geschriebener Satz an den gewählten Anbieter übertragen und dort verarbeitet. Die Nutzung richtet sich nach den Bedingungen, die die Eltern mit dem Anbieter vereinbart haben. Bei kostenlosen Zugängen können Anbieter Eingaben zur Verbesserung ihrer Dienste verwenden. Anbieter: Google (Gemini, ${link('https://policies.google.com/privacy', 'Datenschutz')}, ${link('https://ai.google.dev/gemini-api/terms', 'Nutzungsbedingungen')}), Mistral AI, Frankreich (${link('https://mistral.ai/terms', 'Datenschutz')}), Groq, Inc., USA (${link('https://groq.com/privacy-policy/', 'Datenschutz')}), OpenRouter, Inc., USA (${link('https://openrouter.ai/privacy', 'Datenschutz')}). Bei Anbietern in den USA kann eine Übermittlung in ein Drittland stattfinden.</p>
      <p><strong>b) Abgleich über OneDrive.</strong> Nach Anmeldung mit einem Microsoft-Konto speichert die App eine Datei mit allen App-Daten (ohne KI-Schlüssel und Eltern-PIN) im App-Ordner des <strong>eigenen</strong> OneDrive der Nutzer. Die App erhält nur Zugriff auf diesen Ordner sowie auf Name und E-Mail-Adresse des Kontos (zur Anzeige). Anbieter: Microsoft Ireland Operations Ltd., Dublin, Irland (${link('https://privacy.microsoft.com/de-de/privacystatement', 'Datenschutzerklärung von Microsoft')}).</p>
      <p><strong>c) Spracheingabe und Vorlesen.</strong> Hierfür nutzt die App Funktionen des Browsers bzw. Betriebssystems. Bei der Spracheingabe kann die Aufnahme vom Hersteller (z. B. Google oder Apple) zur Erkennung verarbeitet werden; es gelten dessen Datenschutzbestimmungen.</p>
      <p><strong>d) Weitergabe durch die Nutzer.</strong> Sicherungsdateien, Vokabelpakete und die QR-Code-Übertragung erstellen bzw. übertragen Daten nur auf Veranlassung der Nutzer und nur an die von ihnen gewählten Empfänger. Die QR-Übertragung erfolgt direkt zwischen zwei Geräten, ohne Internet.</p>
      <p><strong>e) Links zu ChatGPT und Gemini.</strong> Die App enthält Links zu diesen Diensten. Was dort eingegeben wird, unterliegt den Bedingungen der jeweiligen Anbieter.</p>

      <h3>6. Kinder</h3>
      <p>Die App richtet sich an Schülerinnen und Schüler. Die Einrichtung (Profile, KI-Anbindung, Cloud-Abgleich) soll durch die Eltern bzw. Sorgeberechtigten erfolgen; sie erteilen auch die Einwilligung in die optionalen Funktionen (Art. 8 DSGVO). Für Profile genügt ein Vor- oder Spitzname.</p>

      <h3>7. Ihre Rechte</h3>
      <p>Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21) und Widerruf erteilter Einwilligungen (Art. 7 Abs. 3 DSGVO). Da der Verantwortliche keine Daten aus der App erhält, können Sie die meisten Rechte direkt in der App ausüben: Daten ansehen, bearbeiten, exportieren (Sicherungsdatei) und löschen. Für Daten bei GitHub, den KI-Anbietern oder Microsoft wenden Sie sich bitte an den jeweiligen Anbieter.</p>
      <p>Sie haben außerdem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, z. B. bei der Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (${link('https://www.ldi.nrw.de', 'ldi.nrw.de')}).</p>

      <h3>8. Datensicherheit</h3>
      <p>Die App wird ausschließlich verschlüsselt (HTTPS) ausgeliefert. Eine Content-Security-Policy beschränkt technisch, mit welchen Diensten die App kommunizieren darf. Zugangsschlüssel und Anmeldedaten verbleiben auf dem Gerät. Für den Schutz des Geräts selbst (Bildschirmsperre, Updates) sind die Nutzer verantwortlich.</p>

      <h3>9. Änderungen</h3>
      <p>Diese Datenschutzerklärung wird angepasst, wenn sich die App oder die Rechtslage ändert. Es gilt die jeweils in der App angezeigte Fassung.</p>
    </section>`;
  return {
    title: 'Datenschutz & Sicherheit', back: ctx.profil ? 'history' : 'profile', hideProfile: !ctx.profil, html, keepScroll: !!query.teil,
    bind(root) {
      if (query.teil) root.querySelector(`#${query.teil === 'erklaerung' ? 'erklaerung' : 'info'}`)?.scrollIntoView({ block: 'start' });
    }
  };
}
