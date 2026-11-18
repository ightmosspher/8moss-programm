import { Artikel } from "../db/repo";
import { Schicht, schichtKosten } from "../db/aufbau";
import { euro } from "../db/geld";
import ZahlFeld, { zeigeZahl } from "./ZahlFeld";
import Icon from "./Icon";

/** Materialien und Arbeitszeit eines Aufbaus, je Einheit (meist m²). Optional mit Gesamtbedarf für eine Menge. */
export default function SchichtenTabelle({ schichten, setSchichten, artikel, einheit, menge }: {
  schichten: Schicht[]; setSchichten: (s: Schicht[]) => void; artikel: Artikel[]; einheit: string; menge?: number;
}) {
  const setS = (i: number, teil: Partial<Schicht>) => setSchichten(schichten.map((s, j) => (j === i ? { ...s, ...teil } : s)));
  const verschiebe = (i: number, d: number) => { const n = [...schichten]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); setSchichten(n); };
  const eh = einheit.replace("m2", "m²");

  function artikelWaehlen(i: number, id: string) {
    const a = artikel.find((x) => String(x.id) === id);
    if (!a) return setS(i, { artikel_id: null, artikel_nummer: null });
    setS(i, { artikel_id: a.id, artikel_nummer: a.nummer, bezeichnung: a.bezeichnung, einheit: a.einheit, preis_cent: a.einkaufspreis_cent });
  }

  return (
    <table className="positionen schichten">
      <thead>
        <tr>
          <th>Material / Arbeitsschritt</th>
          <th className="zahl">Verbrauch je {eh}</th>
          <th className="zahl">Verschnitt %</th>
          <th className="zahl">EK-Preis</th>
          <th className="zahl">Lohn min je {eh}</th>
          <th className="zahl">Material je {eh}</th>
          {menge !== undefined && <th className="zahl">Bedarf gesamt</th>}
          <th></th>
        </tr>
      </thead>
      <tbody>
        {schichten.map((s, i) => (
          <tr key={i} className="keinklick">
            <td className="leistung">
              <select value={s.artikel_id ?? ""} onChange={(e) => artikelWaehlen(i, e.target.value)}>
                <option value="">Freie Zeile (ohne Artikel)</option>
                {artikel.map((a) => <option key={a.id} value={a.id}>{a.nummer}  {a.bezeichnung}</option>)}
              </select>
              {!s.artikel_id && (
                <input placeholder="Bezeichnung, z. B. Spachteln Q2 oder Kleinmaterial" value={s.bezeichnung}
                  onChange={(e) => setS(i, { bezeichnung: e.target.value })} style={{ marginTop: 6 }} />
              )}
            </td>
            <td className="zahl">
              <div className="mit-einheit"><ZahlFeld className="schmal" wert={s.verbrauch} aendern={(n) => setS(i, { verbrauch: n })} />
                {s.artikel_id ? <span>{s.einheit}</span> : <input className="sehrschmal" value={s.einheit ?? ""} placeholder="Einh." onChange={(e) => setS(i, { einheit: e.target.value })} />}
              </div>
            </td>
            <td className="zahl"><ZahlFeld className="sehrschmal" wert={s.verschnitt_prozent} aendern={(n) => setS(i, { verschnitt_prozent: n })} /></td>
            <td className="zahl">
              {s.artikel_id
                ? (s.preis_cent ? euro(s.preis_cent) : <span className="status status-warn" title="Preis beim Artikel eintragen">fehlt</span>)
                : <ZahlFeld className="schmal" cent wert={s.preis_cent} aendern={(n) => setS(i, { preis_cent: n })} platzhalter="0,00" />}
            </td>
            <td className="zahl"><ZahlFeld className="sehrschmal" wert={s.lohn_minuten} aendern={(n) => setS(i, { lohn_minuten: n })} /></td>
            <td className="zahl">{euro(Math.round(schichtKosten(s)))}</td>
            {menge !== undefined && (
              <td className="zahl">{s.verbrauch ? `${zeigeZahl(Math.ceil(menge * s.verbrauch * (1 + s.verschnitt_prozent / 100) * 10) / 10, 1)} ${(s.einheit ?? "").replace("m2", "m²")}` : ""}</td>
            )}
            <td className="aktionen">
              <button className="symbol" disabled={i === 0} onClick={() => verschiebe(i, -1)} title="nach oben"><Icon name="hoch" size={14} /></button>
              <button className="symbol" disabled={i === schichten.length - 1} onClick={() => verschiebe(i, 1)} title="nach unten"><Icon name="runter" size={14} /></button>
              <button className="symbol" onClick={() => setSchichten(schichten.filter((_, j) => j !== i))} title="entfernen"><Icon name="muell" size={14} /></button>
            </td>
          </tr>
        ))}
        {schichten.length === 0 && <tr className="keinklick"><td colSpan={8} className="hinweis">Noch keine Materialien oder Arbeitsschritte.</td></tr>}
      </tbody>
      <tfoot>
        <tr><td colSpan={8}>
          <button onClick={() => setSchichten([...schichten, { bezeichnung: "", verbrauch: 1, einheit: "", verschnitt_prozent: 0, preis_cent: 0, lohn_minuten: 0 }])}>
            <Icon name="plus" size={14} /> Zeile hinzufügen
          </button>
        </td></tr>
      </tfoot>
    </table>
  );
}
