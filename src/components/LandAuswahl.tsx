import { laender } from "../lib/laender";

export default function LandAuswahl({ wert, aendern, disabled }: { wert?: string | null; aendern: (code: string) => void; disabled?: boolean }) {
  return (
    <select value={wert || "AT"} disabled={disabled} onChange={(e) => aendern(e.target.value)}>
      {laender.map((l) => <option key={l.code} value={l.code}>{l.name}{l.eu ? "" : " (kein EU-Land)"}</option>)}
    </select>
  );
}
