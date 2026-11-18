import { useEffect, useState } from "react";
import { Lieferant, listeLieferanten, loescheLieferant, naechsteNummerVorschau, speichereLieferant } from "../db/repo";
import Schublade from "../components/Schublade";
import LandAuswahl from "../components/LandAuswahl";
import Icon from "../components/Icon";
import { landName } from "../lib/laender";
import { uidPruefen } from "../lib/steuer";

const leer: Lieferant = { name: "", land: "AT" };

export default function Lieferanten() {
  const [liste, setListe] = useState<Lieferant[]>([]);
  const [suche, setSuche] = useState("");
  const [form, setForm] = useState<Lieferant | null>(null);
  const [vorschau, setVorschau] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = () => listeLieferanten(suche).then(setListe);
  useEffect(() => { laden(); }, [suche]);

  async function neu() {
    setFehler(null);
    setVorschau(await naechsteNummerVorschau("lieferant"));
    setForm({ ...leer });
  }

  const feld = (k: keyof Lieferant, label: string, platzhalter?: string, breit = false) => (
    <label className={breit ? "breit" : ""}>
      {label}
      <input value={(form?.[k] as string) ?? ""} placeholder={platzhalter} onChange={(e) => setForm({ ...form!, [k]: e.target.value })} />
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
      setFehler(String(e).includes("UNIQUE") ? "Diese Lieferantennummer ist schon vergeben." : String(e));
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

  const uidWarnung = form ? uidPruefen(form.uid, form.land) : null;

  return (
    <section>
      <div className="kopf">
        <div className="titel"><h1>Lieferanten</h1><span className="anzahl">{liste.length}</span></div>
        <div className="suchfeld"><Icon name="suche" size={16} /><input placeholder="Name, Ort, Nummer …" value={suche} onChange={(e) => setSuche(e.target.value)} /></div>
        <button className="primaer" onClick={neu}><Icon name="plus" size={16} /> Neuer Lieferant</button>
      </div>

      {form && (
        <Schublade
          titel={form.id ? form.name : "Neuer Lieferant"}
          untertitel={form.lieferantennummer || (vorschau ? `bekommt Nummer ${vorschau}` : undefined)}
          schliessen={() => { setForm(null); setFehler(null); }}
          fuss={<>
            <button className="primaer" onClick={speichern}>Speichern</button>
            <button onClick={() => { setForm(null); setFehler(null); }}>Abbrechen</button>
            {form.id && <button className="gefahr" onClick={() => loeschen(form)}>Löschen</button>}
          </>}
        >
          <h3>Adresse</h3>
          <div className="raster">
            {feld("name", "Name / Firma *", "", true)}
            {feld("lieferantennummer", "Lieferantennummer", vorschau || "wird automatisch vergeben")}
            {feld("unsere_kundennummer", "Unsere Kundennummer dort")}
            {feld("strasse", "Straße", "", true)}
            {feld("plz", "PLZ")}
            {feld("ort", "Ort")}
            <label className="breit">Land<LandAuswahl wert={form.land} aendern={(l) => setForm({ ...form, land: l })} /></label>
          </div>
          <h3>Kontakt</h3>
          <div className="raster">
            {feld("ansprechperson", "Ansprechperson")}
            {feld("telefon", "Telefon")}
            {feld("email", "E-Mail für Bestellungen", "", true)}
            {feld("uid", "UID-Nummer")}
          </div>
          {uidWarnung && <div className="hinweis-box">{uidWarnung}</div>}
          <h3>Notiz</h3>
          <textarea rows={3} value={form.notiz ?? ""} onChange={(e) => setForm({ ...form, notiz: e.target.value })} style={{ width: "100%" }} />
          {fehler && <div className="fehler">{fehler}</div>}
        </Schublade>
      )}

      {liste.length === 0 ? (
        <div className="leer">
          <Icon name="lieferanten" size={32} />
          <p>{suche ? "Keine passenden Lieferanten." : "Noch keine Lieferanten."}</p>
          {!suche && <button className="primaer" onClick={neu}>Ersten Lieferanten anlegen</button>}
        </div>
      ) : (
        <table>
          <thead><tr><th>Nr.</th><th>Name</th><th>Ort</th><th>Land</th><th>Unsere Kd.-Nr.</th><th>E-Mail</th><th>Telefon</th></tr></thead>
          <tbody>
            {liste.map((l) => (
              <tr key={l.id} onClick={() => { setFehler(null); setVorschau(""); setForm(l); }}>
                <td className="nummer">{l.lieferantennummer}</td>
                <td><strong>{l.name}</strong></td>
                <td>{[l.plz, l.ort].filter(Boolean).join(" ")}</td>
                <td>{landName(l.land)}</td>
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
