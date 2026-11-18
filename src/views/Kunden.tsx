import { useEffect, useState } from "react";
import { Kunde, listeKunden, loescheKunde, speichereKunde } from "../db/repo";

const leer: Kunde = { name: "", reverse_charge: 0 };

export default function Kunden() {
  const [liste, setListe] = useState<Kunde[]>([]);
  const [suche, setSuche] = useState("");
  const [form, setForm] = useState<Kunde | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = () => listeKunden(suche).then(setListe);
  useEffect(() => { laden(); }, [suche]);

  const feld = (k: keyof Kunde, label: string) => (
    <label>
      {label}
      <input value={(form?.[k] as string) ?? ""} onChange={(e) => setForm({ ...form!, [k]: e.target.value })} />
    </label>
  );

  async function speichern() {
    if (!form?.name.trim()) return setFehler("Bitte einen Namen eingeben.");
    try {
      await speichereKunde(form);
      setForm(null);
      setFehler(null);
      laden();
    } catch (e) {
      setFehler(String(e));
    }
  }

  async function loeschen(k: Kunde) {
    try {
      await loescheKunde(k.id!);
      setForm(null);
      laden();
    } catch {
      setFehler("Kunde hat bereits Projekte oder Belege und kann nicht gelöscht werden.");
    }
  }

  return (
    <section>
      <div className="kopf">
        <h1>Kunden</h1>
        <input className="suche" placeholder="Suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} />
        <button className="primaer" onClick={() => setForm({ ...leer })}>Neuer Kunde</button>
      </div>

      {form && (
        <div className="formular">
          <div className="raster">
            {feld("name", "Name / Firma *")}
            {feld("ansprechperson", "Ansprechperson")}
            {feld("strasse", "Straße")}
            {feld("plz", "PLZ")}
            {feld("ort", "Ort")}
            {feld("uid", "UID-Nummer")}
            {feld("email", "E-Mail")}
            {feld("telefon", "Telefon")}
            {feld("firmenbuch", "Firmenbuchnummer")}
            {feld("anrede", "Anrede im Brief (z. B. Sehr geehrter Herr Muster,)")}
          </div>
          <label className="haken">
            <input type="checkbox" checked={!!form.reverse_charge}
              onChange={(e) => setForm({ ...form, reverse_charge: e.target.checked ? 1 : 0 })} />
            Reverse Charge (Bauleistung an Bauunternehmer, § 19 Abs. 1a UStG)
          </label>
          {fehler && <div className="fehler">{fehler}</div>}
          <div className="knoepfe">
            <button className="primaer" onClick={speichern}>Speichern</button>
            <button onClick={() => { setForm(null); setFehler(null); }}>Abbrechen</button>
            {form.id && <button className="gefahr" onClick={() => loeschen(form)}>Löschen</button>}
          </div>
        </div>
      )}

      {liste.length === 0 ? (
        <div className="leer">Noch keine Kunden. Lege mit „Neuer Kunde“ den ersten an.</div>
      ) : (
        <table>
          <thead><tr><th>Name</th><th>Ort</th><th>UID</th><th>E-Mail</th><th>Reverse Charge</th></tr></thead>
          <tbody>
            {liste.map((k) => (
              <tr key={k.id} onClick={() => setForm(k)}>
                <td>{k.name}</td>
                <td>{[k.plz, k.ort].filter(Boolean).join(" ")}</td>
                <td>{k.uid}</td>
                <td>{k.email}</td>
                <td>{k.reverse_charge ? "ja" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
