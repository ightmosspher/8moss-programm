/** Hilfen für Geldbeträge. Intern immer ganze Cent. */
const fmt = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export const euro = (cent: number | null | undefined) => fmt.format((cent ?? 0) / 100);

/** "1.234,56" oder "1234.56" -> 123456 */
export function zuCent(eingabe: string): number {
  const s = eingabe.trim().replace(/\s|€/g, "");
  const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export const centZuText = (cent: number | null | undefined) =>
  ((cent ?? 0) / 100).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Einheitspreis einer Position:
 * (Lohn + Material mit Zuschlag + Sonstiges) mit Gesamtzuschlag.
 */
export function einheitspreis(p: {
  lohn_minuten: number;
  material_cent: number;
  sonstiges_cent: number;
  mittellohn_cent: number;
  materialzuschlag_prozent: number;
  gesamtzuschlag_prozent: number;
}): number {
  const lohn = (p.lohn_minuten / 60) * p.mittellohn_cent;
  const material = p.material_cent * (1 + p.materialzuschlag_prozent / 100);
  const summe = (lohn + material + p.sonstiges_cent) * (1 + p.gesamtzuschlag_prozent / 100);
  return Math.round(summe);
}
