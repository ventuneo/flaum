# Flaum

Ruhiges Tagebuch für Schwangerschaft und Babyzeit. Kein Konto, kein Abo, alles bleibt auf dem Gerät.

Flaum ist eine Web-App (PWA) ohne Laufzeit-Abhängigkeiten und ohne Build-Schritt.

## Starten

```bash
npm start
```

Danach läuft die App auf <http://127.0.0.1:4173>. Mit «Mit Beispieldaten ansehen» auf dem ersten Bildschirm sind alle Ansichten gefüllt.

## Prüfen

```bash
npm install     # nur für die Tests nötig
npm test        # Rechenlogik
npm run e2e     # Abläufe im Browser, braucht Google Chrome
```

`ENGINE=webkit npm run e2e` führt die Abläufe in WebKit aus.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/core` | Daten und Rechenlogik, ohne Bezug zur Oberfläche |
| `src/ui` | Bildschirme und Diagramme |
| `src/styles.css` | Farben, Schrift und Layout |
| `sw.js` | Offline-Betrieb. Neue Dateien müssen hier eingetragen werden |
| `test`, `e2e` | Tests |
| `docs/ANALYSE.md` | Analyse von Huckleberry, Rezensionen und Entscheide |

## Daten

Alles liegt im `localStorage` des Browsers. Auf dem iPhone muss die App auf den Home-Bildschirm gelegt werden, sonst kann Safari die Daten nach sieben Tagen ohne Nutzung löschen. Für den Offline-Betrieb auf dem Handy braucht es HTTPS.

## Hinweis

Flaum ersetzt keine medizinische Beratung. Wachstumskurven: WHO Child Growth Standards.
