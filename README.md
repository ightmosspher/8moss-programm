# 8moss-Programm

Eigenes Programm von 8moss für Ausschreibung, Angebot, Bestellung und Rechnung.
Desktop-App für Mac und Windows, die Daten liegen lokal in einer SQLite-Datei.

## Stand

Grundgerüst (Version 0.1):

- Datenbankschema für Firma, Kunden, Lieferanten, Artikel, Positionskatalog, Projekte, LV und Belege
- Abgeschlossene Belege sind in der Datenbank gegen Änderungen gesperrt (nur Storno/Gutschrift)
- Kunden anlegen, bearbeiten, löschen (inkl. Reverse-Charge-Kennzeichen)
- Positionskatalog mit Kalkulation: Lohnminuten × Mittellohnpreis + Material mit Zuschlag + Sonstiges, mit Gesamtzuschlag
- Einstellungen: Firmendaten und Kalkulationswerte
- Lieferanten anlegen, bearbeiten, löschen
- Projekte mit Kunde, Baustelle, Herkunft (direkt/ONLV) und Status, filterbar
- Angebote, Bestellungen, Rechnungen: noch Platzhalter

## Starten

Voraussetzungen (einmalig): [Node.js](https://nodejs.org) ab Version 20 und
[Rust](https://rustup.rs). Auf dem Mac zusätzlich `xcode-select --install`,
unter Windows die „Microsoft C++ Build Tools“ (siehe https://tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev      # Desktop-App im Entwicklungsmodus starten
npm run tauri build    # Installationsdatei (.dmg / .msi) erzeugen
```

Nur die Oberfläche im Browser ansehen (Datenbank im Arbeitsspeicher, nach dem Neuladen leer):

```bash
npm run dev            # dann http://localhost:1420 öffnen
```

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `src/db/migrations.ts` | Datenbankschema. Änderungen immer als neue Migration hinten anhängen. |
| `src/db/index.ts` | Datenbankzugriff (Tauri-SQLite oder sql.js im Browser). Später hier Umstieg auf Server/Cloud. |
| `src/db/repo.ts` | Lesen und Speichern von Kunden, Katalog, Firma |
| `src/db/geld.ts` | Beträge in Cent, Formatierung, Einheitspreis-Kalkulation |
| `src/views/` | Bildschirme (Kunden, Positionskatalog, Einstellungen, …) |
| `src-tauri/` | Desktop-Hülle (Rust), Fenster, Rechte, Installationspakete |

Die Datenbankdatei `8moss.db` liegt im App-Datenordner
(Mac: `~/Library/Application Support/at.8moss.programm/`,
Windows: `%APPDATA%\at.8moss.programm\`).

## Nächste Schritte

1. Angebot aus Katalogpositionen, PDF im 8moss-Layout
2. Automatische Datensicherung
3. Rechnung mit ebInterface und Reverse Charge
4. ONLV-Import und -Export (ÖNORM A 2063-2)
