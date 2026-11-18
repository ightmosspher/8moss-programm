import { useEffect, useState } from "react";
import { Beleg, kennzahlen } from "../db/belege";
import { euro } from "../db/geld";
import { Firma, ladeFirma, listeArtikel, projektStatus } from "../db/repo";
import Icon, { IconName } from "../components/Icon";

type Ziel = "projekte" | "angebote" | "angebot-neu" | "kunden" | "artikel" | "aufbauten" | "einstellungen";
const artName: Record<string, string> = { angebot: "Angebot", auftrag: "Auftrag", bestellung: "Bestellung", rechnung: "Rechnung", gutschrift: "Gutschrift" };

export default function Start({ gehe }: { gehe: (z: Ziel) => void }) {
  const [k, setK] = useState<Awaited<ReturnType<typeof kennzahlen>> | null>(null);
  const [firma, setFirma] = useState<Firma | null>(null);
  const [ohnePreis, setOhnePreis] = useState(0);

  useEffect(() => {
    kennzahlen().then(setK);
    ladeFirma().then(setFirma);
    listeArtikel().then((a) => setOhnePreis(a.filter((x) => !x.einkaufspreis_cent).length));
  }, []);
  if (!k || !firma) return null;

  const anzahl = (s: string) => k.status.find((x) => x.status === s)?.anzahl ?? 0;
  const stunde = new Date().getHours();
  const gruss = stunde < 11 ? "Guten Morgen" : stunde < 18 ? "Guten Tag" : "Guten Abend";
  const vorname = firma.unterzeichner?.split(" ")[0];

  const kachel = (icon: IconName, titel: string, wert: string, unter: string, ziel: Ziel) => (
    <button className="kachel" onClick={() => gehe(ziel)}>
      <div className="kachel-icon"><Icon name={icon} size={20} /></div>
      <div className="kachel-wert">{wert}</div>
      <div className="kachel-titel">{titel}</div>
      <div className="kachel-unter">{unter}</div>
    </button>
  );

  return (
    <section className="start">
      <div className="start-kopf">
        <div>
          <h1>{gruss}{vorname ? `, ${vorname}` : ""}</h1>
          <p className="hinweis">{new Date().toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="knoepfe">
          <button onClick={() => gehe("projekte")}><Icon name="projekte" size={16} /> Neues Projekt</button>
          <button className="primaer" onClick={() => gehe("angebot-neu")}><Icon name="angebote" size={16} /> Neues Angebot</button>
        </div>
      </div>

      <div className="kacheln">
        {kachel("angebote", "Offene Angebote", euro(k.offen_netto), `${k.offen_anzahl} Angebote warten auf Antwort`, "angebote")}
        {kachel("projekte", "Anfragen", String(anzahl("anfrage")), "noch ohne Angebot", "projekte")}
        {kachel("haken", "Aufträge in Arbeit", String(anzahl("auftrag")), "Projekte mit Auftrag", "projekte")}
        {kachel("kopie", "Entwürfe", String(k.entwuerfe), "noch nicht abgeschlossen", "angebote")}
      </div>

      <div className="start-raster">
        <div className="panel">
          <h2>Zuletzt bearbeitet</h2>
          {k.letzte.length === 0 ? <p className="hinweis">Noch keine Belege.</p> : (
            <ul className="liste">
              {k.letzte.map((b: Beleg) => (
                <li key={b.id} onClick={() => gehe("angebote")}>
                  <span className="liste-art">{artName[b.art]}</span>
                  <span className="liste-text"><strong>{b.belegnummer ?? "Entwurf"}</strong> {b.kunde_name}<br /><span className="hinweis">{b.projekt_bezeichnung}</span></span>
                  <span className="zahl">{euro(b.netto_cent)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel">
          <h2>Projekte nach Status</h2>
          <div className="balken">
            {projektStatus.map((s) => {
              const n = anzahl(s.wert);
              const max = Math.max(1, ...k.status.map((x) => x.anzahl));
              return (
                <div key={s.wert} className="balken-zeile" onClick={() => gehe("projekte")}>
                  <span>{s.text}</span>
                  <div className="balken-spur"><div className={`balken-wert status-${s.wert}`} style={{ width: `${(n / max) * 100}%` }} /></div>
                  <strong>{n}</strong>
                </div>
              );
            })}
          </div>
          {(ohnePreis > 0 || !firma.strasse) && <h2 style={{ marginTop: 24 }}>Zu erledigen</h2>}
          {!firma.strasse && (
            <div className="aufgabe" onClick={() => gehe("einstellungen")}><Icon name="warnung" size={16} /> Firmendaten für den Briefkopf eintragen <Icon name="pfeil" size={14} /></div>
          )}
          {ohnePreis > 0 && (
            <div className="aufgabe" onClick={() => gehe("artikel")}><Icon name="warnung" size={16} /> {ohnePreis} Artikeln fehlt der Einkaufspreis <Icon name="pfeil" size={14} /></div>
          )}
        </div>
      </div>
    </section>
  );
}
