import { useEffect, useState } from "react";
import Schublade from "../components/Schublade";
import Icon from "../components/Icon";
import { Beleg, listeBelegeZuProjekt } from "../db/belege";
import { euro } from "../db/geld";
import { Kunde, listeKunden, listeProjekte, loescheProjekt, naechsteProjektnummer, Projekt, projektStatus, speichereProjekt } from "../db/repo";

const statusText = (s: string) => projektStatus.find((x) => x.wert === s)?.text ?? s;

export default function Projekte({ zuKunden }: { zuKunden: () => void }) {
  const [liste, setListe] = useState<Projekt[]>([]);
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<Projekt | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [belege, setBelege] = useState<Beleg[]>([]);
  useEffect(() => { if (form?.id) listeBelegeZuProjekt(form.id).then(setBelege); else setBelege([]); }, [form?.id]);

  const laden = () => listeProjekte(suche, filter).then(setListe);
  useEffect(() => { laden(); }, [suche, filter]);
  useEffect(() => { listeKunden().then(setKunden); }, []);

  async function neu() {
    setFehler(null);
    const nummer = await naechsteProjektnummer();
    setForm({ nummer, kunde_id: kunden[0]?.id ?? 0, bezeichnung: "", baustelle: "", status: "anfrage", quelle: "direkt" });
  }

  async function speichern() {
    if (!form) return;
    if (!form.bezeichnung.trim()) return setFehler("Bitte eine Bezeichnung eingeben.");
    if (!form.kunde_id) return setFehler("Bitte einen Kunden wählen.");
    try {
      await speichereProjekt(form);
      setForm(null);
      setFehler(null);
      laden();
    } catch (e) {
      setFehler(String(e).includes("UNIQUE") ? "Diese Projektnummer ist schon vergeben." : String(e));
    }
  }

  async function loeschen(p: Projekt) {
    try {
      await loescheProjekt(p.id!);
      setForm(null);
      laden();
    } catch {
      setFehler("Projekt hat bereits Belege und kann nicht gelöscht werden.");
    }
  }

  return (
    <section>
      <div className="kopf">
        <div className="titel"><h1>Projekte</h1><span className="anzahl">{liste.length}</span></div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Alle Status</option>
          {projektStatus.map((s) => <option key={s.wert} value={s.wert}>{s.text}</option>)}
        </select>
        <div className="suchfeld"><Icon name="suche" size={16} /><input placeholder="Nummer, Bezeichnung, Kunde …" value={suche} onChange={(e) => setSuche(e.target.value)} /></div>
        <button className="primaer" onClick={neu}><Icon name="plus" size={16} /> Neues Projekt</button>
      </div>

      {form && kunden.length === 0 && (
        <Schublade titel="Neues Projekt" schliessen={() => setForm(null)}
          fuss={<><button className="primaer" onClick={zuKunden}>Zu den Kunden</button><button onClick={() => setForm(null)}>Abbrechen</button></>}>
          <p>Für ein Projekt brauchst du zuerst einen Kunden.</p>
        </Schublade>
      )}

      {form && kunden.length > 0 && (
        <Schublade titel={form.id ? `${form.nummer}  ${form.bezeichnung}` : "Neues Projekt"} untertitel={form.id ? form.kunde_name : undefined}
          schliessen={() => { setForm(null); setFehler(null); }}
          fuss={<>
            <button className="primaer" onClick={speichern}>Speichern</button>
            <button onClick={() => { setForm(null); setFehler(null); }}>Abbrechen</button>
            {form.id && <button className="gefahr" onClick={() => loeschen(form)}>Löschen</button>}
          </>}>
          <div className="raster">
            <label>
              Projektnummer
              <input value={form.nummer ?? ""} onChange={(e) => setForm({ ...form, nummer: Number(e.target.value.replace(/\D/g, "")) || null })} />
            </label>
            <label className="breit">
              Bezeichnung *
              <input value={form.bezeichnung} placeholder="z. B. Büroausbau 3. OG"
                onChange={(e) => setForm({ ...form, bezeichnung: e.target.value })} />
            </label>
            <label>
              Kunde *
              <select value={form.kunde_id} onChange={(e) => setForm({ ...form, kunde_id: Number(e.target.value) })}>
                {kunden.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </label>
            <label>
              Baustelle
              <input value={form.baustelle ?? ""} placeholder="Adresse der Baustelle"
                onChange={(e) => setForm({ ...form, baustelle: e.target.value })} />
            </label>
            <label>
              Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {projektStatus.map((s) => <option key={s.wert} value={s.wert}>{s.text}</option>)}
              </select>
            </label>
            <label>
              Herkunft
              <select value={form.quelle} onChange={(e) => setForm({ ...form, quelle: e.target.value })}>
                <option value="direkt">Direkte Anfrage</option>
                <option value="onlv">Ausschreibung (ONLV)</option>
              </select>
            </label>
          </div>
          {fehler && <div className="fehler">{fehler}</div>}
          {form.id && (
            <>
              <h3>Belege in diesem Projekt</h3>
              {belege.length === 0 ? <p className="hinweis">Noch keine Belege. Angebote legst du unter Angebote an.</p> : (
                <table className="klein">
                  <tbody>
                    {belege.map((b) => (
                      <tr key={b.id} className="keinklick">
                        <td>{({ angebot: "Angebot", auftrag: "Auftrag", bestellung: "Bestellung", rechnung: "Rechnung", gutschrift: "Gutschrift" })[b.art]}</td>
                        <td className="nummer">{b.belegnummer ?? "Entwurf"}</td>
                        <td>{b.datum.split("-").reverse().join(".")}</td>
                        <td className="zahl">{euro(b.netto_cent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </Schublade>
      )}

      {liste.length === 0 ? (
        <div className="leer"><Icon name="projekte" size={32} /><p>{suche || filter ? "Keine passenden Projekte." : "Noch keine Projekte."}</p>{!suche && !filter && <button className="primaer" onClick={neu}>Erstes Projekt anlegen</button>}</div>
      ) : (
        <table>
          <thead><tr><th>Nr.</th><th>Bezeichnung</th><th>Kunde</th><th>Baustelle</th><th>Herkunft</th><th>Status</th><th>Angelegt</th></tr></thead>
          <tbody>
            {liste.map((p) => (
              <tr key={p.id} onClick={() => { setFehler(null); setForm(p); }}>
                <td className="nummer">{p.nummer}</td>
                <td><strong>{p.bezeichnung}</strong></td>
                <td>{p.kunde_name}</td>
                <td>{p.baustelle}</td>
                <td>{p.quelle === "onlv" ? "Ausschreibung" : "Direkt"}</td>
                <td><span className={`status status-${p.status}`}>{statusText(p.status)}</span></td>
                <td>{p.erstellt_am ? new Date(p.erstellt_am.replace(" ", "T") + "Z").toLocaleDateString("de-AT") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
