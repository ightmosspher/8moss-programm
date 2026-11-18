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
  {
    version: 4,
    name: "Nummernkreise, Land, Steuerfall, Artikel, Aufbauten",
    sql: `
-- Nummernkreise für Stammdaten: Präfix + fortlaufende Zahl mit fester Stellenanzahl, z. B. K-0001
ALTER TABLE nummernkreis ADD COLUMN stellen INTEGER NOT NULL DEFAULT 4;
INSERT INTO nummernkreis (art, praefix, jahr, naechste_nummer, stellen) VALUES
  ('kunde', 'K-', 0, 1, 4),
  ('lieferant', 'L-', 0, 1, 4),
  ('artikel', 'A-', 0, 1, 5),
  ('katalog', 'P-', 0, 1, 4),
  ('aufbau', 'B-', 0, 1, 3);

ALTER TABLE kunde ADD COLUMN kundennummer TEXT;
UPDATE kunde SET kundennummer = 'K-' || substr('0000' || id, -4);
UPDATE nummernkreis SET naechste_nummer = COALESCE((SELECT MAX(id) FROM kunde), 0) + 1 WHERE art = 'kunde';
CREATE UNIQUE INDEX ux_kunde_nummer ON kunde(kundennummer);

ALTER TABLE lieferant ADD COLUMN lieferantennummer TEXT;
UPDATE lieferant SET lieferantennummer = 'L-' || substr('0000' || id, -4);
UPDATE nummernkreis SET naechste_nummer = COALESCE((SELECT MAX(id) FROM lieferant), 0) + 1 WHERE art = 'lieferant';
CREATE UNIQUE INDEX ux_lieferant_nummer ON lieferant(lieferantennummer);
ALTER TABLE lieferant ADD COLUMN ansprechperson TEXT;

UPDATE kunde SET land = 'AT' WHERE land IS NULL OR land = '';
UPDATE lieferant SET land = 'AT' WHERE land IS NULL OR land = '';
UPDATE firma SET land = 'AT' WHERE land IS NULL OR land = '';

-- Steuerfall je Beleg (inland, rc_bau, eu_rc, eu_lieferung, drittland). Alte Belege: aus reverse_charge abgeleitet.
ALTER TABLE beleg ADD COLUMN steuerfall TEXT;
-- Bauteilkalkulation einer Position (Aufmaß und Aufbau als JSON), damit sie wieder geöffnet werden kann
ALTER TABLE beleg_position ADD COLUMN kalkulation TEXT;

-- Artikel (Material) mit Einkaufspreis und Lieferant
ALTER TABLE artikel ADD COLUMN gruppe TEXT;
ALTER TABLE artikel ADD COLUMN hersteller TEXT;
ALTER TABLE artikel ADD COLUMN lieferanten_artikelnummer TEXT;
ALTER TABLE artikel ADD COLUMN preis_stand TEXT;
ALTER TABLE artikel ADD COLUMN notiz TEXT;
ALTER TABLE artikel ADD COLUMN aktiv INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX ux_artikel_nummer ON artikel(nummer);

-- Aufbauten für die Bauteilkalkulation (Wand, Decke, Boden), wie Rezepte:
-- je m² (oder lfm, Stk) welche Materialien in welcher Menge und wie viel Arbeitszeit.
CREATE TABLE aufbau (
  id INTEGER PRIMARY KEY,
  nummer TEXT,
  bauteil TEXT NOT NULL DEFAULT 'wand',      -- wand, decke, boden, sonstiges
  bezeichnung TEXT NOT NULL,
  langtext TEXT,
  einheit TEXT NOT NULL DEFAULT 'm2',
  aktiv INTEGER NOT NULL DEFAULT 1,
  erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE aufbau_schicht (
  id INTEGER PRIMARY KEY,
  aufbau_id INTEGER NOT NULL REFERENCES aufbau(id) ON DELETE CASCADE,
  sortierung INTEGER NOT NULL DEFAULT 0,
  artikel_id INTEGER REFERENCES artikel(id),
  bezeichnung TEXT NOT NULL,
  verbrauch REAL NOT NULL DEFAULT 1,          -- Menge je Einheit des Aufbaus
  einheit TEXT,
  verschnitt_prozent REAL NOT NULL DEFAULT 0,
  preis_cent INTEGER NOT NULL DEFAULT 0,      -- nur wenn kein Artikel verknüpft ist
  lohn_minuten REAL NOT NULL DEFAULT 0        -- Arbeitszeit je Einheit des Aufbaus
);
CREATE INDEX idx_schicht_aufbau ON aufbau_schicht(aufbau_id);
`,
  },
  {
    version: 5,
    name: "Beispiel-Aufbauten für Wand, Decke, Boden",
    sql: `
INSERT INTO artikel (nummer, bezeichnung, gruppe, einheit, einkaufspreis_cent, notiz) VALUES
  ('A-00001', 'UW-Profil 50', 'Trockenbau Profile', 'lfm', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00002', 'CW-Profil 50', 'Trockenbau Profile', 'lfm', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00003', 'UW-Profil 75', 'Trockenbau Profile', 'lfm', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00004', 'CW-Profil 75', 'Trockenbau Profile', 'lfm', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00005', 'CD-Profil 60/27', 'Trockenbau Profile', 'lfm', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00006', 'UD-Profil 28/27', 'Trockenbau Profile', 'lfm', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00007', 'Noniusabhänger komplett', 'Trockenbau Zubehör', 'Stk', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00008', 'Gipskartonplatte GKB 12,5 mm', 'Trockenbau Platten', 'm2', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00009', 'Gipskartonplatte imprägniert GKBI 12,5 mm', 'Trockenbau Platten', 'm2', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00010', 'Mineralwolle 50 mm', 'Dämmung', 'm2', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00011', 'Schnellbauschraube TN 25', 'Trockenbau Zubehör', 'Stk', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00012', 'Schnellbauschraube TN 35', 'Trockenbau Zubehör', 'Stk', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00013', 'Fugenspachtel', 'Trockenbau Zubehör', 'kg', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00014', 'Anschlussdichtung', 'Trockenbau Zubehör', 'lfm', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00015', 'Trockenschüttung', 'Boden', 'l', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00016', 'Trockenestrich-Element 25 mm', 'Boden', 'm2', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00017', 'Randdämmstreifen', 'Boden', 'lfm', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00018', 'Grundierung', 'Boden', 'kg', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00019', 'Belagskleber', 'Boden', 'kg', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00020', 'Designbelag Vinyl', 'Boden', 'm2', 0, 'Beispiel, Preis bitte eintragen'),
  ('A-00021', 'Sockelleiste', 'Boden', 'lfm', 0, 'Beispiel, Preis bitte eintragen');
UPDATE nummernkreis SET naechste_nummer = 22 WHERE art = 'artikel';

INSERT INTO aufbau (nummer, bauteil, bezeichnung, einheit, langtext) VALUES
  ('B-001', 'wand', 'Ständerwand CW 75, beidseitig doppelt beplankt',  'm2',
   'Nichttragende Metallständerwand, Wanddicke ca. 125 mm, Unterkonstruktion aus UW/CW-Profilen 75 mm, Achsabstand 62,5 cm, Hohlraum mit Mineralwolle 50 mm gedämmt, beidseitig doppelt mit Gipskartonplatten GKB 12,5 mm beplankt, Fugen gespachtelt (Qualitätsstufe Q2), Anschlüsse mit Anschlussdichtung.'),
  ('B-002', 'wand', 'Vorsatzschale CW 50, einfach beplankt', 'm2',
   'Freistehende Vorsatzschale aus UW/CW-Profilen 50 mm, Achsabstand 62,5 cm, Hohlraum mit Mineralwolle 50 mm gedämmt, einseitig einfach mit Gipskartonplatten GKB 12,5 mm beplankt, Fugen gespachtelt (Q2).'),
  ('B-003', 'decke', 'Abgehängte Decke GKB auf CD-Unterkonstruktion', 'm2',
   'Abgehängte Gipskartondecke, Unterkonstruktion aus CD-Profilen 60/27 als Grund- und Traglattung mit Noniusabhängern, Randanschluss mit UD-Profil, einfach beplankt mit Gipskartonplatten GKB 12,5 mm, Fugen gespachtelt (Q2).'),
  ('B-004', 'boden', 'Trockenestrich auf Schüttung', 'm2',
   'Trockenestrich aus Estrich-Elementen 25 mm, verlegt auf Trockenschüttung ca. 30 mm, inkl. Randdämmstreifen.'),
  ('B-005', 'boden', 'Designbelag Vinyl verklebt, mit Sockelleiste', 'm2',
   'Designbelag Vinyl vollflächig verklebt, Untergrund grundiert, inkl. Sockelleiste.');
UPDATE nummernkreis SET naechste_nummer = 6 WHERE art = 'aufbau';

INSERT INTO aufbau_schicht (aufbau_id, sortierung, artikel_id, bezeichnung, verbrauch, einheit, verschnitt_prozent, lohn_minuten)
SELECT a.id, s.sortierung, ar.id, ar.bezeichnung, s.verbrauch, ar.einheit, s.verschnitt, s.lohn
FROM (
  SELECT 'B-001' AS aufbau, 1 AS sortierung, 'A-00003' AS artikel, 0.7 AS verbrauch, 5 AS verschnitt, 4 AS lohn
  UNION ALL SELECT 'B-001', 2, 'A-00004', 2.0, 5, 10
  UNION ALL SELECT 'B-001', 3, 'A-00014', 1.4, 5, 2
  UNION ALL SELECT 'B-001', 4, 'A-00010', 1.0, 5, 5
  UNION ALL SELECT 'B-001', 5, 'A-00008', 4.0, 10, 28
  UNION ALL SELECT 'B-001', 6, 'A-00011', 14, 0, 0
  UNION ALL SELECT 'B-001', 7, 'A-00012', 28, 0, 0
  UNION ALL SELECT 'B-001', 8, 'A-00013', 0.7, 0, 18
  UNION ALL SELECT 'B-002', 1, 'A-00001', 0.7, 5, 3
  UNION ALL SELECT 'B-002', 2, 'A-00002', 2.0, 5, 8
  UNION ALL SELECT 'B-002', 3, 'A-00014', 0.7, 5, 1
  UNION ALL SELECT 'B-002', 4, 'A-00010', 1.0, 5, 4
  UNION ALL SELECT 'B-002', 5, 'A-00008', 1.0, 10, 9
  UNION ALL SELECT 'B-002', 6, 'A-00011', 15, 0, 0
  UNION ALL SELECT 'B-002', 7, 'A-00013', 0.35, 0, 9
  UNION ALL SELECT 'B-003', 1, 'A-00007', 1.3, 0, 6
  UNION ALL SELECT 'B-003', 2, 'A-00005', 3.2, 5, 16
  UNION ALL SELECT 'B-003', 3, 'A-00006', 0.4, 5, 3
  UNION ALL SELECT 'B-003', 4, 'A-00008', 1.0, 10, 14
  UNION ALL SELECT 'B-003', 5, 'A-00011', 17, 0, 0
  UNION ALL SELECT 'B-003', 6, 'A-00013', 0.4, 0, 14
  UNION ALL SELECT 'B-004', 1, 'A-00017', 0.6, 5, 2
  UNION ALL SELECT 'B-004', 2, 'A-00015', 30, 5, 8
  UNION ALL SELECT 'B-004', 3, 'A-00016', 1.0, 5, 14
  UNION ALL SELECT 'B-005', 1, 'A-00018', 0.15, 0, 4
  UNION ALL SELECT 'B-005', 2, 'A-00019', 0.35, 0, 0
  UNION ALL SELECT 'B-005', 3, 'A-00020', 1.0, 8, 20
  UNION ALL SELECT 'B-005', 4, 'A-00021', 0.6, 5, 6
) s
JOIN aufbau a ON a.nummer = s.aufbau
JOIN artikel ar ON ar.nummer = s.artikel;
`,
  },
];
