/**
 * Druckvorlage für Belege im 8moss-Layout (nach der Rechnungsvorlage RE1.1).
 * Gilt für Angebot, Auftragsbestätigung, Bestellung und Rechnung.
 * Schrift: Helvetica (PDF-Standardschrift, wird von jedem PDF-Programm mitgebracht).
 */
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import logo from "../assets/8moss-logo.png";
import { Beleg, BelegPosition, positionGesamt, summen } from "../db/belege";
import { Firma, Kunde } from "../db/repo";
import { landName } from "../lib/laender";
import { ohneUst, steuerfallVon, steuerHinweis } from "../lib/steuer";

Font.registerHyphenationCallback((w) => [w]); // keine Silbentrennung

const grau = "#8a8a8a";
const linie = "#9a9a9a";
const sp = 0.6; // Laufweite wie in der Vorlage

const s = StyleSheet.create({
  seite: { fontFamily: "Helvetica", fontSize: 10, color: "#111", paddingTop: 98, paddingBottom: 92, paddingLeft: 90, paddingRight: 66 },
  logo: { position: "absolute", top: 40, right: 66, width: 160 },
  absender: { alignSelf: "flex-end", textAlign: "right", fontSize: 10.5, fontWeight: "normal", lineHeight: "15pt" },
  fett: { fontWeight: "bold" },
  empfaenger: { marginTop: 4, fontSize: 10.5, fontWeight: "normal", lineHeight: "15pt" },
  datum: { textAlign: "right", fontSize: 10.5, letterSpacing: sp, paddingBottom: 3, borderBottomWidth: 0.6, borderBottomColor: "#111" },
  nummer: { marginTop: 3, fontSize: 10.5, letterSpacing: sp },
  text: { fontSize: 10.5, letterSpacing: sp, lineHeight: "18pt" },
  absatz: { marginTop: 18 },
  tabKopf: { flexDirection: "row", marginTop: 26, fontSize: 10.5, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: linie, letterSpacing: sp },
  zeile: { flexDirection: "row", paddingTop: 4, letterSpacing: sp, lineHeight: "13pt" },
  cPos: { width: 38, textAlign: "center" },
  cAnz: { width: 52 },
  cArt: { flex: 1, paddingRight: 8 },
  cEh: { width: 70, textAlign: "right" },
  cGes: { width: 74, textAlign: "right" },
  langtext: { fontSize: 8.6, letterSpacing: 0.45, marginTop: 3, lineHeight: "12.5pt" },
  posEnde: { borderBottomWidth: 0.5, borderBottomColor: linie, paddingBottom: 4 },
  summe: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: linie, letterSpacing: sp },
  summeText: { width: 160, textAlign: "right", paddingRight: 8 },
  summeWert: { width: 74, textAlign: "right" },
  zusatz: { flexDirection: "row", marginTop: 22, fontSize: 10.5, letterSpacing: sp },
  fuss: { position: "absolute", left: 90, right: 66, bottom: 26, fontSize: 5.6, color: grau, letterSpacing: 0.9 },
  fussLinie: { borderBottomWidth: 0.6, borderBottomColor: "#111", paddingBottom: 6, marginBottom: 3 },
  seitenzahl: { textAlign: "center", fontSize: 7, letterSpacing: 0.9, marginTop: 6 },
});

/** € 1.234,56 (Tausenderpunkt wie in der 8moss-Vorlage) */
const euro = (cent: number) => {
  const [ganz, komma] = (Math.abs(cent) / 100).toFixed(2).split(".");
  return `${cent < 0 ? "- " : ""}€ ${ganz.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${komma}`;
};
const menge = (m: number) => m.toLocaleString("de-AT", { maximumFractionDigits: 3 });
const datumAT = (iso: string) => iso.split("-").reverse().join(".");

const titel: Record<string, { name: string; empfaenger: string; kuerzel: string }> = {
  angebot: { name: "Angebot", empfaenger: "Angebotsempfänger", kuerzel: "AN1.0" },
  auftrag: { name: "Auftragsbestätigung", empfaenger: "Auftraggeber", kuerzel: "AB1.0" },
  bestellung: { name: "Bestellung", empfaenger: "Lieferant", kuerzel: "BE1.0" },
  rechnung: { name: "Rechnung", empfaenger: "Rechnungsempfänger", kuerzel: "RE1.1" },
  gutschrift: { name: "Gutschrift", empfaenger: "Empfänger", kuerzel: "GU1.0" },
};

export interface BelegPdfDaten {
  beleg: Beleg;
  positionen: BelegPosition[];
  firma: Firma;
  empfaenger?: Kunde;
}

export function BelegPdf({ beleg, positionen, firma, empfaenger }: BelegPdfDaten) {
  const t = titel[beleg.art];
  const fall = steuerfallVon(beleg);
  const keineUst = ohneUst(fall);
  const hinweis = steuerHinweis(fall);
  const sum = summen(positionen, beleg.ust_prozent, keineUst);
  const ausland = (l?: string | null) => (l && l !== "AT" ? landName(l).toUpperCase() : null);
  const fuss1 = [firma.name, firma.strasse, [firma.plz, firma.ort].filter(Boolean).join(" "), firma.telefon, firma.email]
    .filter(Boolean).join(".:.") + ".:.";
  const fuss2 = [firma.firmenbuch, firma.uid, firma.gericht].filter(Boolean).join(".:.") + ".:.";
  const zahlungsziel = beleg.zahlungsziel_tage ?? firma.zahlungsziel_tage;

  return (
    <Document title={`${t.name} ${beleg.belegnummer ?? "Entwurf"} ${firma.name}`} author={firma.unterzeichner ?? firma.name}>
      <Page size="A4" style={s.seite}>
        {/* Logo auf jeder Seite oben rechts */}
        <Image src={logo} style={s.logo} fixed />

        <View style={s.absender}>
          <Text style={s.fett}>{firma.name}</Text>
          {firma.strasse && <Text>{firma.strasse}</Text>}
          <Text>{[firma.plz, firma.ort].filter(Boolean).join(" ")}</Text>
          {ausland(firma.land) && <Text>{landName(firma.land)}</Text>}
          {firma.uid && <Text>{firma.uid}</Text>}
        </View>

        <View style={s.empfaenger}>
          <Text>{t.empfaenger}</Text>
          {empfaenger ? (
            <>
              <Text style={s.fett}>{empfaenger.name}</Text>
              {empfaenger.strasse && <Text>{empfaenger.strasse}</Text>}
              <Text>{[empfaenger.plz, empfaenger.ort].filter(Boolean).join(" ")}</Text>
              {ausland(empfaenger.land) && <Text>{ausland(empfaenger.land)}</Text>}
              {empfaenger.firmenbuch && <Text>{empfaenger.firmenbuch}</Text>}
              {empfaenger.uid && <Text>{empfaenger.uid}</Text>}
            </>
          ) : <Text style={s.fett}>–</Text>}
        </View>

        <Text style={[s.datum, { marginTop: 22 }]}>{datumAT(beleg.datum)}</Text>
        <Text style={s.nummer}>{t.name} Nr.: {beleg.belegnummer ?? "ENTWURF"}</Text>

        {beleg.anrede && <Text style={[s.text, s.absatz]}>{beleg.anrede}</Text>}
        {beleg.vortext && <Text style={[s.text, s.absatz]}>{beleg.vortext}</Text>}

        {/* Positionen */}
        <View style={s.tabKopf} fixed={false}>
          <Text style={s.cPos}>Pos.</Text>
          <Text style={s.cAnz}>Anz.</Text>
          <Text style={s.cArt}>Art.</Text>
          <Text style={s.cEh}>EH</Text>
          <Text style={s.cGes}>Gesamt</Text>
        </View>
        {positionen.map((p, i) => (
          <View key={i} style={i === positionen.length - 1 ? s.posEnde : {}} wrap={false}>
            <View style={s.zeile}>
              <Text style={s.cPos}>{p.ordnungszahl || `${i + 1}.0`}</Text>
              <Text style={s.cAnz}>{menge(p.menge)}{p.einheit && !["Stk", "pausch"].includes(p.einheit) ? ` ${p.einheit.replace("m2", "m²").replace("m3", "m³")}` : ""}</Text>
              <Text style={[s.cArt, { fontWeight: "normal" }]}>{p.kurztext}</Text>
              <Text style={s.cEh}>{euro(p.einheitspreis_cent)}</Text>
              <Text style={s.cGes}>{euro(positionGesamt(p))}</Text>
            </View>
            {/* Langtext läuft wie in der Vorlage bis unter die EH-Spalte */}
            <View style={{ marginLeft: 90, marginRight: 74 }}>
              {p.langtext?.split(/\n+/).filter(Boolean).map((z, j) => <Text key={j} style={s.langtext}>{z}</Text>)}
            </View>
          </View>
        ))}

        <View wrap={false}>
          <View style={s.summe}><Text style={s.summeText}>Summe netto</Text><Text style={s.summeWert}>{euro(sum.netto)}</Text></View>
          {keineUst ? (
            <View style={s.summe}><Text style={s.summeText}>USt.</Text><Text style={s.summeWert}>{euro(0)}</Text></View>
          ) : (
            <View style={s.summe}><Text style={s.summeText}>USt. {beleg.ust_prozent}%</Text><Text style={s.summeWert}>{euro(sum.ust)}</Text></View>
          )}
          <View style={[s.summe, { borderBottomWidth: 0 }]}>
            <Text style={s.summeText}>Summe brutto</Text><Text style={[s.summeWert, s.fett]}>{euro(sum.brutto)}</Text>
          </View>
        </View>

        {hinweis ? (
          <Text style={[s.text, s.absatz, { fontSize: 9 }]}>
            {hinweis}
            {empfaenger?.uid ? ` UID-Nr. des Leistungsempfängers: ${empfaenger.uid}.` : ""}
            {fall !== "rc_bau" && firma.uid ? ` UID-Nr. des Leistenden: ${firma.uid}.` : ""}
          </Text>
        ) : null}

        {(beleg.art === "rechnung" || beleg.art === "angebot") && (
          <View style={s.zusatz}><Text style={{ width: 150 }}>Zahlungsziel:</Text><Text>{zahlungsziel} Tage netto</Text></View>
        )}

        <View wrap={false}>
          {beleg.schlusstext && <Text style={[s.text, s.absatz]}>{beleg.schlusstext}</Text>}
          {beleg.art === "rechnung" && firma.iban && (
            <Text style={[s.text, s.absatz]}>
              Wir bedanken uns für die Anweisung auf das Konto der {firma.name}{"\n"}
              {[firma.bank, firma.iban].filter(Boolean).join(" ")}.
            </Text>
          )}
          <Text style={[s.text, s.absatz]}>Mit besten Grüßen</Text>
          <Text style={[s.text, s.absatz]}>{firma.unterzeichner ? `${firma.unterzeichner}\n` : ""}{firma.name}</Text>
        </View>

        {/* Fußzeile auf jeder Seite */}
        <View style={s.fuss} fixed>
          <Text style={{ marginBottom: 6 }}>{fuss1}</Text>
          <Text style={s.fussLinie}>{fuss2}</Text>
          <Text>{t.kuerzel}</Text>
          <Text style={s.seitenzahl} render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
