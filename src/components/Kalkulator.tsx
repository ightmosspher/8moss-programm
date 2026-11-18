import { useEffect, useState } from "react";
import { Aufbau, AufmassZeile, bauteile, Kalkulation, ladeAufbau, listeAufbauten, neueKalkulation, rechne } from "../db/aufbau";
import { Artikel, Firma, listeArtikel } from "../db/repo";
import { BelegPosition } from "../db/belege";
import { euro } from "../db/geld";
import Schublade from "./Schublade";
import SchichtenTabelle from "./SchichtenTabelle";
import ZahlFeld, { zeigeZahl } from "./ZahlFeld";
import Icon from "./Icon";

/**
 * Bauteilkalkulation im Angebot: Aufbau wählen, Aufmaß eingeben (mit Abzügen für Öffnungen),
 * Material und Zeiten bei Bedarf anpassen, als Position übernehmen.
 */
export default function Kalkulator({ firma, start, uebernehmen, schliessen }: {
  firma: Firma; start?: Kalkulation | null; uebernehmen: (p: BelegPosition) => void; schliessen: () => void;
}) {
  const [aufbauten, setAufbauten] = useState<Aufbau[]>([]);
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [k, setK] = useState<Kalkulation | null>(start ?? null);
  const [zeigeMaterial, setZeigeMaterial] = useState(false);

  useEffect(() => { listeAufbauten().then(setAufbauten); listeArtikel().then(setArtikel); }, []);

  async function waehle(a: Aufbau) { setK(neueKalkulation(await ladeAufbau(a.id!))); }

  if (!k) {
    return (
      <Schublade breit titel="Bauteil kalkulieren" untertitel="Schritt 1: Aufbau wählen" schliessen={schliessen}>
        {bauteile.map((b) => {
          const liste = aufbauten.filter((a) => a.bauteil === b.wert);
          if (!liste.length) return null;
          return (
            <div key={b.wert}>
              <h3>{b.text}</h3>
              <div className="karten">
                {liste.map((a) => (
                  <button key={a.id} className="karte" onClick={() => waehle(a)}>
                    <div className="karte-kopf"><span className={`bauteil bauteil-${a.bauteil}`}>{b.text}</span><span className="nummer">{a.nummer}</span></div>
                    <div className="karte-titel">{a.bezeichnung}</div>
                    {!!a.preis_fehlt && <div className="status status-warn">{a.preis_fehlt} Preise fehlen</div>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {aufbauten.length === 0 && <div className="leer">Noch keine Aufbauten. Lege sie unter Kalkulation › Aufbauten an.</div>}
      </Schublade>
    );
  }

  const r = rechne(k, firma);
  const eh = k.einheit.replace("m2", "m²");
  const wand = k.bauteil === "wand";
  const setZ = (i: number, teil: Partial<AufmassZeile>) => setK({ ...k, aufmass: k.aufmass.map((z, j) => (j === i ? { ...z, ...teil } : z)) });
  const neueZeile = (abzug: boolean) => setK({ ...k, aufmass: [...k.aufmass, abzug
    ? { text: wand ? "Tür" : "Aussparung", anzahl: 1, laenge: wand ? 0.9 : 0, breite: wand ? 2.1 : 0, abzug: true }
    : { text: wand ? "Wand" : "Raum", anzahl: 1, laenge: 0, breite: 0, abzug: false }] });

  function fertig() {
    uebernehmen({
      kurztext: k!.bezeichnung, langtext: k!.langtext, einheit: k!.einheit, menge: r.menge, einheitspreis_cent: r.ep,
      kalkulation: JSON.stringify(k),
    });
  }

  return (
    <Schublade breit titel={k.bezeichnung} untertitel="Bauteilkalkulation: Aufmaß × Aufbau" schliessen={schliessen}
      fuss={<>
        <button className="primaer" onClick={fertig} disabled={r.menge <= 0}><Icon name="haken" size={16} /> {start ? "Position aktualisieren" : "Ins Angebot übernehmen"}</button>
        <button onClick={schliessen}>Abbrechen</button>
        {!start && <button className="link" onClick={() => setK(null)}>Anderen Aufbau wählen</button>}
      </>}>
      <div className="kennzahlen">
        <div><span>Menge</span><strong>{zeigeZahl(r.menge, 2)} {eh}</strong></div>
        <div><span>Einheitspreis</span><strong>{euro(r.ep)}</strong></div>
        <div><span>Arbeitszeit gesamt</span><strong>{zeigeZahl(r.stunden, 1)} h</strong></div>
        <div className="hervor"><span>Gesamt netto</span><strong>{euro(r.gesamt)}</strong></div>
      </div>

      <h3>Aufmaß</h3>
      <table className="positionen aufmass">
        <thead><tr><th>Bezeichnung</th><th className="zahl">Anzahl</th>
          {k.einheit !== "Stk" && <th className="zahl">Länge m</th>}
          {k.einheit === "m2" && <th className="zahl">{wand ? "Höhe m" : "Breite m"}</th>}
          <th>Abzug</th><th className="zahl">Ergebnis</th><th></th></tr></thead>
        <tbody>
          {k.aufmass.map((z, i) => (
            <tr key={i} className={`keinklick ${z.abzug ? "abzug" : ""}`}>
              <td><input value={z.text} onChange={(e) => setZ(i, { text: e.target.value })} /></td>
              <td className="zahl"><ZahlFeld className="sehrschmal" wert={z.anzahl} aendern={(n) => setZ(i, { anzahl: n })} /></td>
              {k.einheit !== "Stk" && <td className="zahl"><ZahlFeld className="schmal" wert={z.laenge} aendern={(n) => setZ(i, { laenge: n })} /></td>}
              {k.einheit === "m2" && <td className="zahl"><ZahlFeld className="schmal" wert={z.breite} aendern={(n) => setZ(i, { breite: n })} /></td>}
              <td><input type="checkbox" checked={z.abzug} onChange={(e) => setZ(i, { abzug: e.target.checked })} title="Öffnung abziehen" /></td>
              <td className="zahl">{zeigeZahl(r.zeilen[i], 2)} {eh}</td>
              <td className="aktionen"><button className="symbol" onClick={() => setK({ ...k, aufmass: k.aufmass.filter((_, j) => j !== i) })} title="entfernen"><Icon name="muell" size={14} /></button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={7}>
            <div className="knoepfe">
              <button onClick={() => neueZeile(false)}><Icon name="plus" size={14} /> {wand ? "Wand" : "Fläche"} hinzufügen</button>
              <button onClick={() => neueZeile(true)}><Icon name="plus" size={14} /> Öffnung abziehen</button>
              <span className="hinweis" style={{ marginLeft: "auto" }}>Summe: <strong>{zeigeZahl(r.menge, 2)} {eh}</strong></span>
            </div>
          </td></tr>
        </tfoot>
      </table>

      <div className="abschnitt-kopf">
        <h3>Aufbau je {eh}</h3>
        <span className="hinweis">Material {euro(r.materialCent)} · {r.lohnMin} min Arbeitszeit ({euro(r.lohnCent)})</span>
        <button className="link" onClick={() => setZeigeMaterial(!zeigeMaterial)}>{zeigeMaterial ? "ausblenden" : "anzeigen und anpassen"}</button>
      </div>
      {zeigeMaterial && (
        <>
          <SchichtenTabelle schichten={k.schichten} setSchichten={(s) => setK({ ...k, schichten: s })} artikel={artikel} einheit={k.einheit} menge={r.menge} />
          <p className="hinweis">Änderungen gelten nur für diese Position. Die Vorlage änderst du unter Kalkulation › Aufbauten.</p>
        </>
      )}
      {r.preisFehlt > 0 && <div className="hinweis-box"><Icon name="warnung" size={16} /> Bei {r.preisFehlt} Material fehlt der Einkaufspreis, der Preis ist deshalb zu niedrig. Trage die Preise unter Artikel ein.</div>}

      <h3>Text im Angebot</h3>
      <div className="raster">
        <label className="breit">Kurztext<input value={k.bezeichnung} onChange={(e) => setK({ ...k, bezeichnung: e.target.value })} /></label>
        <label className="breit">Langtext<textarea rows={4} value={k.langtext} onChange={(e) => setK({ ...k, langtext: e.target.value })} /></label>
      </div>
    </Schublade>
  );
}
