import { useEffect, useState } from "react";
import { Lieferant, listeLieferanten, loescheLieferant, speichereLieferant } from "../db/repo";

const leer: Lieferant = { name: "" };

export default function Lieferanten() {
  const [liste, setListe] = useState<Lieferant[]>([]);
  const [suche, setSuche] = useState("");
  const [form, setForm] = useState<Lieferant | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = () => listeLieferanten(suche).then(setListe);
  useEffect(() => { laden(); }, [suche]);

  const feld = (k: keyof Lieferant, label: string) => (
    <label>
      {label}
      <input value={(form?.[k] as string) ?? ""} onChange={(e) => setForm({ ...form!, [k]: e.target.value })} />
    </label>
  );

  async function speichern() {
    if (!form?.name.trim()) return setFehler("Bitte einen Namen eingeben.");
    try {
      await speichereLieferant(form);
      setForm(null);
      setFehler(null);
      laden();
    } catch (e) {
      setFehler(String(e));
    }
  }

  async function loeschen(l: Lieferant) {
    try {
      await loescheLieferant(l.id!);
      setForm(null);
      laden();
    } catch {
      setFehler("Lieferant hat bereits Artikel oder Bestellungen und kann nicht gelöscht werden.");
    }
  }

  return (
    <section>
      <div className="kopf">
        <h1>Lieferanten</h1>
        <input className="suche" placeholder="Suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} />
        <button className="primaer" onClick={() => setForm({ ...leer })}>Neuer Lieferant</button>
      </div>

      {form && (
        <div className="formular">
          <div className="raster">
            {feld("name", "Name / Firma *")}
            {feld("unsere_kundennummer", "Unsere Kundennummer")}
            {feld("strasse", "Straße")}
            {feld("plz", "PLZ")}
            {feld("ort", "Ort")}
            {feld("uid", "UID-Nummer")}
            {feld("email", "E-Mail für Bestellungen")}
            {feld("telefon", "Telefon")}
          </div>
          {fehler && <div className="fehler">{fehler}</div>}
          <div className="knoepfe">
            <button className="primaer" onClick={speichern}>Speichern</button>
            <button onClick={() => { setForm(null); setFehler(null); }}>Abbrechen</button>
            {form.id && <button className="gefahr" onClick={() => loeschen(form)}>Löschen</button>}
          </div>
        </div>
      )}

      {liste.length === 0 ? (
        <div className="leer">Noch keine Lieferanten. Lege mit „Neuer Lieferant“ den ersten an.</div>
      ) : (
        <table>
          <thead><tr><th>Name</th><th>Ort</th><th>Unsere Kd.-Nr.</th><th>E-Mail</th><th>Telefon</th></tr></thead>
          <tbody>
            {liste.map((l) => (
              <tr key={l.id} onClick={() => setForm(l)}>
                <td>{l.name}</td>
                <td>{[l.plz, l.ort].filter(Boolean).join(" ")}</td>
                <td>{l.unsere_kundennummer}</td>
                <td>{l.email}</td>
                <td>{l.telefon}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
