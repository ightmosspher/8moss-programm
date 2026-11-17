import { useEffect, useState } from "react";
import { Firma, ladeFirma, speichereFirma } from "../db/repo";
import { centZuText, zuCent } from "../db/geld";

export default function Einstellungen() {
  const [f, setF] = useState<Firma | null>(null);
  const [lohn, setLohn] = useState("");
  const [gespeichert, setGespeichert] = useState(false);

  useEffect(() => { ladeFirma().then((x) => { setF(x); setLohn(centZuText(x.mittellohn_cent)); }); }, []);
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
    });
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
          {feld("telefon", "Telefon")}
          {feld("email", "E-Mail")}
          {feld("iban", "IBAN")}
          {feld("bic", "BIC")}
        </div>
        <h2>Kalkulation</h2>
        <div className="raster">
          <label>Mittellohnpreis € je Stunde<input value={lohn} onChange={(e) => { setGespeichert(false); setLohn(e.target.value); }} /></label>
          {feld("materialzuschlag_prozent", "Materialzuschlag %")}
          {feld("gesamtzuschlag_prozent", "Gesamtzuschlag %")}
          {feld("zahlungsziel_tage", "Zahlungsziel (Tage)")}
        </div>
        <div className="knoepfe">
          <button className="primaer" onClick={speichern}>Speichern</button>
          {gespeichert && <span className="hinweis">Gespeichert.</span>}
        </div>
      </div>
    </section>
  );
}
