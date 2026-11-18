import { useEffect, useState } from "react";
import { Firma, formatNummer, ladeFirma, listeNummernkreise, Nummernkreis, nummernkreisNamen, speichereFirma, speichereNummernkreis } from "../db/repo";
import LandAuswahl from "../components/LandAuswahl";
import { centZuText, zuCent } from "../db/geld";

export default function Einstellungen() {
  const [f, setF] = useState<Firma | null>(null);
  const [lohn, setLohn] = useState("");
  const [gespeichert, setGespeichert] = useState(false);
  const [kreise, setKreise] = useState<Nummernkreis[]>([]);

  useEffect(() => {
    ladeFirma().then((x) => { setF(x); setLohn(centZuText(x.mittellohn_cent)); });
    listeNummernkreise().then(setKreise);
  }, []);
  const setKreis = (i: number, teil: Partial<Nummernkreis>) => { setGespeichert(false); setKreise(kreise.map((k, j) => (j === i ? { ...k, ...teil } : k))); };
  if (!f) return null;

  const feld = (k: keyof Firma, label: string) => (
    <label>
      {label}
      <input value={(f[k] as string | number | null) ?? ""} onChange={(e) => { setGespeichert(false); setF({ ...f, [k]: e.target.value }); }} />
    </label>
  );

  async function speichern() {
    await speichereFirma({
      ...f!,
      mittellohn_cent: zuCent(lohn),
      materialzuschlag_prozent: Number(String(f!.materialzuschlag_prozent).replace(",", ".")) || 0,
      gesamtzuschlag_prozent: Number(String(f!.gesamtzuschlag_prozent).replace(",", ".")) || 0,
      zahlungsziel_tage: Number(f!.zahlungsziel_tage) || 0,
      angebot_gueltig_tage: Number(f!.angebot_gueltig_tage) || 30,
    });
    for (const k of kreise) await speichereNummernkreis({ ...k, stellen: Number(k.stellen) || 1, naechste_nummer: Number(k.naechste_nummer) || 1 });
    setGespeichert(true);
  }

  return (
    <section>
      <div className="kopf"><h1>Einstellungen</h1></div>
      <div className="formular">
        <h2>Firmendaten</h2>
        <div className="raster">
          {feld("name", "Firmenname")}
          {feld("uid", "UID-Nummer")}
          {feld("strasse", "Straße")}
          {feld("plz", "PLZ")}
          {feld("ort", "Ort")}
          <label>Land<LandAuswahl wert={f.land} aendern={(l) => { setGespeichert(false); setF({ ...f, land: l }); }} /></label>
          {feld("telefon", "Telefon")}
          {feld("email", "E-Mail")}
          {feld("web", "Webseite")}
          {feld("firmenbuch", "Firmenbuchnummer (z. B. FN123456a)")}
          {feld("gericht", "Firmenbuchgericht (z. B. HG Ried im Innkreis)")}
          {feld("bank", "Bank")}
          {feld("iban", "IBAN")}
          {feld("bic", "BIC")}
          {feld("unterzeichner", "Name unter dem Gruß")}
        </div>
        <h2>Kalkulation</h2>
        <div className="raster">
          <label>Mittellohnpreis € je Stunde<input value={lohn} onChange={(e) => { setGespeichert(false); setLohn(e.target.value); }} /></label>
          {feld("materialzuschlag_prozent", "Materialzuschlag %")}
          {feld("gesamtzuschlag_prozent", "Gesamtzuschlag %")}
          {feld("zahlungsziel_tage", "Zahlungsziel (Tage)")}
          {feld("angebot_gueltig_tage", "Angebot gültig (Tage)")}
        </div>
        <h2>Nummernkreise</h2>
        <p className="hinweis">
          Belege (Angebot, Auftrag, Bestellung, Rechnung) folgen dem 8moss-Schema Projekt-Beleg-Jahr, z. B. 10-12-26.
          Für Stammdaten legst du hier Präfix, Stellen und die nächste Nummer fest. Eine Nummer kann beim Anlegen auch von Hand eingetragen werden.
        </p>
        <table className="positionen nummernkreise">
          <thead><tr><th>Bereich</th><th>Präfix</th><th className="zahl">Stellen</th><th className="zahl">Nächste Nummer</th><th>Beispiel</th></tr></thead>
          <tbody>
            {kreise.map((k, i) => (
              <tr key={k.art} className="keinklick">
                <td>{nummernkreisNamen[k.art]}</td>
                <td><input className="schmal" value={k.praefix} onChange={(e) => setKreis(i, { praefix: e.target.value })} /></td>
                <td className="zahl"><input className="sehrschmal zahl" value={k.stellen} onChange={(e) => setKreis(i, { stellen: Number(e.target.value.replace(/\D/g, "")) })} /></td>
                <td className="zahl"><input className="schmal zahl" value={k.naechste_nummer} onChange={(e) => setKreis(i, { naechste_nummer: Number(e.target.value.replace(/\D/g, "")) })} /></td>
                <td className="nummer">{formatNummer(k, Number(k.naechste_nummer) || 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="knoepfe" style={{ marginTop: 16 }}>
          <button className="primaer" onClick={speichern}>Speichern</button>
          {gespeichert && <span className="hinweis">Gespeichert.</span>}
        </div>
      </div>
    </section>
  );
}
