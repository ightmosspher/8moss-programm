import { useEffect, useState } from "react";
import { Kunde, listeKunden, loescheKunde, naechsteNummerVorschau, speichereKunde } from "../db/repo";
import Schublade from "../components/Schublade";
import LandAuswahl from "../components/LandAuswahl";
import Icon from "../components/Icon";
import { istEu, landName } from "../lib/laender";
import { steuerfaelle, steuerfallVorschlag, uidPruefen } from "../lib/steuer";

const leer: Kunde = { name: "", reverse_charge: 0, land: "AT" };

export default function Kunden() {
  const [liste, setListe] = useState<Kunde[]>([]);
  const [suche, setSuche] = useState("");
  const [form, setForm] = useState<Kunde | null>(null);
  const [vorschau, setVorschau] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = () => listeKunden(suche).then(setListe);
  useEffect(() => { laden(); }, [suche]);

  async function neu() {
    setFehler(null);
    setVorschau(await naechsteNummerVorschau("kunde"));
    setForm({ ...leer });
  }

  const feld = (k: keyof Kunde, label: string, platzhalter?: string, breit = false) => (
    <label className={breit ? "breit" : ""}>
      {label}
      <input value={(form?.[k] as string) ?? ""} placeholder={platzhalter} onChange={(e) => setForm({ ...form!, [k]: e.target.value })} />
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
      setFehler(String(e).includes("UNIQUE") ? "Diese Kundennummer ist schon vergeben." : String(e));
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

  const land = form?.land || "AT";
  const uidWarnung = form ? uidPruefen(form.uid, land) : null;
  const vorschlag = form ? steuerfaelle.find((s) => s.wert === steuerfallVorschlag(form)) : null;

  return (
    <section>
      <div className="kopf">
        <div className="titel"><h1>Kunden</h1><span className="anzahl">{liste.length}</span></div>
        <div className="suchfeld"><Icon name="suche" size={16} /><input placeholder="Name, Ort, Nummer …" value={suche} onChange={(e) => setSuche(e.target.value)} /></div>
        <button className="primaer" onClick={neu}><Icon name="plus" size={16} /> Neuer Kunde</button>
      </div>

      {form && (
        <Schublade
          titel={form.id ? form.name : "Neuer Kunde"}
          untertitel={form.kundennummer || (vorschau ? `bekommt Nummer ${vorschau}` : undefined)}
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
            {feld("ansprechperson", "Ansprechperson")}
            {feld("kundennummer", "Kundennummer", vorschau || "wird automatisch vergeben")}
            {feld("strasse", "Straße", "", true)}
            {feld("plz", "PLZ")}
            {feld("ort", "Ort")}
            <label className="breit">Land<LandAuswahl wert={form.land} aendern={(l) => setForm({ ...form, land: l })} /></label>
          </div>
          <h3>Kontakt</h3>
          <div className="raster">
            {feld("email", "E-Mail")}
            {feld("telefon", "Telefon")}
            {feld("anrede", "Anrede im Brief", "z. B. Sehr geehrter Herr Muster,", true)}
          </div>
          <h3>Steuer</h3>
          <div className="raster">
            {feld("uid", "UID-Nummer", land === "AT" ? "ATU12345678" : `${land === "GR" ? "EL" : land}…`)}
            {feld("firmenbuch", "Firmenbuchnummer")}
          </div>
          {uidWarnung && <div className="hinweis-box">{uidWarnung}</div>}
          {land === "AT" && (
            <label className="haken">
              <input type="checkbox" checked={!!form.reverse_charge}
                onChange={(e) => setForm({ ...form, reverse_charge: e.target.checked ? 1 : 0 })} />
              Bauunternehmer: Reverse Charge bei Bauleistungen (§ 19 Abs. 1a UStG)
            </label>
          )}
          <div className="info-box">
            <strong>Vorschlag für Angebote und Rechnungen:</strong> {vorschlag?.text}
            {land !== "AT" && (
              <p>
                {istEu(land) ? (form.uid ? "EU-Firmenkunde mit UID." : "EU-Kunde ohne UID (Privatperson): österreichische USt.") : "Kunde außerhalb der EU."}{" "}
                Liegt die Baustelle in Österreich, gilt trotzdem österreichische USt. Im Angebot kannst du den Steuerfall je Beleg ändern.
              </p>
            )}
          </div>
          <h3>Notiz</h3>
          <textarea rows={3} value={form.notiz ?? ""} onChange={(e) => setForm({ ...form, notiz: e.target.value })} style={{ width: "100%" }} />
          {fehler && <div className="fehler">{fehler}</div>}
        </Schublade>
      )}

      {liste.length === 0 ? (
        <div className="leer">
          <Icon name="kunden" size={32} />
          <p>{suche ? "Keine passenden Kunden." : "Noch keine Kunden."}</p>
          {!suche && <button className="primaer" onClick={neu}>Ersten Kunden anlegen</button>}
        </div>
      ) : (
        <table>
          <thead><tr><th>Nr.</th><th>Name</th><th>Ansprechperson</th><th>Ort</th><th>Land</th><th>UID</th><th>Steuer</th></tr></thead>
          <tbody>
            {liste.map((k) => (
              <tr key={k.id} onClick={() => { setFehler(null); setVorschau(""); setForm(k); }}>
                <td className="nummer">{k.kundennummer}</td>
                <td><strong>{k.name}</strong></td>
                <td>{k.ansprechperson}</td>
                <td>{[k.plz, k.ort].filter(Boolean).join(" ")}</td>
                <td>{landName(k.land)}</td>
                <td>{k.uid}</td>
                <td>{(() => { const f = steuerfallVorschlag(k); return f === "inland" ? "" : <span className="status status-angebot">{f === "rc_bau" ? "Reverse Charge" : f === "eu_rc" ? "EU" : "Drittland"}</span>; })()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
