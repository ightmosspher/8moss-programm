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
       mittellohn_cent=$10, materialzuschlag_prozent=$11, gesamtzuschlag_prozent=$12, zahlungsziel_tage=$13 WHERE id = 1`,
    [f.name, f.strasse, f.plz, f.ort, f.uid, f.email, f.telefon, f.iban, f.bic,
     f.mittellohn_cent, f.materialzuschlag_prozent, f.gesamtzuschlag_prozent, f.zahlungsziel_tage],
  );
}

// ---------- Kunden ----------
export async function listeKunden(suche = ""): Promise<Kunde[]> {
  const db = await getDb();
  return db.select<Kunde>(
    "SELECT * FROM kunde WHERE name LIKE $1 OR ort LIKE $1 ORDER BY name COLLATE NOCASE",
    [`%${suche}%`],
  );
}

export async function speichereKunde(k: Kunde): Promise<number> {
  const db = await getDb();
  const werte = [k.name, k.ansprechperson, k.strasse, k.plz, k.ort, k.uid, k.email, k.telefon, k.reverse_charge, k.notiz];
  if (k.id) {
    await db.execute(
      `UPDATE kunde SET name=$1, ansprechperson=$2, strasse=$3, plz=$4, ort=$5, uid=$6, email=$7, telefon=$8,
         reverse_charge=$9, notiz=$10 WHERE id=$11`,
      [...werte, k.id],
    );
    return k.id;
  }
  const r = await db.execute(
    `INSERT INTO kunde (name, ansprechperson, strasse, plz, ort, uid, email, telefon, reverse_charge, notiz)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
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
  const werte = [p.nummer, p.gruppe, p.kurztext, p.langtext, p.einheit, p.lohn_minuten, p.sonstiges_cent];
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
