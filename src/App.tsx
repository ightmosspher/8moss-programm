import { useEffect, useState } from "react";
import { getDb } from "./db";
import Kunden from "./views/Kunden";
import Katalog from "./views/Katalog";
import Lieferanten from "./views/Lieferanten";
import Projekte from "./views/Projekte";
import Einstellungen from "./views/Einstellungen";
import Platzhalter from "./views/Platzhalter";

type Seite = "projekte" | "angebote" | "kunden" | "lieferanten" | "katalog" | "bestellungen" | "rechnungen" | "einstellungen";

const menue: { id: Seite; titel: string; gruppe: string }[] = [
  { id: "projekte", titel: "Projekte", gruppe: "Arbeit" },
  { id: "angebote", titel: "Angebote", gruppe: "Arbeit" },
  { id: "bestellungen", titel: "Bestellungen", gruppe: "Arbeit" },
  { id: "rechnungen", titel: "Rechnungen", gruppe: "Arbeit" },
  { id: "kunden", titel: "Kunden", gruppe: "Stammdaten" },
  { id: "lieferanten", titel: "Lieferanten", gruppe: "Stammdaten" },
  { id: "katalog", titel: "Positionskatalog", gruppe: "Stammdaten" },
  { id: "einstellungen", titel: "Einstellungen", gruppe: "System" },
];

export default function App() {
  const [seite, setSeite] = useState<Seite>("projekte");
  const [fehler, setFehler] = useState<string | null>(null);
  const [bereit, setBereit] = useState(false);

  useEffect(() => {
    getDb().then(() => setBereit(true)).catch((e) => setFehler(String(e)));
  }, []);

  const gruppen = [...new Set(menue.map((m) => m.gruppe))];

  return (
    <div className="app">
      <nav className="seitenleiste">
        <div className="logo">8moss</div>
        {gruppen.map((g) => (
          <div key={g} className="menuegruppe">
            <div className="menuegruppe-titel">{g}</div>
            {menue.filter((m) => m.gruppe === g).map((m) => (
              <button key={m.id} className={seite === m.id ? "aktiv" : ""} onClick={() => setSeite(m.id)}>
                {m.titel}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <main className="inhalt">
        {fehler && <div className="fehler">Datenbank konnte nicht geöffnet werden: {fehler}</div>}
        {!bereit && !fehler && <p>Datenbank wird geöffnet …</p>}
        {bereit && (
          <>
            {seite === "kunden" && <Kunden />}
            {seite === "katalog" && <Katalog />}
            {seite === "einstellungen" && <Einstellungen />}
            {seite === "projekte" && <Projekte zuKunden={() => setSeite("kunden")} />}
            {seite === "angebote" && <Platzhalter titel="Angebote" text="Angebot aus Katalogpositionen zusammenstellen und als PDF im 8moss-Layout ausgeben. Kommt im Prototyp." />}
            {seite === "lieferanten" && <Lieferanten />}
            {seite === "bestellungen" && <Platzhalter titel="Bestellungen" text="Bestellung je Lieferant aus Auftragspositionen. Kommt im Ausbau." />}
            {seite === "rechnungen" && <Platzhalter titel="Rechnungen" text="Abschlags- und Schlussrechnung mit ebInterface-Export. Kommt im Ausbau." />}
          </>
        )}
      </main>
    </div>
  );
}
