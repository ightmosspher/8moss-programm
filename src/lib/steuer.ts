/**
 * Steuerfälle für Belege (Österreich, UStG 1994).
 *
 * Wichtig: Bei Bauleistungen an einem Grundstück gilt der Ort des Grundstücks.
 * Liegt die Baustelle in Österreich, ist auch für ausländische Kunden
 * österreichische USt zu verrechnen (bzw. Reverse Charge bei Bauunternehmern).
 */
import { istEu } from "./laender";

export type Steuerfall = "inland" | "rc_bau" | "eu_rc" | "eu_lieferung" | "drittland";

export const steuerfaelle: { wert: Steuerfall; text: string; hinweis: string | null }[] = [
  { wert: "inland", text: "Inland: 20 % USt", hinweis: null },
  { wert: "rc_bau", text: "Reverse Charge Bauleistung (§ 19 Abs. 1a)",
    hinweis: "Übergang der Steuerschuld auf den Leistungsempfänger gemäß § 19 Abs. 1a UStG." },
  { wert: "eu_rc", text: "EU-Ausland: Leistung, Reverse Charge",
    hinweis: "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge)." },
  { wert: "eu_lieferung", text: "EU-Ausland: innergemeinschaftliche Lieferung",
    hinweis: "Steuerfreie innergemeinschaftliche Lieferung gemäß Art. 6 Abs. 1 UStG." },
  { wert: "drittland", text: "Drittland: ohne österreichische USt",
    hinweis: "Steuerfreie Ausfuhrlieferung gemäß § 7 UStG bzw. Leistung im Inland nicht steuerbar." },
];

export const ohneUst = (f: Steuerfall | null | undefined) => !!f && f !== "inland";
export const steuerHinweis = (f: Steuerfall | null | undefined) => steuerfaelle.find((s) => s.wert === f)?.hinweis ?? null;

/** Steuerfall eines Belegs, auch für alte Belege ohne gespeicherten Steuerfall. */
export const steuerfallVon = (b: { steuerfall?: string | null; reverse_charge?: number | null }): Steuerfall =>
  (b.steuerfall as Steuerfall) || (b.reverse_charge ? "rc_bau" : "inland");

/** Vorschlag aus den Kundendaten (Land, UID, Reverse-Charge-Haken). */
export function steuerfallVorschlag(k?: { land?: string | null; uid?: string | null; reverse_charge?: number } | null): Steuerfall {
  if (!k) return "inland";
  const land = k.land || "AT";
  if (land === "AT") return k.reverse_charge ? "rc_bau" : "inland";
  if (istEu(land)) return k.uid ? "eu_rc" : "inland";
  return "drittland";
}

/** Grobe Prüfung des UID-Formats (kein Ersatz für die Abfrage bei FinanzOnline/MIAS). */
export function uidPruefen(uid: string | null | undefined, land: string | null | undefined): string | null {
  if (!uid) return null;
  const u = uid.replace(/\s/g, "").toUpperCase();
  const l = land || "AT";
  if (l === "AT" && !/^ATU\d{8}$/.test(u)) return "Österreichische UID hat das Format ATU12345678.";
  if (l === "DE" && !/^DE\d{9}$/.test(u)) return "Deutsche UID hat das Format DE123456789.";
  if (istEu(l) && l !== "AT" && l !== "DE" && !u.startsWith(l === "GR" ? "EL" : l)) return `Eine UID aus ${l} beginnt mit ${l === "GR" ? "EL" : l}.`;
  return null;
}
