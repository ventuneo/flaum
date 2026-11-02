# Analyse von Huckleberry und was Flaum daraus macht

Stand: 3. November 2026. Geprüft wurde die App-Version v0.9.316.

## Was Huckleberry ist

Huckleberry ist eine Baby-App, keine Schwangerschaftsapp. Der Schwerpunkt liegt auf Schlaf, Füttern und Wachstum bis etwa 5 Jahre. Für die Schwangerschaft gibt es nur den Wehentimer und einen Einstieg für werdende Eltern. Die Website führt dazu noch einen Ratgeber-Bereich.

Bewertung im US-App-Store: 4,9 von 5 bei rund 76 000 Bewertungen.

## Woher die Angaben stammen

| Quelle | Inhalt | Grenze |
|---|---|---|
| App-Store-Eintrag und Website | Funktionen, Abo-Stufen, Versionshinweise | Herstellertext |
| 10 öffentliche Store-Screenshots | Aufbau der Bildschirme | Werbebilder, nicht die laufende App |
| 2010 App-Store-Rezensionen aus 8 Ländern | Kritik und Wünsche, 2017 bis Oktober 2026 | Nur Apple, kein Google Play. Pro Land höchstens die neuesten 500 |
| OnClarity, Unstar, JustUseApp | Zweitmeinungen | Teils KI-Auswertung, teils gesponsert, nur zum Abgleich genutzt |
| Merkblätter Kantonsspital Baden und Spitäler fmi | Wann bei Wehen anrufen | Regionale Angaben, andere Spitäler nennen leicht andere Werte |

Die laufende App wurde nicht geöffnet und nicht dekompiliert. Bezahlfunktionen sind deshalb nur aus den Beschreibungen bekannt.

## Was die Rezensionen sagen

Grundlage sind die 268 Bewertungen mit 1 bis 3 Sternen seit Januar 2025. Gezählt wurde über Stichwörter, die Zahlen sind deshalb Richtwerte. Eine Rezension kann mehrere Themen nennen.

| Thema | Anteil | Antwort in Flaum |
|---|---:|---|
| Abstürze, lädt nicht, ständige Abmeldung | 36 % | Kein Konto und kein Server. Die App startet vom Gerät, auch offline |
| Preis, Paywall, Abo | 35 % | Kein Abo. Alle Funktionen sind frei |
| Updates machen Gewohntes schlechter | 22 % | Noch nicht prüfbar. Kurze Eingaben bleiben der Standard, Details sind freiwillig |
| Einträge gehen verloren | 15 % | Jeder Eintrag wird sofort lokal gespeichert und bestätigt, mit Rückgängig und Sicherheitskopie |
| Uhr, Widget, Sperrbildschirm | 15 % | **Nicht gelöst.** Das geht nur mit einer nativen App |
| Zwei Eltern, Synchronisation | 11 % | **Teilweise gelöst.** Datei austauschen und zusammenführen, nicht live |
| Zweifel an der KI | 6 % | Keine KI. Die Schnelleingabe nutzt feste Regeln und zeigt vor dem Speichern, was sie verstanden hat |
| Datenschutz, Tracker | 6 % | Kein Tracker, keine Anfragen nach aussen |
| Werbung, Pop-ups | 5 % | Keine |
| Schlafvorhersage passt nicht | 5 % | Zeitspanne statt Uhrzeit, Rechenweg sichtbar, verschiebbar, abschaltbar |
| Druck und Stress | 4 % | Keine Serien, keine Warnfarben. Tage ohne Eintrag zählen nicht in den Schnitt |
| Beikost-Umbau | 4 % | Speichern geht ohne Details, Lebensmittel lassen sich später ergänzen |
| Zeiteingabe | 2 % | Stunde und Minute direkt tippen, dazu Knöpfe wie «−15 Min» |
| Tag beginnt nicht um 0 Uhr | 2 % | Tage laufen von 0 bis 24 Uhr. Eine Nacht über Mitternacht wird auf beide Tage verteilt und einmal aufgelistet |

### Oft gewünscht und eingebaut

- Kurzes Aufwachen festhalten, ohne den Schlaf zu beenden
- Einen aus Versehen beendeten Schlaf weiterlaufen lassen
- Muttermilch und Pre-Milch in den Summen getrennt
- Durchschnitt der Bauchzeit
- Notizen für den Arzttermin
- Eigene Aktivitäten, zum Beispiel Schwimmen
- Berechnete Schlafenszeit nach den Nickerchen des Tages
- Korrigiertes Alter bei Frühgeborenen
- Notizen direkt in der Liste lesbar
- Jeder Eintrag in Tages- und Wochenansicht erreichbar und änderbar

## Funktionsvergleich

| Huckleberry | Flaum | Abweichung |
|---|---|---|
| Wehentimer | Ja | Zusätzlich Atemkreis, Anruf per Tipp, Hinweis bei regelmässigen Wehen |
| Schlaf, Stillen, Flasche, Windel, Abpumpen | Ja | |
| Beikost mit Allergenen und Reaktionen | Ja | Eigene, kleinere Lebensmittelliste |
| Wachstum mit Perzentilen | Ja | WHO-Werte bis 24 Monate |
| Meilensteine, Medizin, Töpfchen, Aktivitäten | Ja | |
| Temperatur | Ja | Mit Hinweis ab 38 °C |
| Mehrere Kinder | Ja | |
| SweetSpot | Eigenes Schlaffenster | Frei und erst ab 8 Wochen, wie das Original ab etwa 2 Monaten |
| Tagesplan (Schedule Creator) | Ja | Rechnet bei jeder Änderung neu |
| Insights mit Tipps und Miniplänen | Teilweise | Nur Vergleiche aus den eigenen Daten, keine Ratgebertexte |
| Berichte, Teilen mit dem Arzt | Ja | Als PDF oder Text |
| Erinnerungen | Teilweise | Bei geschlossener App nur über den Kalender |
| Eintrag per Text | Ja | Feste Regeln. Sprache über die Diktierfunktion der Tastatur |
| Eintrag per Foto | Nein | |
| Synchronisation in Echtzeit | Nein | Braucht einen Server |
| Apple Watch, Widgets, Sperrbildschirm | Nein | Braucht eine native App |
| KI-Chat Berry | Nein | Bewusst weggelassen: Kosten, medizinisches Risiko, Kritik in den Rezensionen |
| Persönliche Schlafpläne von Fachleuten | Nein | Braucht Fachpersonen |

Nur in Flaum: das Befinden der Eltern. Es kommt aus deinem Vorlagebild, nicht aus Huckleberry.

## Design

Vorgabe war dein Bild: warmes Farbfeld, ein Wort in der Mitte, helle Fläche mit Auswahl-Chips, runder Knopf unten. Die Schrift ist deshalb DM Sans, sie kommt der Schrift im Bild am nächsten.

Eigene Regeln:

- **Farbe bedeutet etwas.** Das Farbfeld zeigt das Thema des Bildschirms, beim Befinden die gewählte Stimmung. Getönt heisst wählbar, weiss heisst gewählt. Eine Akzentfarbe gibt es nicht.
- **Ein Bildschirm, eine Aussage.** Pro Bildschirm steht ein grosser Wert oder ein Wort im Zentrum.
- **Zwei Bereiche statt fünf Tabs.** Heute und Verlauf. Das Original hat fünf.
- **Der Kreis im Wehentimer ist der Knopf.** Während einer Wehe atmet er langsam und gibt so den Atemrhythmus vor. Das ist die einzige Bewegung ohne Antippen.

Abweichungen vom Bild:

- Dunklerer Text, weil der im Bild für müde Augen zu blass ist. Kontrast mindestens 4,5:1, geprüft für Text auf Chips und Flächen.
- Der doppelte Speichern-Haken oben rechts fehlt, der Knopf unten reicht.
- Der Fortschrittsbalken erscheint nur dort, wo es wirklich einen Fortschritt gibt.
- Nachtmodus in warmen, dunklen Tönen.

## Medizinische Hinweise

Das sind allgemeine Richtwerte. Vor einer echten Veröffentlichung sollte eine Hebamme oder Kinderärztin sie prüfen:

- Wehen: Anruf-Hinweis bei regelmässigen Abständen von höchstens 6 Minuten
- Sofort anrufen bei Fruchtwasserabgang, Blutung, unklaren Bauchbeschwerden, weniger Kindsbewegungen oder Unsicherheit
- Fieber unter 3 Monaten ab 38 °C
- Beikost-Tipps, zum Beispiel Trauben vierteln und Honig erst ab 12 Monaten
- Wachzeiten fürs Alter

Die Wachzeiten sind Erfahrungswerte aus der Literatur, ohne eine einzelne amtliche Quelle.

## Rechtliches

Flaum hat einen eigenen Namen, eigene Texte und ein eigenes Design. Keine Texte, Bilder oder Markennamen von Huckleberry sind übernommen. «Flaum» ist ein Arbeitsname und wurde nicht markenrechtlich geprüft. Vor einer Veröffentlichung braucht es diese Prüfung, eine Klärung zu Datenschutz und Medizinprodukterecht sowie die Lizenzklärung der WHO-Daten. Die Schrift DM Sans steht unter der SIL Open Font License.
