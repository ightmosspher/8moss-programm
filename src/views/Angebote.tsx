import { useEffect, useState } from "react";
import { Beleg, listeBelege } from "../db/belege";
import { euro } from "../db/geld";
import AngebotEditor from "./AngebotEditor";
import Icon from "../components/Icon";

const datumAT = (iso: string) => iso.split("-").reverse().join(".");

export default function Angebote({ neu }: { neu?: boolean }) {
  const [liste, setListe] = useState<Beleg[]>([]);
  const [suche, setSuche] = useState("");
  const [offen, setOffen] = useState<number | "neu" | null>(neu ? "neu" : null);

  const laden = () => listeBelege("angebot", suche).then(setListe);
  useEffect(() => { if (offen === null) laden(); }, [suche, offen]);

  if (offen !== null) {
    return <AngebotEditor id={offen === "neu" ? undefined : offen} schliessen={() => setOffen(null)} oeffne={(id) => setOffen(id)} />;
  }

  return (
    <section>
      <div className="kopf">
        <div className="titel"><h1>Angebote</h1><span className="anzahl">{liste.length}</span></div>
        <div className="suchfeld"><Icon name="suche" size={16} /><input placeholder="Nummer, Kunde, Projekt …" value={suche} onChange={(e) => setSuche(e.target.value)} /></div>
        <button className="primaer" onClick={() => setOffen("neu")}><Icon name="plus" size={16} /> Neues Angebot</button>
      </div>
      {liste.length === 0 ? (
        <div className="leer">{suche ? "Keine passenden Angebote." : "Noch keine Angebote. Lege mit „Neues Angebot“ das erste an."}</div>
      ) : (
        <table>
          <thead><tr><th>Nummer</th><th>Datum</th><th>Kunde</th><th>Projekt</th><th>Status</th><th className="zahl">Netto</th></tr></thead>
          <tbody>
            {liste.map((b) => (
              <tr key={b.id} onClick={() => setOffen(b.id!)}>
                <td className="nummer">{b.belegnummer ?? <span className="hinweis">Entwurf</span>}</td>
                <td>{datumAT(b.datum)}</td>
                <td>{b.kunde_name}</td>
                <td>{b.projekt_bezeichnung}</td>
                <td><span className={`status ${b.status === "abgeschlossen" ? "status-angebot" : ""}`}>{b.status === "abgeschlossen" ? "Abgeschlossen" : "Entwurf"}</span></td>
                <td className="zahl"><strong>{euro(b.netto_cent)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
