/**
 * Belege (Angebot, später Auftragsbestätigung, Bestellung, Rechnung).
 * Ein Beleg ist ein Entwurf, bis er abgeschlossen wird. Erst dann bekommt er
 * seine fortlaufende Nummer und ist unveränderlich (Trigger in der Datenbank).
 */
import { getDb } from "./index";
import { Firma, Kunde } from "./repo";
import { ohneUst, Steuerfall, steuerfallVon } from "../lib/steuer";

export type BelegArt = "angebot" | "auftrag" | "bestellung" | "rechnung" | "gutschrift";

export interface BelegPosition {
  id?: number;
  ordnungszahl?: string | null;
  kurztext: string;
  langtext?: string | null;
  einheit?: string | null;
  menge: number;
  einheitspreis_cent: number;
  katalog_position_id?: number | null; // nur im Editor, Herkunft aus dem Katalog
  kalkulation?: string | null; // Bauteilkalkulation als JSON
}

export interface Beleg {
  id?: number;
  art: BelegArt;
  nummer?: string | null; // intern: art:belegnummer
  belegnummer?: string | null; // wie gedruckt, z. B. 10-12-26
  projekt_id?: number | null;
  kunde_id?: number | null;
  datum: string; // YYYY-MM-DD
  status: "entwurf" | "abgeschlossen" | "storniert";
  anrede?: string | null;
  vortext?: string | null;
  schlusstext?: string | null;
  ust_prozent: number;
  reverse_charge: number;
  steuerfall?: Steuerfall | null;
  zahlungsziel_tage?: number | null;
  netto_cent?: number | null;
  ust_cent?: number | null;
  brutto_cent?: number | null;
  adresse_snapshot?: string | null;
  // aus Joins
  kunde_name?: string;
  projekt_bezeichnung?: string;
}

export const positionGesamt = (p: Pick<BelegPosition, "menge" | "einheitspreis_cent">) =>
  Math.round(p.menge * p.einheitspreis_cent);

export function summen(positionen: BelegPosition[], ustProzent: number, keineUst: boolean) {
  const netto = positionen.reduce((s, p) => s + positionGesamt(p), 0);
  const ust = keineUst ? 0 : Math.round((netto * ustProzent) / 100);
  return { netto, ust, brutto: netto + ust };
}

export async function listeBelege(art: BelegArt, suche = ""): Promise<Beleg[]> {
  const db = await getDb();
  return db.select<Beleg>(
    `SELECT b.*, k.name AS kunde_name, p.bezeichnung AS projekt_bezeichnung
     FROM beleg b LEFT JOIN kunde k ON k.id = b.kunde_id LEFT JOIN projekt p ON p.id = b.projekt_id
     WHERE b.art = $1 AND (COALESCE(b.belegnummer, b.nummer, '') LIKE $2 OR COALESCE(k.name,'') LIKE $2 OR COALESCE(p.bezeichnung,'') LIKE $2)
     ORDER BY b.datum DESC, b.id DESC`,
    [art, `%${suche}%`],
  );
}

export async function ladeBeleg(id: number): Promise<{ beleg: Beleg; positionen: BelegPosition[] }> {
  const db = await getDb();
  const [beleg] = await db.select<Beleg>(
    `SELECT b.*, k.name AS kunde_name, p.bezeichnung AS projekt_bezeichnung
     FROM beleg b LEFT JOIN kunde k ON k.id = b.kunde_id LEFT JOIN projekt p ON p.id = b.projekt_id WHERE b.id = $1`,
    [id],
  );
  const positionen = await db.select<BelegPosition>(
    "SELECT * FROM beleg_position WHERE beleg_id = $1 ORDER BY sortierung, id",
    [id],
  );
  return { beleg, positionen };
}

/** Speichert einen Entwurf samt Positionen. Gibt die Beleg-ID zurück. */
export async function speichereEntwurf(b: Beleg, positionen: BelegPosition[]): Promise<number> {
  const db = await getDb();
  const fall = steuerfallVon(b);
  const s = summen(positionen, b.ust_prozent, ohneUst(fall));
  const werte = [b.art, b.projekt_id, b.kunde_id, b.datum, b.anrede, b.vortext, b.schlusstext,
    b.ust_prozent, fall === "rc_bau" ? 1 : 0, b.zahlungsziel_tage, s.netto, s.ust, s.brutto, fall];
  let id = b.id;
  if (id) {
    await db.execute(
      `UPDATE beleg SET art=$1, projekt_id=$2, kunde_id=$3, datum=$4, anrede=$5, vortext=$6, schlusstext=$7,
         ust_prozent=$8, reverse_charge=$9, zahlungsziel_tage=$10, netto_cent=$11, ust_cent=$12, brutto_cent=$13,
         steuerfall=$14
       WHERE id=$15 AND status='entwurf'`,
      [...werte, id],
    );
  } else {
    const r = await db.execute(
      `INSERT INTO beleg (art, projekt_id, kunde_id, datum, anrede, vortext, schlusstext, ust_prozent, reverse_charge,
         zahlungsziel_tage, netto_cent, ust_cent, brutto_cent, steuerfall)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      werte,
    );
    id = r.lastInsertId!;
  }
  await db.execute("DELETE FROM beleg_position WHERE beleg_id = $1", [id]);
  for (const [i, p] of positionen.entries()) {
    await db.execute(
      `INSERT INTO beleg_position (beleg_id, sortierung, ordnungszahl, kurztext, langtext, einheit, menge,
         einheitspreis_cent, gesamt_cent, kalkulation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, i, `${i + 1}.0`, p.kurztext, p.langtext, p.einheit, p.menge,
       p.einheitspreis_cent, positionGesamt(p), p.kalkulation ?? null],
    );
  }
  return id;
}

/**
 * 8moss-Nummernschema: Projektnummer - laufender Beleg dieser Art im Projekt - Jahr (2-stellig).
 * Beispiel: 10-12-26 = Projekt 10, 12. Rechnung im Projekt, 2026.
 */
async function naechsteNummer(b: Beleg): Promise<string> {
  const db = await getDb();
  if (!b.projekt_id) throw new Error("Der Beleg braucht ein Projekt, um eine Nummer zu bekommen.");
  const [{ projektnr, anzahl }] = await db.select<{ projektnr: number; anzahl: number }>(
    `SELECT p.nummer AS projektnr,
            (SELECT COUNT(*) FROM beleg x WHERE x.projekt_id = p.id AND x.art = $2 AND x.status <> 'entwurf') AS anzahl
     FROM projekt p WHERE p.id = $1`,
    [b.projekt_id, b.art],
  );
  const jahr = b.datum.slice(2, 4);
  return `${projektnr}-${String(anzahl + 1).padStart(2, "0")}-${jahr}`;
}

/**
 * Schließt einen Entwurf ab: vergibt die Nummer und friert die Empfängeradresse ein.
 * Danach kann der Beleg nicht mehr verändert werden.
 */
export async function schliesseAb(id: number, kunde: Kunde | undefined): Promise<string> {
  const db = await getDb();
  const [b] = await db.select<Beleg>("SELECT * FROM beleg WHERE id = $1", [id]);
  if (b.status !== "entwurf") throw new Error("Beleg ist bereits abgeschlossen.");
  const nummer = await naechsteNummer(b);
  await db.execute(
    `UPDATE beleg SET belegnummer = $1, nummer = $2, status = 'abgeschlossen', abgeschlossen_am = datetime('now'),
       adresse_snapshot = $3
     WHERE id = $4 AND status = 'entwurf'`,
    [nummer, `${b.art}:${nummer}`, kunde ? JSON.stringify(kunde) : null, id],
  );
  if (b.art === "angebot" && b.projekt_id) {
    await db.execute("UPDATE projekt SET status = 'angebot' WHERE id = $1 AND status = 'anfrage'", [b.projekt_id]);
  }
  return nummer;
}

/** Legt einen neuen Entwurf als Kopie eines bestehenden Belegs an (z. B. neue Angebotsversion). */
export async function kopiereBeleg(id: number): Promise<number> {
  const { beleg, positionen } = await ladeBeleg(id);
  return speichereEntwurf(
    { ...beleg, id: undefined, nummer: null, belegnummer: null, status: "entwurf", datum: heute() },
    positionen.map((p) => ({ ...p, id: undefined })),
  );
}

export async function loescheEntwurf(id: number) {
  const db = await getDb();
  await db.execute("DELETE FROM beleg WHERE id = $1 AND status = 'entwurf'", [id]);
}

export const heute = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Standardtexte für ein neues Angebot */
export function angebotTexte(f: Firma, projekt?: { bezeichnung: string; baustelle?: string | null }) {
  const was = projekt ? `${projekt.bezeichnung}${projekt.baustelle ? `, ${projekt.baustelle}` : ""}` : "das angefragte Vorhaben";
  return {
    vortext: `wir bedanken uns für Ihre Anfrage zu ${was} und erlauben uns, folgendes Angebot zu legen:`,
    schlusstext: `Dieses Angebot ist ${f.angebot_gueltig_tage} Tage gültig. Wir freuen uns auf Ihren Auftrag.`,
  };
}

/** Alle Belege eines Projekts (für die Projektansicht). */
export async function listeBelegeZuProjekt(projektId: number): Promise<Beleg[]> {
  const db = await getDb();
  return db.select<Beleg>("SELECT * FROM beleg WHERE projekt_id = $1 ORDER BY datum DESC, id DESC", [projektId]);
}

/** Kennzahlen für die Startseite. */
export async function kennzahlen() {
  const db = await getDb();
  const [a] = await db.select<{ offen_anzahl: number; offen_netto: number; entwuerfe: number }>(
    `SELECT
       (SELECT COUNT(*) FROM beleg b JOIN projekt p ON p.id = b.projekt_id WHERE b.art = 'angebot' AND b.status = 'abgeschlossen' AND p.status = 'angebot') AS offen_anzahl,
       (SELECT COALESCE(SUM(b.netto_cent), 0) FROM beleg b JOIN projekt p ON p.id = b.projekt_id WHERE b.art = 'angebot' AND b.status = 'abgeschlossen' AND p.status = 'angebot'
          AND b.id = (SELECT MAX(x.id) FROM beleg x WHERE x.projekt_id = b.projekt_id AND x.art = 'angebot' AND x.status = 'abgeschlossen')) AS offen_netto,
       (SELECT COUNT(*) FROM beleg WHERE status = 'entwurf') AS entwuerfe`,
  );
  const status = await db.select<{ status: string; anzahl: number }>("SELECT status, COUNT(*) AS anzahl FROM projekt GROUP BY status");
  const letzte = await db.select<Beleg>(
    `SELECT b.*, k.name AS kunde_name, p.bezeichnung AS projekt_bezeichnung
     FROM beleg b LEFT JOIN kunde k ON k.id = b.kunde_id LEFT JOIN projekt p ON p.id = b.projekt_id
     ORDER BY COALESCE(b.abgeschlossen_am, b.erstellt_am) DESC, b.id DESC LIMIT 6`,
  );
  return { ...a, status, letzte };
}
