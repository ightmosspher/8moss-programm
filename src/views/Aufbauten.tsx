import { useEffect, useState } from "react";
import { Aufbau, Bauteil, bauteile, deaktiviereAufbau, ladeAufbau, listeAufbauten, rechne, speichereAufbau } from "../db/aufbau";
import { Artikel, Firma, ladeFirma, listeArtikel, naechsteNummerVorschau } from "../db/repo";
import { einheitspreis, euro } from "../db/geld";
import Schublade from "../components/Schublade";
import SchichtenTabelle from "../components/SchichtenTabelle";
import Icon from "../components/Icon";

export default function Aufbauten() {
  const [liste, setListe] = useState<Aufbau[]>([]);
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [firma, setFirma] = useState<Firma | null>(null);
  const [filter, setFilter] = useState<Bauteil | "">("");
  const [form, setForm] = useState<Aufbau | null>(null);
  const [vorschau, setVorschau] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = () => listeAufbauten().then(setListe);
  useEffect(() => { laden(); ladeFirma().then(setFirma); }, []);
  useEffect(() => { if (form) listeArtikel().then(setArtikel); }, [!!form]);

  if (!firma) return null;
  const gezeigt = liste.filter((a) => !filter || a.bauteil === filter);
  const ep = (a: Aufbau) => einheitspreis({ lohn_minuten: a.lohn_minuten ?? 0, material_cent: a.material_cent ?? 0, sonstiges_cent: 0, ...firma });

  async function neu() {
    setFehler(null);
    setVorschau(await naechsteNummerVorschau("aufbau"));
    setForm({ bauteil: filter || "wand", bezeichnung: "", einheit: "m2", langtext: "", schichten: [] });
  }

  async function speichern() {
    if (!form?.bezeichnung.trim()) return setFehler("Bitte eine Bezeichnung eingeben.");
    if (form.schichten.some((s) => !s.bezeichnung.trim())) return setFehler("Jede Zeile braucht einen Artikel oder eine Bezeichnung.");
    try { await speichereAufbau(form); setForm(null); setFehler(null); laden(); } catch (e) { setFehler(String(e)); }
  }

  const r = form ? rechne({ aufmass: [], schichten: form.schichten, einheit: form.einheit }, firma) : null;
  const eh = form?.einheit.replace("m2", "m²");

  return (
    <section>
      <div className="kopf">
        <div className="titel"><h1>Aufbauten</h1><span className="anzahl">{liste.length}</span></div>
        <div className="reiter">
          <button className={filter === "" ? "aktiv" : ""} onClick={() => setFilter("")}>Alle</button>
          {bauteile.map((b) => <button key={b.wert} className={filter === b.wert ? "aktiv" : ""} onClick={() => setFilter(b.wert)}>{b.text}</button>)}
        </div>
        <button className="primaer" onClick={neu}><Icon name="plus" size={16} /> Neuer Aufbau</button>
      </div>
      <p className="seiten-info">
        Ein Aufbau ist das Rezept für ein Bauteil: welches Material in welcher Menge je m² und wie viel Arbeitszeit.
        Im Angebot rechnest du damit über „Bauteil kalkulieren“ mit dem Aufmaß den Preis aus.
      </p>

      {form && r && (
        <Schublade breit titel={form.id ? form.bezeichnung : "Neuer Aufbau"}
          untertitel={form.nummer || (vorschau ? `bekommt Nummer ${vorschau}` : undefined)}
          schliessen={() => { setForm(null); setFehler(null); }}
          fuss={<>
            <button className="primaer" onClick={speichern}>Speichern</button>
            <button onClick={() => { setForm(null); setFehler(null); }}>Abbrechen</button>
            {form.id && <button className="gefahr" onClick={async () => { await deaktiviereAufbau(form.id!); setForm(null); laden(); }}>Entfernen</button>}
          </>}>
          <div className="raster">
            <label className="breit">Bezeichnung (Kurztext im Angebot) *
              <input value={form.bezeichnung} placeholder="z. B. Ständerwand CW 100, doppelt beplankt" onChange={(e) => setForm({ ...form, bezeichnung: e.target.value })} />
            </label>
            <label>Bauteil
              <select value={form.bauteil} onChange={(e) => setForm({ ...form, bauteil: e.target.value as Bauteil })}>
                {bauteile.map((b) => <option key={b.wert} value={b.wert}>{b.text}</option>)}
              </select>
            </label>
            <label>Einheit
              <select value={form.einheit} onChange={(e) => setForm({ ...form, einheit: e.target.value })}>
                <option value="m2">m²</option><option value="lfm">lfm</option><option value="Stk">Stk</option>
              </select>
            </label>
            <label>Nummer<input value={form.nummer ?? ""} placeholder={vorschau || "automatisch"} onChange={(e) => setForm({ ...form, nummer: e.target.value })} /></label>
            <label className="breit">Langtext im Angebot
              <textarea rows={4} value={form.langtext ?? ""} placeholder="Leer lassen, dann werden die Materialien aufgezählt." onChange={(e) => setForm({ ...form, langtext: e.target.value })} />
            </label>
          </div>
          <h3>Material und Arbeitszeit je {eh}</h3>
          <SchichtenTabelle schichten={form.schichten} setSchichten={(s) => setForm({ ...form, schichten: s })} artikel={artikel} einheit={form.einheit} />
          <div className="kennzahlen">
            <div><span>Material je {eh}</span><strong>{euro(r.materialCent)}</strong></div>
            <div><span>Arbeitszeit je {eh}</span><strong>{r.lohnMin} min</strong></div>
            <div><span>Lohn je {eh}</span><strong>{euro(r.lohnCent)}</strong></div>
            <div className="hervor"><span>Einheitspreis</span><strong>{euro(r.ep)}</strong></div>
          </div>
          <p className="hinweis">
            Mittellohn {euro(firma.mittellohn_cent)}/h, Materialzuschlag {firma.materialzuschlag_prozent} %, Gesamtzuschlag {firma.gesamtzuschlag_prozent} % (änderbar unter Einstellungen).
          </p>
          {r.preisFehlt > 0 && <div className="hinweis-box"><Icon name="warnung" size={16} /> Bei {r.preisFehlt} Material fehlt der Einkaufspreis. Trage ihn unter Artikel ein.</div>}
          {fehler && <div className="fehler">{fehler}</div>}
        </Schublade>
      )}

      {gezeigt.length === 0 ? (
        <div className="leer"><Icon name="aufbauten" size={32} /><p>Noch keine Aufbauten.</p><button className="primaer" onClick={neu}>Ersten Aufbau anlegen</button></div>
      ) : (
        <div className="karten">
          {gezeigt.map((a) => (
            <button key={a.id} className="karte" onClick={async () => { setFehler(null); setVorschau(""); setForm(await ladeAufbau(a.id!)); }}>
              <div className="karte-kopf">
                <span className={`bauteil bauteil-${a.bauteil}`}>{bauteile.find((b) => b.wert === a.bauteil)?.text}</span>
                <span className="nummer">{a.nummer}</span>
              </div>
              <div className="karte-titel">{a.bezeichnung}</div>
              <div className="karte-werte">
                <span>{Math.round(a.lohn_minuten ?? 0)} min</span>
                <span>Material {euro(Math.round(a.material_cent ?? 0))}</span>
                <strong>{euro(ep(a))} / {a.einheit.replace("m2", "m²")}</strong>
              </div>
              {!!a.preis_fehlt && <div className="status status-warn">{a.preis_fehlt} Preise fehlen</div>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
