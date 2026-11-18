import { useEffect, useState } from "react";

export const parseZahl = (s: string) => {
  const t = s.trim().replace(/\s|€/g, "");
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : 0;
};
export const zeigeZahl = (n: number, stellen = 3) =>
  n.toLocaleString("de-AT", { maximumFractionDigits: stellen, useGrouping: false });

/** Eingabefeld für Zahlen mit Komma. Hält den getippten Text, gibt die Zahl weiter. */
export default function ZahlFeld({ wert, aendern, className, disabled, stellen = 3, cent, platzhalter }: {
  wert: number; aendern: (n: number) => void; className?: string; disabled?: boolean; stellen?: number; cent?: boolean; platzhalter?: string;
}) {
  const anzeigen = (n: number) => (cent ? (n ? (n / 100).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "") : n ? zeigeZahl(n, stellen) : "");
  const [text, setText] = useState(anzeigen(wert));
  useEffect(() => {
    const aktuell = cent ? Math.round(parseZahl(text) * 100) : parseZahl(text);
    if (aktuell !== wert) setText(anzeigen(wert));
  }, [wert]);
  return (
    <input className={`zahl ${className ?? ""}`} disabled={disabled} value={text} placeholder={platzhalter ?? "0"} inputMode="decimal"
      onChange={(e) => { setText(e.target.value); const n = parseZahl(e.target.value); aendern(cent ? Math.round(n * 100) : n); }}
      onBlur={() => setText(anzeigen(wert))} />
  );
}
