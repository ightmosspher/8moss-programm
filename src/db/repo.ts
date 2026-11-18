/** Datenzugriffe für Stammdaten und Katalog. */
import { getDb } from "./index";

export interface Kunde {
  id?: number;
  name: string;
  ansprechperson?: string | null;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  uid?: string | null;
  email?: string | null;
  telefon?: string | null;
  reverse_charge: number;
  notiz?: string | null;
  firmenbuch?: string | null;
  anrede?: string | null;
  kundennummer?: string | null;
  land?: string | null;
}

export interface KatalogPosition {
  id?: number;
  nummer?: string | null;
  gruppe?: string | null;
  kurztext: string;
  langtext?: string | null;
  einheit: string;
  lohn_minuten: number;
  sonstiges_cent: number;
  material_cent?: number; // Summe der Materialanteile (berechnet)
}

export interface Firma {
  name: string;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  uid: string | null;
  email: string | null;
  telefon: string | null;
  iban: string | null;
  bic: string | null;
  mittellohn_cent: number;
  materialzuschlag_prozent: number;
  gesamtzuschlag_prozent: number;
  zahlungsziel_tage: number;
  firmenbuch: string | null;
  gericht: string | null;
  bank: string | null;
  web: string | null;
  unterzeichner: string | null;
  angebot_gueltig_tage: number;
  land: string | null;
}

// ---------- Firma ----------
export async function ladeFirma(): Promise<Firma> {
  const db = await getDb();
  const [f] = await db.select<Firma>("SELECT * FROM firma WHERE id = 1");
  return f;
}

export async function speichereFirma(f: Firma) {
  const db = await getDb();
  await db.execute(
    `UPDATE firma SET name=$1, strasse=$2, plz=$3, ort=$4, uid=$5, email=$6, telefon=$7, iban=$8, bic=$9,
       mittellohn_cent=$10, materialzuschlag_prozent=$11, gesamtzuschlag_prozent=$12, zahlungsziel_tage=$13,
       firmenbuch=$14, gericht=$15, bank=$16, web=$17, unterzeichner=$18, angebot_gueltig_tage=$19, land=$20 WHERE id = 1`,
    [f.name, f.strasse, f.plz, f.ort, f.uid, f.email, f.telefon, f.iban, f.bic,
     f.mittellohn_cent, f.materialzuschlag_prozent, f.gesamtzuschlag_prozent, f.zahlungsziel_tage,
     f.firmenbuch, f.gericht, f.bank, f.web, f.unterzeichner, f.angebot_gueltig_tage, f.land || "AT"],
  );
}

// ---------- Kunden ----------
export async function listeKunden(suche = ""): Promise<Kunde[]> {
  const db = await getDb();
  return db.select<Kunde>(
    "SELECT * FROM kunde WHERE name LIKE $1 OR ort LIKE $1 OR kundennummer LIKE $1 OR ansprechperson LIKE $1 ORDER BY name COLLATE NOCASE",
    [`%${suche}%`],
  );
}

export async function speichereKunde(k: Kunde): Promise<number> {
  const db = await getDb();
  const nummer = k.kundennummer?.trim() || (await vergebeNummer("kunde"));
  const werte = [k.name, k.ansprechperson, k.strasse, k.plz, k.ort, k.uid?.replace(/\s/g, "").toUpperCase() || null, k.email, k.telefon,
    k.reverse_charge, k.notiz, k.firmenbuch, k.anrede, nummer, k.land || "AT"];
  if (k.id) {
    await db.execute(
      `UPDATE kunde SET name=$1, ansprechperson=$2, strasse=$3, plz=$4, ort=$5, uid=$6, email=$7, telefon=$8,
         reverse_charge=$9, notiz=$10, firmenbuch=$11, anrede=$12, kundennummer=$13, land=$14 WHERE id=$15`,
      [...werte, k.id],
    );
    return k.id;
  }
  const r = await db.execute(
    `INSERT INTO kunde (name, ansprechperson, strasse, plz, ort, uid, email, telefon, reverse_charge, notiz, firmenbuch, anrede,
       kundennummer, land)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    werte,
  );
  return r.lastInsertId!;
}

export async function loescheKunde(id: number) {
  const db = await getDb();
  await db.execute("DELETE FROM kunde WHERE id = $1", [id]);
}

// ---------- Positionskatalog ----------
export async function listeKatalog(suche = ""): Promise<KatalogPosition[]> {
  const db = await getDb();
  return db.select<KatalogPosition>(
    `SELECT p.*, COALESCE((SELECT SUM(ROUND(m.menge * m.preis_cent)) FROM katalog_material m
                           WHERE m.katalog_position_id = p.id), 0) AS material_cent
     FROM katalog_position p
     WHERE p.aktiv = 1 AND (p.kurztext LIKE $1 OR p.nummer LIKE $1 OR p.gruppe LIKE $1)
     ORDER BY p.gruppe, p.nummer, p.kurztext`,
    [`%${suche}%`],
  );
}

export async function speichereKatalogPosition(p: KatalogPosition, materialCent: number): Promise<number> {
  const db = await getDb();
  const nummer = p.nummer?.trim() || (await vergebeNummer("katalog"));
  const werte = [nummer, p.gruppe, p.kurztext, p.langtext, p.einheit, p.lohn_minuten, p.sonstiges_cent];
  let id = p.id;
  if (id) {
    await db.execute(
      `UPDATE katalog_position SET nummer=$1, gruppe=$2, kurztext=$3, langtext=$4, einheit=$5,
         lohn_minuten=$6, sonstiges_cent=$7 WHERE id=$8`,
      [...werte, id],
    );
  } else {
    const r = await db.execute(
      `INSERT INTO katalog_position (nummer, gruppe, kurztext, langtext, einheit, lohn_minuten, sonstiges_cent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      werte,
    );
    id = r.lastInsertId!;
  }
  // Im Prototyp: ein pauschaler Materialanteil je Position.
  // Später: einzelne Artikel mit Mengen (Tabelle katalog_material).
  await db.execute("DELETE FROM katalog_material WHERE katalog_position_id = $1", [id]);
  if (materialCent > 0) {
    await db.execute(
      "INSERT INTO katalog_material (katalog_position_id, bezeichnung, menge, preis_cent) VALUES ($1, 'Material pauschal', 1, $2)",
      [id, materialCent],
    );
  }
  return id;
}

export async function deaktiviereKatalogPosition(id: number) {
  const db = await getDb();
  await db.execute("UPDATE katalog_position SET aktiv = 0 WHERE id = $1", [id]);
}

// ---------- Lieferanten ----------
export interface Lieferant {
  id?: number;
  name: string;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  uid?: string | null;
  email?: string | null;
  telefon?: string | null;
  unsere_kundennummer?: string | null;
  notiz?: string | null;
  lieferantennummer?: string | null;
  land?: string | null;
  ansprechperson?: string | null;
}

export async function listeLieferanten(suche = ""): Promise<Lieferant[]> {
  const db = await getDb();
  return db.select<Lieferant>(
    "SELECT * FROM lieferant WHERE name LIKE $1 OR ort LIKE $1 OR lieferantennummer LIKE $1 ORDER BY name COLLATE NOCASE",
    [`%${suche}%`],
  );
}

export async function speichereLieferant(l: Lieferant): Promise<number> {
  const db = await getDb();
  const nummer = l.lieferantennummer?.trim() || (await vergebeNummer("lieferant"));
  const werte = [l.name, l.strasse, l.plz, l.ort, l.uid?.replace(/\s/g, "").toUpperCase() || null, l.email, l.telefon,
    l.unsere_kundennummer, l.notiz, nummer, l.land || "AT", l.ansprechperson];
  if (l.id) {
    await db.execute(
      `UPDATE lieferant SET name=$1, strasse=$2, plz=$3, ort=$4, uid=$5, email=$6, telefon=$7,
         unsere_kundennummer=$8, notiz=$9, lieferantennummer=$10, land=$11, ansprechperson=$12 WHERE id=$13`,
      [...werte, l.id],
    );
    return l.id;
  }
  const r = await db.execute(
    `INSERT INTO lieferant (name, strasse, plz, ort, uid, email, telefon, unsere_kundennummer, notiz, lieferantennummer, land,
       ansprechperson)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    werte,
  );
  return r.lastInsertId!;
}

export async function loescheLieferant(id: number) {
  const db = await getDb();
  await db.execute("DELETE FROM lieferant WHERE id = $1", [id]);
}

// ---------- Projekte ----------
export const projektStatus = [
  { wert: "anfrage", text: "Anfrage" },
  { wert: "angebot", text: "Angebot gelegt" },
  { wert: "auftrag", text: "Auftrag" },
  { wert: "abgerechnet", text: "Abgerechnet" },
  { wert: "verloren", text: "Nicht erhalten" },
] as const;

export interface Projekt {
  id?: number;
  nummer?: number | null; // Projektnummer, erster Teil der Belegnummer (z. B. 10 in 10-12-26)
  kunde_id: number;
  kunde_name?: string;
  bezeichnung: string;
  baustelle?: string | null;
  status: string;
  quelle: string;
  erstellt_am?: string;
}

export async function listeProjekte(suche = "", status = ""): Promise<Projekt[]> {
  const db = await getDb();
  return db.select<Projekt>(
    `SELECT p.*, k.name AS kunde_name FROM projekt p JOIN kunde k ON k.id = p.kunde_id
     WHERE (p.bezeichnung LIKE $1 OR k.name LIKE $1 OR p.baustelle LIKE $1 OR CAST(p.nummer AS TEXT) = $3)
       AND ($2 = '' OR p.status = $2)
     ORDER BY p.nummer DESC, p.id DESC`,
    [`%${suche}%`, status, suche.trim()],
  );
}

/** Vorschlag für die nächste Projektnummer */
export async function naechsteProjektnummer(): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db.select<{ n: number | null }>("SELECT MAX(nummer) AS n FROM projekt");
  return (n ?? 0) + 1;
}

export async function speichereProjekt(p: Projekt): Promise<number> {
  const db = await getDb();
  const nummer = p.nummer || (await naechsteProjektnummer());
  const werte = [p.kunde_id, p.bezeichnung, p.baustelle, p.status, p.quelle, nummer];
  if (p.id) {
    await db.execute(
      "UPDATE projekt SET kunde_id=$1, bezeichnung=$2, baustelle=$3, status=$4, quelle=$5, nummer=$6 WHERE id=$7",
      [...werte, p.id],
    );
    return p.id;
  }
  const r = await db.execute(
    "INSERT INTO projekt (kunde_id, bezeichnung, baustelle, status, quelle, nummer) VALUES ($1,$2,$3,$4,$5,$6)",
    werte,
  );
  return r.lastInsertId!;
}

export async function loescheProjekt(id: number) {
  const db = await getDb();
  await db.execute("DELETE FROM projekt WHERE id = $1", [id]);
}

// ---------- Nummernkreise ----------
export type NummernArt = "kunde" | "lieferant" | "artikel" | "katalog" | "aufbau";

export interface Nummernkreis {
  art: NummernArt;
  praefix: string;
  stellen: number;
  naechste_nummer: number;
}

export const nummernkreisNamen: Record<NummernArt, string> = {
  kunde: "Kunden",
  lieferant: "Lieferanten",
  artikel: "Artikel (Material)",
  katalog: "Positionskatalog",
  aufbau: "Aufbauten (Kalkulation)",
};

const nummernTabelle: Record<NummernArt, [string, string]> = {
  kunde: ["kunde", "kundennummer"],
  lieferant: ["lieferant", "lieferantennummer"],
  artikel: ["artikel", "nummer"],
  katalog: ["katalog_position", "nummer"],
  aufbau: ["aufbau", "nummer"],
};

export const formatNummer = (n: Pick<Nummernkreis, "praefix" | "stellen">, zahl: number) =>
  `${n.praefix}${String(zahl).padStart(Math.max(1, n.stellen), "0")}`;

export async function listeNummernkreise(): Promise<Nummernkreis[]> {
  const db = await getDb();
  const alle = await db.select<Nummernkreis>("SELECT art, praefix, stellen, naechste_nummer FROM nummernkreis");
  return (Object.keys(nummernkreisNamen) as NummernArt[])
    .map((a) => alle.find((n) => n.art === a))
    .filter((n): n is Nummernkreis => !!n);
}

export async function speichereNummernkreis(n: Nummernkreis) {
  const db = await getDb();
  await db.execute("UPDATE nummernkreis SET praefix=$1, stellen=$2, naechste_nummer=$3 WHERE art=$4",
    [n.praefix, n.stellen, n.naechste_nummer, n.art]);
}

/** Vorschau der nächsten Nummer, ohne sie zu verbrauchen. */
export async function naechsteNummerVorschau(art: NummernArt): Promise<string> {
  const db = await getDb();
  const [n] = await db.select<Nummernkreis>("SELECT * FROM nummernkreis WHERE art = $1", [art]);
  return n ? formatNummer(n, n.naechste_nummer) : "";
}

/** Vergibt die nächste freie Nummer und zählt den Nummernkreis weiter. */
export async function vergebeNummer(art: NummernArt): Promise<string | null> {
  const db = await getDb();
  const [n] = await db.select<Nummernkreis>("SELECT * FROM nummernkreis WHERE art = $1", [art]);
  if (!n) return null;
  const [tabelle, spalte] = nummernTabelle[art];
  let zahl = n.naechste_nummer;
  // vergebene Nummern überspringen (z. B. von Hand eingetragen)
  for (;;) {
    const [{ c }] = await db.select<{ c: number }>(`SELECT COUNT(*) AS c FROM ${tabelle} WHERE ${spalte} = $1`, [formatNummer(n, zahl)]);
    if (!c) break;
    zahl++;
  }
  await db.execute("UPDATE nummernkreis SET naechste_nummer = $1 WHERE art = $2", [zahl + 1, art]);
  return formatNummer(n, zahl);
}

// ---------- Artikel (Material) ----------
export interface Artikel {
  id?: number;
  nummer?: string | null;
  bezeichnung: string;
  gruppe?: string | null;
  einheit: string;
  einkaufspreis_cent: number;
  lieferant_id?: number | null;
  lieferant_name?: string | null;
  hersteller?: string | null;
  lieferanten_artikelnummer?: string | null;
  preis_stand?: string | null;
  notiz?: string | null;
}

export async function listeArtikel(suche = ""): Promise<Artikel[]> {
  const db = await getDb();
  return db.select<Artikel>(
    `SELECT a.*, l.name AS lieferant_name FROM artikel a LEFT JOIN lieferant l ON l.id = a.lieferant_id
     WHERE a.aktiv = 1 AND (a.bezeichnung LIKE $1 OR a.nummer LIKE $1 OR a.gruppe LIKE $1 OR COALESCE(l.name,'') LIKE $1
       OR COALESCE(a.lieferanten_artikelnummer,'') LIKE $1)
     ORDER BY a.gruppe, a.bezeichnung COLLATE NOCASE`,
    [`%${suche}%`],
  );
}

export async function speichereArtikel(a: Artikel): Promise<number> {
  const db = await getDb();
  const nummer = a.nummer?.trim() || (await vergebeNummer("artikel"));
  const werte = [nummer, a.bezeichnung, a.gruppe, a.einheit, a.einkaufspreis_cent, a.lieferant_id || null, a.hersteller,
    a.lieferanten_artikelnummer, a.preis_stand, a.notiz];
  if (a.id) {
    await db.execute(
      `UPDATE artikel SET nummer=$1, bezeichnung=$2, gruppe=$3, einheit=$4, einkaufspreis_cent=$5, lieferant_id=$6,
         hersteller=$7, lieferanten_artikelnummer=$8, preis_stand=$9, notiz=$10 WHERE id=$11`,
      [...werte, a.id],
    );
    return a.id;
  }
  const r = await db.execute(
    `INSERT INTO artikel (nummer, bezeichnung, gruppe, einheit, einkaufspreis_cent, lieferant_id, hersteller,
       lieferanten_artikelnummer, preis_stand, notiz) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    werte,
  );
  return r.lastInsertId!;
}

export async function deaktiviereArtikel(id: number) {
  const db = await getDb();
  await db.execute("UPDATE artikel SET aktiv = 0 WHERE id = $1", [id]);
}
