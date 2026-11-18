import { useEffect, useState } from "react";
import { getDb } from "./db";
import Start from "./views/Start";
import Kunden from "./views/Kunden";
import Katalog from "./views/Katalog";
import Lieferanten from "./views/Lieferanten";
import Projekte from "./views/Projekte";
import Angebote from "./views/Angebote";
import ArtikelSeite from "./views/Artikel";
import Aufbauten from "./views/Aufbauten";
import Einstellungen from "./views/Einstellungen";
import Platzhalter from "./views/Platzhalter";
import Icon, { IconName } from "./components/Icon";
import logo from "./assets/8moss-logo.png";

type Seite = "start" | "projekte" | "angebote" | "kunden" | "lieferanten" | "artikel" | "aufbauten" | "katalog"
  | "bestellungen" | "rechnungen" | "einstellungen";

const menue: { id: Seite; titel: string; gruppe: string; icon: IconName }[] = [
  { id: "start", titel: "Übersicht", gruppe: "", icon: "start" },
  { id: "projekte", titel: "Projekte", gruppe: "Arbeit", icon: "projekte" },
  { id: "angebote", titel: "Angebote", gruppe: "Arbeit", icon: "angebote" },
  { id: "bestellungen", titel: "Bestellungen", gruppe: "Arbeit", icon: "bestellungen" },
  { id: "rechnungen", titel: "Rechnungen", gruppe: "Arbeit", icon: "rechnungen" },
  { id: "aufbauten", titel: "Aufbauten", gruppe: "Kalkulation", icon: "aufbauten" },
  { id: "katalog", titel: "Positionskatalog", gruppe: "Kalkulation", icon: "katalog" },
  { id: "artikel", titel: "Artikel", gruppe: "Kalkulation", icon: "artikel" },
  { id: "kunden", titel: "Kunden", gruppe: "Stammdaten", icon: "kunden" },
  { id: "lieferanten", titel: "Lieferanten", gruppe: "Stammdaten", icon: "lieferanten" },
  { id: "einstellungen", titel: "Einstellungen", gruppe: "System", icon: "einstellungen" },
];

export default function App() {
  const [seite, setSeite] = useState<Seite>("start");
  const [angebotNeu, setAngebotNeu] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bereit, setBereit] = useState(false);

  useEffect(() => {
    getDb().then(() => setBereit(true)).catch((e) => setFehler(String(e)));
  }, []);

  const gruppen = [...new Set(menue.map((m) => m.gruppe))];
  const gehe = (z: string) => {
    if (z === "angebot-neu") { setAngebotNeu((n) => n + 1); setSeite("angebote"); }
    else setSeite(z as Seite);
  };

  return (
    <div className="app">
      <nav className="seitenleiste">
        <div className="logo"><img src={logo} alt="8moss" /></div>
        {gruppen.map((g) => (
          <div key={g} className="menuegruppe">
            {g && <div className="menuegruppe-titel">{g}</div>}
            {menue.filter((m) => m.gruppe === g).map((m) => (
              <button key={m.id} className={seite === m.id ? "aktiv" : ""} onClick={() => setSeite(m.id)}>
                <Icon name={m.icon} size={17} /> {m.titel}
              </button>
            ))}
          </div>
        ))}
        <div className="version">Version 0.2 · Vorschau</div>
      </nav>
      <main className="inhalt">
        {fehler && <div className="fehler">Datenbank konnte nicht geöffnet werden: {fehler}</div>}
        {!bereit && !fehler && <p>Datenbank wird geöffnet …</p>}
        {bereit && (
          <>
            {seite === "start" && <Start gehe={gehe} />}
            {seite === "kunden" && <Kunden />}
            {seite === "katalog" && <Katalog />}
            {seite === "artikel" && <ArtikelSeite />}
            {seite === "aufbauten" && <Aufbauten />}
            {seite === "einstellungen" && <Einstellungen />}
            {seite === "projekte" && <Projekte zuKunden={() => setSeite("kunden")} />}
            {seite === "angebote" && <Angebote key={angebotNeu} neu={angebotNeu > 0} />}
            {seite === "lieferanten" && <Lieferanten />}
            {seite === "bestellungen" && <Platzhalter titel="Bestellungen" text="Bestellung je Lieferant aus Auftragspositionen, mit den Materialmengen aus der Kalkulation. Kommt im nächsten Ausbau." />}
            {seite === "rechnungen" && <Platzhalter titel="Rechnungen" text="Teil- und Schlussrechnung im 8moss-Layout mit ebInterface-Export. Kommt im nächsten Ausbau." />}
          </>
        )}
      </main>
    </div>
  );
}
