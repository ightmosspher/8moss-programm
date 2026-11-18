/**
 * Bauteilkalkulation (Wand, Decke, Boden) nach dem Prinzip "Aufbau x Aufmaß":
 * Ein Aufbau ist ein Rezept je m² (Material mit Verbrauch und Verschnitt, Arbeitszeit).
 * Das Aufmaß liefert die Menge. Daraus ergeben sich Einheitspreis, Gesamtpreis
 * und die Materialmengen für die Bestellung.
 */
import { getDb } from "./index";
import { einheitspreis } from "./geld";
import { Firma, vergebeNummer } from "./repo";

export type Bauteil = "wand" | "decke" | "boden" | "sonstiges";
export const bauteile: { wert: Bauteil; text: string }[] = [
  { wert: "wand", text: "Wand" },
  { wert: "decke", text: "Decke" },
  { wert: "boden", text: "Boden" },
  { wert: "sonstiges", text: "Sonstiges" },
];

export interface Schicht {
  id?: number;
  artikel_id?: number | null;
  artikel_nummer?: string | null;
  bezeichnung: string;
  verbrauch: number; // je Einheit des Aufbaus
  einheit?: string | null;
  verschnitt_prozent: number;
  preis_cent: number; // Einkaufspreis je Einheit des Materials (aus dem Artikel, falls verknüpft)
  lohn_minuten: number; // je Einheit des Aufbaus
}

export interface Aufbau {
  id?: number;
  nummer?: string | null;
  bauteil: Bauteil;
  bezeichnung: string;
  langtext?: string | null;
  einheit: string;
  schichten: Schicht[];
  // berechnet in der Liste
  material_cent?: number;
  lohn_minuten?: number;
  preis_fehlt?: number;
}

export interface AufmassZeile {
  text: string;
  anzahl: number;
  laenge: number;
  breite: number; // bei Wand: Höhe
  abzug: boolean; // Öffnung (Tür, Fenster) wird abgezogen
}

/** Wird als JSON in der Angebotsposition gespeichert, damit man die Kalkulation wieder öffnen kann. */
export interface Kalkulation {
  aufbau_id?: number | null;
  bauteil: Bauteil;
  bezeichnung: string;
  langtext: string;
  einheit: string;
  aufmass: AufmassZeile[];
  schichten: Schicht[];
}

export const schichtKosten = (s: Schicht) => s.verbrauch * (1 + s.verschnitt_prozent / 100) * s.preis_cent;

export function rechne(k: Pick<Kalkulation, "aufmass" | "schichten" | "einheit">, firma: Firma) {
  const flaeche = k.einheit === "m2";
  const zeilen = k.aufmass.map((z) => {
    const ergebnis = k.einheit === "Stk" ? z.anzahl : z.anzahl * z.laenge * (flaeche ? z.breite : 1);
    return z.abzug ? -ergebnis : ergebnis;
  });
  const menge = Math.max(0, Math.round(zeilen.reduce((s, x) => s + x, 0) * 100) / 100);
  const material = k.schichten.reduce((s, x) => s + schichtKosten(x), 0);
  const lohnMin = k.schichten.reduce((s, x) => s + x.lohn_minuten, 0);
  const ep = einheitspreis({ lohn_minuten: lohnMin, material_cent: material, sonstiges_cent: 0, ...firma });
  const lohnCent = Math.round((lohnMin / 60) * firma.mittellohn_cent);
  return {
    zeilen,
    menge,
    materialCent: Math.round(material),
    lohnMin,
    lohnCent,
    ep,
    gesamt: Math.round(ep * menge),
    stunden: Math.round(((lohnMin * menge) / 60) * 10) / 10,
    bedarf: k.schichten.map((s) => ({
      ...s,
      menge: Math.ceil(menge * s.verbrauch * (1 + s.verschnitt_prozent / 100) * 10) / 10,
    })),
    preisFehlt: k.schichten.filter((s) => s.verbrauch > 0 && !s.preis_cent).length,
  };
}

/** Langtext für das Angebot: Text des Aufbaus, sonst die Schichten als Aufzählung. */
export const langtextVon = (a: Pick<Aufbau, "langtext" | "schichten">) =>
  a.langtext?.trim() || a.schichten.map((s) => `- ${s.bezeichnung}`).join("\n");

export async function listeAufbauten(suche = ""): Promise<Aufbau[]> {
  const db = await getDb();
  const liste = await db.select<Omit<Aufbau, "schichten">>(
    `SELECT a.*,
       COALESCE((SELECT SUM(s.verbrauch * (1 + s.verschnitt_prozent / 100.0) * COALESCE(ar.einkaufspreis_cent, s.preis_cent))
                 FROM aufbau_schicht s LEFT JOIN artikel ar ON ar.id = s.artikel_id WHERE s.aufbau_id = a.id), 0) AS material_cent,
       COALESCE((SELECT SUM(s.lohn_minuten) FROM aufbau_schicht s WHERE s.aufbau_id = a.id), 0) AS lohn_minuten,
       (SELECT COUNT(*) FROM aufbau_schicht s LEFT JOIN artikel ar ON ar.id = s.artikel_id
         WHERE s.aufbau_id = a.id AND s.verbrauch > 0 AND COALESCE(ar.einkaufspreis_cent, s.preis_cent) = 0) AS preis_fehlt
     FROM aufbau a WHERE a.aktiv = 1 AND (a.bezeichnung LIKE $1 OR COALESCE(a.nummer,'') LIKE $1)
     ORDER BY CASE a.bauteil WHEN 'wand' THEN 1 WHEN 'decke' THEN 2 WHEN 'boden' THEN 3 ELSE 4 END, a.nummer, a.bezeichnung`,
    [`%${suche}%`],
  );
  return liste.map((a) => ({ ...a, schichten: [] }));
}

export async function ladeAufbau(id: number): Promise<Aufbau> {
  const db = await getDb();
  const [a] = await db.select<Aufbau>("SELECT * FROM aufbau WHERE id = $1", [id]);
  const schichten = await db.select<Schicht>(
    `SELECT s.id, s.artikel_id, ar.nummer AS artikel_nummer, COALESCE(ar.bezeichnung, s.bezeichnung) AS bezeichnung,
       s.verbrauch, COALESCE(ar.einheit, s.einheit) AS einheit, s.verschnitt_prozent,
       COALESCE(ar.einkaufspreis_cent, s.preis_cent) AS preis_cent, s.lohn_minuten
     FROM aufbau_schicht s LEFT JOIN artikel ar ON ar.id = s.artikel_id
     WHERE s.aufbau_id = $1 ORDER BY s.sortierung, s.id`,
    [id],
  );
  return { ...a, schichten };
}

export async function speichereAufbau(a: Aufbau): Promise<number> {
  const db = await getDb();
  const nummer = a.nummer?.trim() || (await vergebeNummer("aufbau"));
  const werte = [nummer, a.bauteil, a.bezeichnung, a.langtext, a.einheit];
  let id = a.id;
  if (id) {
    await db.execute("UPDATE aufbau SET nummer=$1, bauteil=$2, bezeichnung=$3, langtext=$4, einheit=$5 WHERE id=$6", [...werte, id]);
  } else {
    const r = await db.execute("INSERT INTO aufbau (nummer, bauteil, bezeichnung, langtext, einheit) VALUES ($1,$2,$3,$4,$5)", werte);
    id = r.lastInsertId!;
  }
  await db.execute("DELETE FROM aufbau_schicht WHERE aufbau_id = $1", [id]);
  for (const [i, s] of a.schichten.entries()) {
    await db.execute(
      `INSERT INTO aufbau_schicht (aufbau_id, sortierung, artikel_id, bezeichnung, verbrauch, einheit, verschnitt_prozent,
         preis_cent, lohn_minuten) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, i, s.artikel_id || null, s.bezeichnung, s.verbrauch, s.einheit, s.verschnitt_prozent, s.artikel_id ? 0 : s.preis_cent, s.lohn_minuten],
    );
  }
  return id;
}

export async function deaktiviereAufbau(id: number) {
  const db = await getDb();
  await db.execute("UPDATE aufbau SET aktiv = 0 WHERE id = $1", [id]);
}

/** Neue Kalkulation aus einem Aufbau, mit einem leeren Aufmaß passend zum Bauteil. */
export function neueKalkulation(a: Aufbau): Kalkulation {
  const erste: AufmassZeile = a.bauteil === "wand"
    ? { text: "Wand", anzahl: 1, laenge: 0, breite: 0, abzug: false }
    : { text: "Raum", anzahl: 1, laenge: 0, breite: 0, abzug: false };
  return {
    aufbau_id: a.id, bauteil: a.bauteil, bezeichnung: a.bezeichnung, langtext: langtextVon(a), einheit: a.einheit,
    aufmass: [erste], schichten: a.schichten.map((s) => ({ ...s })),
  };
}
