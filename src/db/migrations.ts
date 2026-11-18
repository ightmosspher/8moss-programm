/**
 * Datenbankschema des 8moss-Programms.
 *
 * Jede Migration läuft genau einmal. Neue Änderungen werden immer als NEUE
 * Migration hinten angehängt, bestehende werden nie verändert.
 *
 * Geldbeträge werden als ganze Cent (INTEGER) gespeichert, damit keine
 * Rundungsfehler entstehen. Mengen als REAL, Lohn in Minuten.
 */
export const migrations: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: "Grundschema",
    sql: `
CREATE TABLE firma (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '8moss',
  strasse TEXT, plz TEXT, ort TEXT, land TEXT DEFAULT 'AT',
  uid TEXT, firmenbuch TEXT, telefon TEXT, email TEXT, web TEXT,
  iban TEXT, bic TEXT, bank TEXT,
  mittellohn_cent INTEGER NOT NULL DEFAULT 6500,   -- Mittellohnpreis je Stunde
  materialzuschlag_prozent REAL NOT NULL DEFAULT 15,
  gesamtzuschlag_prozent REAL NOT NULL DEFAULT 0,
  zahlungsziel_tage INTEGER NOT NULL DEFAULT 14
);
INSERT INTO firma (id) VALUES (1);

CREATE TABLE nummernkreis (
  art TEXT PRIMARY KEY,          -- angebot, auftrag, bestellung, rechnung, gutschrift
  praefix TEXT NOT NULL,         -- z. B. 'A' -> A-2026-001
  jahr INTEGER NOT NULL,
  naechste_nummer INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE kunde (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  ansprechperson TEXT,
  strasse TEXT, plz TEXT, ort TEXT, land TEXT DEFAULT 'AT',
  uid TEXT,
  email TEXT, telefon TEXT,
  zahlungsziel_tage INTEGER,
  reverse_charge INTEGER NOT NULL DEFAULT 0,  -- § 19 Abs. 1a UStG (Bauleistungen)
  notiz TEXT,
  erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE lieferant (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  strasse TEXT, plz TEXT, ort TEXT, land TEXT DEFAULT 'AT',
  uid TEXT, email TEXT, telefon TEXT,
  unsere_kundennummer TEXT,
  notiz TEXT,
  erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE artikel (
  id INTEGER PRIMARY KEY,
  nummer TEXT,
  bezeichnung TEXT NOT NULL,
  einheit TEXT NOT NULL DEFAULT 'Stk',
  einkaufspreis_cent INTEGER NOT NULL DEFAULT 0,
  lieferant_id INTEGER REFERENCES lieferant(id),
  erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Eigener 8moss-Positionskatalog mit hinterlegter Kalkulation
CREATE TABLE katalog_position (
  id INTEGER PRIMARY KEY,
  nummer TEXT,                       -- eigene Nummer, z. B. TB-010
  gruppe TEXT,                       -- z. B. Trockenbau, Tischlerei
  kurztext TEXT NOT NULL,
  langtext TEXT,
  einheit TEXT NOT NULL DEFAULT 'm2',
  lohn_minuten REAL NOT NULL DEFAULT 0,
  sonstiges_cent INTEGER NOT NULL DEFAULT 0,   -- Geräte, Fremdleistung
  lbhb_referenz TEXT,                -- spätere Verknüpfung mit LB-HB
  aktiv INTEGER NOT NULL DEFAULT 1,
  erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Materialanteile einer Katalogposition (Menge je Einheit der Position)
CREATE TABLE katalog_material (
  id INTEGER PRIMARY KEY,
  katalog_position_id INTEGER NOT NULL REFERENCES katalog_position(id) ON DELETE CASCADE,
  artikel_id INTEGER REFERENCES artikel(id),
  bezeichnung TEXT NOT NULL,
  menge REAL NOT NULL DEFAULT 1,
  einheit TEXT,
  preis_cent INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE projekt (
  id INTEGER PRIMARY KEY,
  kunde_id INTEGER NOT NULL REFERENCES kunde(id),
  bezeichnung TEXT NOT NULL,
  baustelle TEXT,
  status TEXT NOT NULL DEFAULT 'anfrage',   -- anfrage, angebot, auftrag, abgerechnet, verloren
  quelle TEXT NOT NULL DEFAULT 'direkt',    -- direkt, onlv
  erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Leistungsverzeichnis: Knoten sind Gruppen (Leistungsgruppe, Unterleistungsgruppe)
-- oder Positionen, Gliederung nach ÖNORM A 2063.
CREATE TABLE lv_knoten (
  id INTEGER PRIMARY KEY,
  projekt_id INTEGER NOT NULL REFERENCES projekt(id) ON DELETE CASCADE,
  eltern_id INTEGER REFERENCES lv_knoten(id) ON DELETE CASCADE,
  art TEXT NOT NULL,                 -- gruppe, position
  ordnungszahl TEXT,                 -- OZ, z. B. 39.01.02A
  sortierung INTEGER NOT NULL DEFAULT 0,
  kurztext TEXT NOT NULL,
  langtext TEXT,
  einheit TEXT,
  menge REAL,
  positionsart TEXT DEFAULT 'normal',  -- normal, wahl, eventual
  lohn_minuten REAL,
  material_cent INTEGER,
  sonstiges_cent INTEGER,
  einheitspreis_cent INTEGER,        -- Ergebnis der Kalkulation oder manuell
  katalog_position_id INTEGER REFERENCES katalog_position(id),
  onlv_daten TEXT                    -- Originaldaten aus dem ONLV-Import (JSON)
);

-- Belege: Angebot, Auftragsbestätigung, Bestellung, Rechnung, Gutschrift
CREATE TABLE beleg (
  id INTEGER PRIMARY KEY,
  art TEXT NOT NULL,
  nummer TEXT UNIQUE,                -- wird erst beim Abschließen vergeben
  projekt_id INTEGER REFERENCES projekt(id),
  kunde_id INTEGER REFERENCES kunde(id),
  lieferant_id INTEGER REFERENCES lieferant(id),
  vorgaenger_id INTEGER REFERENCES beleg(id),
  rechnungsart TEXT,                 -- abschlag, teil, schluss
  datum TEXT NOT NULL DEFAULT (date('now')),
  leistung_von TEXT, leistung_bis TEXT,
  status TEXT NOT NULL DEFAULT 'entwurf',  -- entwurf, abgeschlossen, storniert
  vortext TEXT, schlusstext TEXT,
  nachlass_prozent REAL NOT NULL DEFAULT 0,
  ust_prozent REAL NOT NULL DEFAULT 20,
  reverse_charge INTEGER NOT NULL DEFAULT 0,
  netto_cent INTEGER, ust_cent INTEGER, brutto_cent INTEGER,
  adresse_snapshot TEXT,             -- Empfängeradresse zum Zeitpunkt des Belegs (JSON)
  pdf_pfad TEXT,
  abgeschlossen_am TEXT,
  erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE beleg_position (
  id INTEGER PRIMARY KEY,
  beleg_id INTEGER NOT NULL REFERENCES beleg(id) ON DELETE CASCADE,
  sortierung INTEGER NOT NULL DEFAULT 0,
  ordnungszahl TEXT,
  kurztext TEXT NOT NULL,
  langtext TEXT,
  einheit TEXT,
  menge REAL NOT NULL DEFAULT 0,
  einheitspreis_cent INTEGER NOT NULL DEFAULT 0,
  gesamt_cent INTEGER NOT NULL DEFAULT 0,
  lv_knoten_id INTEGER REFERENCES lv_knoten(id),          -- Herkunft im LV
  vorgaenger_position_id INTEGER REFERENCES beleg_position(id)  -- Herkunft im Vorbeleg
);

-- Abgeschlossene Belege sind unveränderlich (Aufbewahrungspflicht).
CREATE TRIGGER beleg_unveraenderlich
BEFORE UPDATE ON beleg
WHEN OLD.status = 'abgeschlossen' AND NOT (NEW.status = 'storniert' AND NEW.nummer = OLD.nummer)
BEGIN
  SELECT RAISE(ABORT, 'Abgeschlossene Belege können nicht geändert werden. Bitte Storno oder Gutschrift verwenden.');
END;

CREATE TRIGGER beleg_position_unveraenderlich
BEFORE UPDATE ON beleg_position
WHEN (SELECT status FROM beleg WHERE id = OLD.beleg_id) <> 'entwurf'
BEGIN
  SELECT RAISE(ABORT, 'Positionen abgeschlossener Belege können nicht geändert werden.');
END;

CREATE TRIGGER beleg_position_nicht_loeschen
BEFORE DELETE ON beleg_position
WHEN (SELECT status FROM beleg WHERE id = OLD.beleg_id) <> 'entwurf'
BEGIN
  SELECT RAISE(ABORT, 'Positionen abgeschlossener Belege können nicht gelöscht werden.');
END;

CREATE INDEX idx_projekt_kunde ON projekt(kunde_id);
CREATE INDEX idx_lv_projekt ON lv_knoten(projekt_id);
CREATE INDEX idx_beleg_projekt ON beleg(projekt_id);
CREATE INDEX idx_belegpos_beleg ON beleg_position(beleg_id);
`,
  },
  {
    version: 2,
    name: "Angebot und Belegdruck",
    sql: `
ALTER TABLE firma ADD COLUMN gericht TEXT;            -- z. B. HG Ried im Innkreis
ALTER TABLE firma ADD COLUMN unterzeichner TEXT;      -- Name unter dem Gruß
ALTER TABLE firma ADD COLUMN angebot_gueltig_tage INTEGER NOT NULL DEFAULT 30;
ALTER TABLE kunde ADD COLUMN firmenbuch TEXT;         -- FN des Kunden
ALTER TABLE kunde ADD COLUMN anrede TEXT;             -- z. B. Sehr geehrter Herr Muster,
ALTER TABLE beleg ADD COLUMN anrede TEXT;
ALTER TABLE beleg ADD COLUMN zahlungsziel_tage INTEGER;

INSERT INTO nummernkreis (art, praefix, jahr, naechste_nummer) VALUES
  ('angebot', 'AN', CAST(strftime('%Y','now') AS INTEGER), 1),
  ('auftrag', 'AB', CAST(strftime('%Y','now') AS INTEGER), 1),
  ('bestellung', 'BE', CAST(strftime('%Y','now') AS INTEGER), 1),
  ('rechnung', 'RE', CAST(strftime('%Y','now') AS INTEGER), 1),
  ('gutschrift', 'GU', CAST(strftime('%Y','now') AS INTEGER), 1);
`,
  },
  {
    version: 3,
    name: "8moss-Nummernschema Projekt-Beleg-Jahr",
    sql: `
-- Projektnummer (z. B. 10), läuft fortlaufend
ALTER TABLE projekt ADD COLUMN nummer INTEGER;
UPDATE projekt SET nummer = id;
CREATE UNIQUE INDEX ux_projekt_nummer ON projekt(nummer);

-- Belegnummer wie gedruckt, z. B. 10-12-26 (Projekt-laufender Beleg im Projekt-Jahr).
-- Eindeutig je Belegart; die alte Spalte nummer hält intern art:belegnummer.
ALTER TABLE beleg ADD COLUMN belegnummer TEXT;
CREATE UNIQUE INDEX ux_beleg_art_belegnummer ON beleg(art, belegnummer);
`,
  },
];
