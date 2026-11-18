import { useEffect, useState } from "react";
import { deaktiviereKatalogPosition, Firma, KatalogPosition, ladeFirma, listeKatalog, speichereKatalogPosition } from "../db/repo";
import { centZuText, einheitspreis, euro, zuCent } from "../db/geld";
import Schublade from "../components/Schublade";
import Icon from "../components/Icon";

interface Formular {
  id?: number;
  nummer: string;
  gruppe: string;
  kurztext: string;
  langtext: string;
  einheit: string;
  lohn_minuten: string;
  material: string;
  sonstiges: string;
}

const leer: Formular = { nummer: "", gruppe: "", kurztext: "", langtext: "", einheit: "m2", lohn_minuten: "0", material: "0,00", sonstiges: "0,00" };
const einheiten = ["m2", "m", "Stk", "h", "pausch", "lfm", "m3", "kg"];

export default function Katalog() {
  const [liste, setListe] = useState<KatalogPosition[]>([]);
  const [firma, setFirma] = useState<Firma | null>(null);
  const [suche, setSuche] = useState("");
  const [form, setForm] = useState<Formular | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = () => listeKatalog(suche).then(setListe);
  useEffect(() => { laden(); }, [suche]);
  useEffect(() => { ladeFirma().then(setFirma); }, []);

  const preis = (lohnMin: number, materialCent: number, sonstigesCent: number) =>
    firma ? einheitspreis({ lohn_minuten: lohnMin, material_cent: materialCent, sonstiges_cent: sonstigesCent, ...firma }) : 0;

  function bearbeiten(p: KatalogPosition) {
    setForm({
      id: p.id, nummer: p.nummer ?? "", gruppe: p.gruppe ?? "", kurztext: p.kurztext, langtext: p.langtext ?? "",
      einheit: p.einheit, lohn_minuten: String(p.lohn_minuten), material: centZuText(p.material_cent), sonstiges: centZuText(p.sonstiges_cent),
    });
  }

  async function speichern() {
    if (!form?.kurztext.trim()) return setFehler("Bitte einen Kurztext eingeben.");
    try {
      await speichereKatalogPosition(
        {
          id: form.id, nummer: form.nummer || null, gruppe: form.gruppe || null, kurztext: form.kurztext,
          langtext: form.langtext || null, einheit: form.einheit,
          lohn_minuten: Number(form.lohn_minuten.replace(",", ".")) || 0, sonstiges_cent: zuCent(form.sonstiges),
        },
        zuCent(form.material),
      );
      setForm(null);
      setFehler(null);
      laden();
    } catch (e) {
      setFehler(String(e));
    }
  }

  const t = (k: keyof Formular, label: string, breit = false) => (
    <label className={breit ? "breit" : ""}>
      {label}
      <input value={form![k] ?? ""} onChange={(e) => setForm({ ...form!, [k]: e.target.value })} />
    </label>
  );

  return (
    <section>
      <div className="kopf">
        <div className="titel"><h1>Positionskatalog</h1><span className="anzahl">{liste.length}</span></div>
        <div className="suchfeld"><Icon name="suche" size={16} /><input placeholder="Nummer, Gruppe, Text …" value={suche} onChange={(e) => setSuche(e.target.value)} /></div>
        <button className="primaer" onClick={() => setForm({ ...leer })}><Icon name="plus" size={16} /> Neue Position</button>
      </div>

      <p className="seiten-info">Fertige Positionen mit Pauschalwerten. Für Wände, Decken und Böden mit Aufmaß nimm besser die Aufbauten.</p>
      {form && (
        <Schublade titel={form.id ? form.kurztext : "Neue Position"} untertitel={form.nummer || "Nummer wird automatisch vergeben"}
          schliessen={() => { setForm(null); setFehler(null); }}
          fuss={<>
            <button className="primaer" onClick={speichern}>Speichern</button>
            <button onClick={() => { setForm(null); setFehler(null); }}>Abbrechen</button>
            {form.id && <button className="gefahr" onClick={async () => { await deaktiviereKatalogPosition(form.id!); setForm(null); laden(); }}>Entfernen</button>}
          </>}>
          <div className="raster">
            {t("nummer", "Nummer")}
            {t("gruppe", "Gruppe (z. B. Trockenbau)")}
            {t("kurztext", "Kurztext *", true)}
            <label className="breit">
              Langtext
              <textarea rows={4} value={form.langtext} onChange={(e) => setForm({ ...form, langtext: e.target.value })} />
            </label>
            <label>
              Einheit
              <select value={form.einheit} onChange={(e) => setForm({ ...form, einheit: e.target.value })}>
                {einheiten.map((e) => <option key={e}>{e}</option>)}
              </select>
            </label>
            {t("lohn_minuten", "Lohn (Minuten je Einheit)")}
            {t("material", "Material € je Einheit (Einkauf)")}
            {t("sonstiges", "Sonstiges € (Gerät, Fremdleistung)")}
          </div>
          <p className="hinweis">
            Einheitspreis laut Kalkulation:{" "}
            <strong>{euro(preis(Number(form.lohn_minuten.replace(",", ".")) || 0, zuCent(form.material), zuCent(form.sonstiges)))}</strong>
            {firma && <> (Mittellohn {euro(firma.mittellohn_cent)}/h, Materialzuschlag {firma.materialzuschlag_prozent} %, Gesamtzuschlag {firma.gesamtzuschlag_prozent} %)</>}
          </p>
          {fehler && <div className="fehler">{fehler}</div>}
        </Schublade>
      )}

      {liste.length === 0 ? (
        <div className="leer"><Icon name="katalog" size={32} /><p>Noch keine Positionen.</p></div>
      ) : (
        <table>
          <thead><tr><th>Nr.</th><th>Gruppe</th><th>Kurztext</th><th>Einheit</th><th className="zahl">Lohn min</th><th className="zahl">Material</th><th className="zahl">Einheitspreis</th></tr></thead>
          <tbody>
            {liste.map((p) => (
              <tr key={p.id} onClick={() => bearbeiten(p)}>
                <td>{p.nummer}</td>
                <td>{p.gruppe}</td>
                <td>{p.kurztext}</td>
                <td>{p.einheit}</td>
                <td className="zahl">{p.lohn_minuten}</td>
                <td className="zahl">{euro(p.material_cent)}</td>
                <td className="zahl"><strong>{euro(preis(p.lohn_minuten, p.material_cent ?? 0, p.sonstiges_cent))}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
