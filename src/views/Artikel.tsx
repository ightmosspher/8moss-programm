import { useEffect, useState } from "react";
import { Artikel, deaktiviereArtikel, Lieferant, listeArtikel, listeLieferanten, naechsteNummerVorschau, speichereArtikel } from "../db/repo";
import { centZuText, euro, zuCent } from "../db/geld";
import { heute } from "../db/belege";
import Schublade from "../components/Schublade";
import Icon from "../components/Icon";

export const einheitenMaterial = ["Stk", "m2", "lfm", "m", "kg", "l", "m3", "Pkg", "Rolle", "Sack", "Tafel"];
type Form = Artikel & { preisText: string };

export default function ArtikelSeite() {
  const [liste, setListe] = useState<Artikel[]>([]);
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [suche, setSuche] = useState("");
  const [gruppe, setGruppe] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [vorschau, setVorschau] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = () => listeArtikel(suche).then(setListe);
  useEffect(() => { laden(); }, [suche]);
  useEffect(() => { listeLieferanten().then(setLieferanten); }, []);

  const gruppen = [...new Set(liste.map((a) => a.gruppe).filter(Boolean))] as string[];
  const gezeigt = liste.filter((a) => !gruppe || a.gruppe === gruppe);
  const ohnePreis = liste.filter((a) => !a.einkaufspreis_cent).length;

  async function neu() {
    setFehler(null);
    setVorschau(await naechsteNummerVorschau("artikel"));
    setForm({ bezeichnung: "", einheit: "Stk", einkaufspreis_cent: 0, preisText: "", gruppe: gruppe || null });
  }

  const feld = (k: keyof Form, label: string, platzhalter?: string, breit = false) => (
    <label className={breit ? "breit" : ""}>
      {label}
      <input value={(form?.[k] as string) ?? ""} placeholder={platzhalter} onChange={(e) => setForm({ ...form!, [k]: e.target.value })} />
    </label>
  );

  async function speichern() {
    if (!form?.bezeichnung.trim()) return setFehler("Bitte eine Bezeichnung eingeben.");
    const preis = zuCent(form.preisText);
    try {
      await speichereArtikel({
        ...form,
        einkaufspreis_cent: preis,
        preis_stand: preis !== form.einkaufspreis_cent ? heute() : form.preis_stand,
      });
      setForm(null); setFehler(null); laden();
    } catch (e) {
      setFehler(String(e).includes("UNIQUE") ? "Diese Artikelnummer ist schon vergeben." : String(e));
    }
  }

  return (
    <section>
      <div className="kopf">
        <div className="titel"><h1>Artikel</h1><span className="anzahl">{liste.length}</span></div>
        <select value={gruppe} onChange={(e) => setGruppe(e.target.value)}>
          <option value="">Alle Gruppen</option>
          {gruppen.map((g) => <option key={g}>{g}</option>)}
        </select>
        <div className="suchfeld"><Icon name="suche" size={16} /><input placeholder="Bezeichnung, Nummer, Lieferant …" value={suche} onChange={(e) => setSuche(e.target.value)} /></div>
        <button className="primaer" onClick={neu}><Icon name="plus" size={16} /> Neuer Artikel</button>
      </div>
      <p className="seiten-info">
        Material mit Einkaufspreis. Die Aufbauten der Kalkulation (Wand, Decke, Boden) rechnen mit diesen Preisen.
        {ohnePreis > 0 && <> <span className="status status-warn">{ohnePreis} ohne Preis</span></>}
      </p>

      {form && (
        <Schublade
          titel={form.id ? form.bezeichnung : "Neuer Artikel"}
          untertitel={form.nummer || (vorschau ? `bekommt Nummer ${vorschau}` : undefined)}
          schliessen={() => { setForm(null); setFehler(null); }}
          fuss={<>
            <button className="primaer" onClick={speichern}>Speichern</button>
            <button onClick={() => { setForm(null); setFehler(null); }}>Abbrechen</button>
            {form.id && <button className="gefahr" onClick={async () => { await deaktiviereArtikel(form.id!); setForm(null); laden(); }}>Entfernen</button>}
          </>}
        >
          <div className="raster">
            {feld("bezeichnung", "Bezeichnung *", "z. B. Gipskartonplatte GKB 12,5 mm", true)}
            {feld("nummer", "Artikelnummer", vorschau || "wird automatisch vergeben")}
            <label>
              Gruppe
              <input list="artikelgruppen" value={form.gruppe ?? ""} onChange={(e) => setForm({ ...form, gruppe: e.target.value })} />
              <datalist id="artikelgruppen">{gruppen.map((g) => <option key={g} value={g} />)}</datalist>
            </label>
            <label>
              Einheit
              <select value={form.einheit} onChange={(e) => setForm({ ...form, einheit: e.target.value })}>
                {[...new Set([form.einheit, ...einheitenMaterial])].map((e) => <option key={e}>{e}</option>)}
              </select>
            </label>
            <label>
              Einkaufspreis € je {form.einheit}
              <input value={form.preisText} placeholder="0,00" onChange={(e) => setForm({ ...form, preisText: e.target.value })} />
            </label>
          </div>
          <h3>Bezug</h3>
          <div className="raster">
            <label className="breit">
              Lieferant
              <select value={form.lieferant_id ?? ""} onChange={(e) => setForm({ ...form, lieferant_id: Number(e.target.value) || null })}>
                <option value="">–</option>
                {lieferanten.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            {feld("lieferanten_artikelnummer", "Artikelnummer beim Lieferanten")}
            {feld("hersteller", "Hersteller")}
          </div>
          {form.preis_stand && <p className="hinweis">Preis zuletzt geändert am {form.preis_stand.split("-").reverse().join(".")}</p>}
          <h3>Notiz</h3>
          <textarea rows={3} value={form.notiz ?? ""} onChange={(e) => setForm({ ...form, notiz: e.target.value })} style={{ width: "100%" }} />
          {fehler && <div className="fehler">{fehler}</div>}
        </Schublade>
      )}

      {gezeigt.length === 0 ? (
        <div className="leer"><Icon name="artikel" size={32} /><p>{suche ? "Keine passenden Artikel." : "Noch keine Artikel."}</p></div>
      ) : (
        <table>
          <thead><tr><th>Nr.</th><th>Bezeichnung</th><th>Gruppe</th><th>Einheit</th><th>Lieferant</th><th className="zahl">Einkaufspreis</th></tr></thead>
          <tbody>
            {gezeigt.map((a) => (
              <tr key={a.id} onClick={() => { setFehler(null); setVorschau(""); setForm({ ...a, preisText: a.einkaufspreis_cent ? centZuText(a.einkaufspreis_cent) : "" }); }}>
                <td className="nummer">{a.nummer}</td>
                <td><strong>{a.bezeichnung}</strong></td>
                <td>{a.gruppe}</td>
                <td>{a.einheit}</td>
                <td>{a.lieferant_name}</td>
                <td className="zahl">{a.einkaufspreis_cent ? euro(a.einkaufspreis_cent) : <span className="status status-warn">Preis fehlt</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
