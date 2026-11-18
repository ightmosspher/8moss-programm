import { ReactNode, useEffect } from "react";
import Icon from "./Icon";

/** Seitenfenster von rechts für Detailansichten (statt Formular über der Liste). */
export default function Schublade({ titel, untertitel, schliessen, children, fuss, breit }: {
  titel: string; untertitel?: string; schliessen: () => void; children: ReactNode; fuss?: ReactNode; breit?: boolean;
}) {
  useEffect(() => {
    const taste = (e: KeyboardEvent) => e.key === "Escape" && schliessen();
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [schliessen]);
  return (
    <div className="schublade-hintergrund" onMouseDown={(e) => e.target === e.currentTarget && schliessen()}>
      <aside className={`schublade ${breit ? "breit" : ""}`} role="dialog" aria-label={titel}>
        <header>
          <div>
            <h2>{titel}</h2>
            {untertitel && <div className="hinweis">{untertitel}</div>}
          </div>
          <button className="symbol" onClick={schliessen} title="Schließen (Esc)"><Icon name="schliessen" /></button>
        </header>
        <div className="schublade-inhalt">{children}</div>
        {fuss && <footer>{fuss}</footer>}
      </aside>
    </div>
  );
}
