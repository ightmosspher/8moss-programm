import { useEffect, useMemo, useState } from "react";
import {
  angebotTexte, Beleg, BelegPosition, heute, kopiereBeleg, ladeBeleg, loescheEntwurf, positionGesamt,
  schliesseAb, speichereEntwurf, summen,
} from "../db/belege";
import { centZuText, einheitspreis, euro, zuCent } from "../db/geld";
import { Firma, KatalogPosition, Kunde, ladeFirma, listeKatalog, listeKunden, listeProjekte, Projekt } from "../db/repo";
import { pdfSpeichern } from "../pdf/erzeugen";
import { Kalkulation } from "../db/aufbau";
import Kalkulator from "../components/Kalkulator";
import Icon from "../components/Icon";
import { landName } from "../lib/laender";
import { ohneUst, Steuerfall, steuerfaelle, steuerfallVon, steuerfallVorschlag } from "../lib/steuer";

interface Props { id?: number; schliessen: () => void; oeffne: (id: number) => void }

// Im Editor werden Preise und Mengen als Text gehalten, damit man frei tippen kann (Komma!).
type EditPos = BelegPosition & { mengeText: string; preisText: string; offen?: boolean };
const zuEdit = (p: BelegPosition): EditPos => ({
  ...p, mengeText: String(p.menge).replace(".", ","), preisText: centZuText(p.einheitspreis_cent),
});
const zahl = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;

export default function AngebotEditor({ id, schliessen, oeffne }: Props) {
  const [firma, setFirma] = useState<Firma | null>(null);
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [projekte, setProjekte] = useState<Projekt[]>([]);
  const [katalog, setKatalog] = useState<KatalogPosition[]>([]);
  const [beleg, setBeleg] = useState<Beleg | null>(null);
  const [pos, setPos] = useState<EditPos[]>([]);
  const [katalogWahl, setKatalogWahl] = useState("");
  const [meldung, setMeldung] = useState<{ art: "ok" | "fehler"; text: string } | null>(null);
  const [geaendert, setGeaendert] = useState(false);
  const [kalk, setKalk] = useState<{ index: number | null; start: Kalkulation | null } | null>(null);

  useEffect(() => {
    (async () => {
      const [f, k, p, kat] = await Promise.all([ladeFirma(), listeKunden(), listeProjekte(), listeKatalog()]);
      setFirma(f); setKunden(k); setProjekte(p); setKatalog(kat);
      if (id) {
        const d = await ladeBeleg(id);
        setBeleg(d.beleg); setPos(d.positionen.map(zuEdit));
      } else {
        const projekt = p.find((x) => x.status === "anfrage") ?? p[0];
        const kunde = k.find((x) => x.id === projekt?.kunde_id);
        setBeleg({
          art: "angebot", datum: heute(), status: "entwurf", ust_prozent: 20,
          projekt_id: projekt?.id ?? null, kunde_id: projekt?.kunde_id ?? null,
          reverse_charge: kunde?.reverse_charge ?? 0, steuerfall: steuerfallVorschlag(kunde), anrede: kunde?.anrede || "Sehr geehrte Damen und Herren,",
          zahlungsziel_tage: f.zahlungsziel_tage,
          ...angebotTexte(f, projekt),
        });
      }
    })();
  }, [id]);

  const gesperrt = beleg?.status !== "entwurf";
  const kunde = kunden.find((k) => k.id === beleg?.kunde_id);
  const positionen: BelegPosition[] = useMemo(
    () => pos.map((p) => ({ ...p, menge: zahl(p.mengeText), einheitspreis_cent: zuCent(p.preisText) })),
    [pos],
  );
  const fall: Steuerfall = beleg ? steuerfallVon(beleg) : "inland";
  const sum = summen(positionen, beleg?.ust_prozent ?? 20, ohneUst(fall));

  if (!beleg || !firma) return <p>Lade …</p>;

  const setB = (teil: Partial<Beleg>) => { setBeleg({ ...beleg, ...teil }); setGeaendert(true); };
  const setP = (i: number, teil: Partial<EditPos>) => { setPos(pos.map((p, j) => (j === i ? { ...p, ...teil } : p))); setGeaendert(true); };

  function projektWaehlen(pid: number) {
    const p = projekte.find((x) => x.id === pid);
    const k = kunden.find((x) => x.id === p?.kunde_id);
    setB({ projekt_id: pid, kunde_id: p?.kunde_id, reverse_charge: k?.reverse_charge ?? 0, steuerfall: steuerfallVorschlag(k),
      anrede: k?.anrede || beleg!.anrede, ...angebotTexte(firma!, p) });
  }

  function ausKatalog() {
    const k = katalog.find((x) => String(x.id) === katalogWahl);
    if (!k) return;
    const ep = einheitspreis({ lohn_minuten: k.lohn_minuten, material_cent: k.material_cent ?? 0, sonstiges_cent: k.sonstiges_cent, ...firma! });
    setPos([...pos, zuEdit({ kurztext: k.kurztext, langtext: k.langtext, einheit: k.einheit, menge: 1, einheitspreis_cent: ep, katalog_position_id: k.id })]);
    setKatalogWahl(""); setGeaendert(true);
  }
  function kalkulationUebernehmen(p: BelegPosition) {
    if (kalk?.index != null) setPos(pos.map((x, j) => (j === kalk.index ? { ...zuEdit(p), offen: x.offen } : x)));
    else setPos([...pos, zuEdit(p)]);
    setKalk(null); setGeaendert(true);
  }
  const freiePosition = () => { setPos([...pos, { ...zuEdit({ kurztext: "", einheit: "pausch", menge: 1, einheitspreis_cent: 0 }), offen: true }]); setGeaendert(true); };
  const verschiebe = (i: number, d: number) => {
    const n = [...pos]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); setPos(n); setGeaendert(true);
  };

  async function speichern(): Promise<number | null> {
    if (!beleg!.projekt_id) { setMeldung({ art: "fehler", text: "Bitte ein Projekt wählen." }); return null; }
    if (positionen.some((p) => !p.kurztext.trim())) { setMeldung({ art: "fehler", text: "Jede Position braucht einen Kurztext." }); return null; }
    try {
      const neueId = await speichereEntwurf(beleg!, positionen);
      setBeleg({ ...beleg!, id: neueId }); setGeaendert(false);
      setMeldung({ art: "ok", text: "Gespeichert." });
      return neueId;
    } catch (e) { setMeldung({ art: "fehler", text: String(e) }); return null; }
  }

  async function abschliessen() {
    if (positionen.length === 0) return setMeldung({ art: "fehler", text: "Das Angebot hat noch keine Positionen." });
    const bid = await speichern(); if (!bid) return;
    try {
      const nummer = await schliesseAb(bid, kunde);
      const d = await ladeBeleg(bid); setBeleg(d.beleg); setPos(d.positionen.map(zuEdit));
      setMeldung({ art: "ok", text: `Angebot ${nummer} abgeschlossen. Es kann jetzt nicht mehr geändert werden.` });
    } catch (e) { setMeldung({ art: "fehler", text: String(e) }); }
  }

  async function pdf() {
    try {
      const empf = beleg!.adresse_snapshot ? (JSON.parse(beleg!.adresse_snapshot) as Kunde) : kunde;
      const name = `${beleg!.belegnummer ? `Angebot_${beleg!.belegnummer}` : "Angebot-Entwurf"}_${(empf?.name ?? "").replace(/[^\wäöüÄÖÜß-]+/g, "_")}.pdf`;
      const pfad = await pdfSpeichern({ beleg: beleg!, positionen, firma: firma!, empfaenger: empf }, name);
      if (pfad) setMeldung({ art: "ok", text: `PDF gespeichert: ${pfad}` });
    } catch (e) { setMeldung({ art: "fehler", text: `PDF konnte nicht erstellt werden: ${e}` }); }
  }

  return (
    <section>
      <div className="kopf">
        <button onClick={schliessen}><Icon name="zurueck" size={16} /> Angebote</button>
        <h1>{beleg.belegnummer ? `Angebot ${beleg.belegnummer}` : "Angebot (Entwurf)"}</h1>
        {!gesperrt && <button onClick={speichern} disabled={!geaendert && !!beleg.id}>Speichern</button>}
        <button onClick={pdf}><Icon name="pdf" size={16} /> PDF</button>
        {!gesperrt && <button className="primaer" onClick={abschliessen}><Icon name="schloss" size={16} /> Abschließen</button>}
        {gesperrt && <button className="primaer" onClick={async () => oeffne(await kopiereBeleg(beleg.id!))}><Icon name="kopie" size={16} /> Als neue Version kopieren</button>}
      </div>

      {meldung && <div className={meldung.art === "fehler" ? "fehler" : "erfolg"}>{meldung.text}</div>}
      {firma.name === "8moss" && !firma.strasse && (
        <div className="hinweis-box">Tipp: Trage unter Einstellungen deine Firmendaten ein, damit sie im PDF stehen.</div>
      )}

      <div className="formular">
        <div className="raster">
          <label>
            Projekt *
            <select disabled={gesperrt} value={beleg.projekt_id ?? ""} onChange={(e) => projektWaehlen(Number(e.target.value))}>
              <option value="" disabled>Bitte wählen</option>
              {projekte.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung} ({p.kunde_name})</option>)}
            </select>
          </label>
          <label>Kunde<input disabled value={kunde?.name ?? ""} /></label>
          <label>Datum<input type="date" disabled={gesperrt} value={beleg.datum} onChange={(e) => setB({ datum: e.target.value })} /></label>
          <label>Zahlungsziel (Tage)<input disabled={gesperrt} value={beleg.zahlungsziel_tage ?? ""} onChange={(e) => setB({ zahlungsziel_tage: Number(e.target.value) || 0 })} /></label>
          <label className="breit">Anrede<input disabled={gesperrt} value={beleg.anrede ?? ""} onChange={(e) => setB({ anrede: e.target.value })} /></label>
          <label className="breit">Einleitung<textarea rows={2} disabled={gesperrt} value={beleg.vortext ?? ""} onChange={(e) => setB({ vortext: e.target.value })} /></label>
        </div>
        <div className="raster">
          <label>
            Steuer
            <select disabled={gesperrt} value={fall} onChange={(e) => setB({ steuerfall: e.target.value as Steuerfall, reverse_charge: e.target.value === "rc_bau" ? 1 : 0 })}>
              {steuerfaelle.map((x) => <option key={x.wert} value={x.wert}>{x.text}</option>)}
            </select>
          </label>
          {kunde && (
            <label>Kunde sitzt in<input disabled value={`${landName(kunde.land)}${kunde.uid ? `, UID ${kunde.uid}` : ", ohne UID"}`} /></label>
          )}
        </div>
        {!gesperrt && kunde && kunde.land && kunde.land !== "AT" && (
          <div className="info-box">
            Ausländischer Kunde: Liegt die Baustelle in Österreich, gilt österreichische USt (Inland bzw. Reverse Charge bei Bauunternehmern).
            Ohne USt nur bei Leistung im Ausland oder Lieferung ins Ausland. Im Zweifel mit der Steuerberatung abklären.
          </div>
        )}
        {!gesperrt && fall !== steuerfallVorschlag(kunde) && (
          <div className="hinweis-box">Laut Kundendaten wäre „{steuerfaelle.find((x) => x.wert === steuerfallVorschlag(kunde))?.text}“ üblich.</div>
        )}
      </div>

      <table className="positionen">
        <thead>
          <tr><th>Pos.</th><th className="zahl">Menge</th><th>Einheit</th><th>Leistung</th><th className="zahl">EP</th><th className="zahl">Gesamt</th>{!gesperrt && <th></th>}</tr>
        </thead>
        <tbody>
          {pos.map((p, i) => (
            <tr key={i} className="keinklick">
              <td>{`${i + 1}.0`}</td>
              <td className="zahl"><input className="schmal zahl" disabled={gesperrt} value={p.mengeText} onChange={(e) => setP(i, { mengeText: e.target.value })} /></td>
              <td><input className="sehrschmal" disabled={gesperrt} value={p.einheit ?? ""} onChange={(e) => setP(i, { einheit: e.target.value })} /></td>
              <td className="leistung">
                <input disabled={gesperrt} placeholder="Kurztext" value={p.kurztext} onChange={(e) => setP(i, { kurztext: e.target.value })} />
                {p.kalkulation && !gesperrt && (
                  <button className="link" onClick={() => setKalk({ index: i, start: JSON.parse(p.kalkulation!) })}>
                    <Icon name="rechner" size={13} /> Kalkulation öffnen
                  </button>
                )}
                {(p.offen || gesperrt) ? (
                  <textarea rows={Math.max(3, (p.langtext ?? "").split("\n").length + 1)} disabled={gesperrt} placeholder="Langtext" value={p.langtext ?? ""} onChange={(e) => setP(i, { langtext: e.target.value })} />
                ) : (
                  <button className="link" onClick={() => setP(i, { offen: true })}>{p.langtext ? "Langtext bearbeiten" : "+ Langtext"}</button>
                )}
              </td>
              <td className="zahl"><input className="schmal zahl" disabled={gesperrt} value={p.preisText} onChange={(e) => setP(i, { preisText: e.target.value })} /></td>
              <td className="zahl">{euro(positionGesamt(positionen[i]))}</td>
              {!gesperrt && (
                <td className="aktionen">
                  <button className="symbol" disabled={i === 0} onClick={() => verschiebe(i, -1)} title="nach oben"><Icon name="hoch" size={14} /></button>
                  <button className="symbol" disabled={i === pos.length - 1} onClick={() => verschiebe(i, 1)} title="nach unten"><Icon name="runter" size={14} /></button>
                  <button className="symbol" onClick={() => { setPos(pos.filter((_, j) => j !== i)); setGeaendert(true); }} title="entfernen"><Icon name="muell" size={14} /></button>
                </td>
              )}
            </tr>
          ))}
          {pos.length === 0 && <tr className="keinklick"><td colSpan={7} className="hinweis">Noch keine Positionen.</td></tr>}
        </tbody>
        <tfoot>
          <tr><td colSpan={5} className="zahl">Summe netto</td><td className="zahl">{euro(sum.netto)}</td>{!gesperrt && <td></td>}</tr>
          <tr><td colSpan={5} className="zahl">{ohneUst(fall) ? `USt. (${steuerfaelle.find((x) => x.wert === fall)?.text})` : `USt. ${beleg.ust_prozent}%`}</td><td className="zahl">{euro(sum.ust)}</td>{!gesperrt && <td></td>}</tr>
          <tr><td colSpan={5} className="zahl"><strong>Summe brutto</strong></td><td className="zahl"><strong>{euro(sum.brutto)}</strong></td>{!gesperrt && <td></td>}</tr>
        </tfoot>
      </table>

      {!gesperrt && (
        <div className="knoepfe" style={{ margin: "12px 0 20px" }}>
          <select value={katalogWahl} onChange={(e) => setKatalogWahl(e.target.value)} style={{ minWidth: 340 }}>
            <option value="">Position aus dem Katalog wählen …</option>
            {katalog.map((k) => <option key={k.id} value={k.id}>{[k.nummer, k.kurztext].filter(Boolean).join("  ")}</option>)}
          </select>
          <button onClick={ausKatalog} disabled={!katalogWahl}>Hinzufügen</button>
          <span className="trenner" />
          <button className="betont" onClick={() => setKalk({ index: null, start: null })}><Icon name="rechner" size={16} /> Bauteil kalkulieren</button>
          <button onClick={freiePosition}><Icon name="plus" size={16} /> Freie Position</button>
        </div>
      )}

      {kalk && <Kalkulator firma={firma} start={kalk.start} uebernehmen={kalkulationUebernehmen} schliessen={() => setKalk(null)} />}

      <div className="formular">
        <div className="raster">
          <label className="breit">Schlusstext<textarea rows={2} disabled={gesperrt} value={beleg.schlusstext ?? ""} onChange={(e) => setB({ schlusstext: e.target.value })} /></label>
        </div>
        {!gesperrt && beleg.id && (
          <button className="gefahr" onClick={async () => { await loescheEntwurf(beleg.id!); schliessen(); }}>Entwurf löschen</button>
        )}
      </div>
    </section>
  );
}
