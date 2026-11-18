/** Länderliste für Adressen. eu = Mitglied der EU (wichtig für die Umsatzsteuer). */
export interface Land { code: string; name: string; eu: boolean }

export const laender: Land[] = [
  { code: "AT", name: "Österreich", eu: true },
  { code: "DE", name: "Deutschland", eu: true },
  { code: "IT", name: "Italien", eu: true },
  { code: "CH", name: "Schweiz", eu: false },
  { code: "LI", name: "Liechtenstein", eu: false },
  { code: "SI", name: "Slowenien", eu: true },
  { code: "HU", name: "Ungarn", eu: true },
  { code: "CZ", name: "Tschechien", eu: true },
  { code: "SK", name: "Slowakei", eu: true },
  { code: "BE", name: "Belgien", eu: true },
  { code: "BG", name: "Bulgarien", eu: true },
  { code: "DK", name: "Dänemark", eu: true },
  { code: "EE", name: "Estland", eu: true },
  { code: "FI", name: "Finnland", eu: true },
  { code: "FR", name: "Frankreich", eu: true },
  { code: "GR", name: "Griechenland", eu: true },
  { code: "IE", name: "Irland", eu: true },
  { code: "HR", name: "Kroatien", eu: true },
  { code: "LV", name: "Lettland", eu: true },
  { code: "LT", name: "Litauen", eu: true },
  { code: "LU", name: "Luxemburg", eu: true },
  { code: "MT", name: "Malta", eu: true },
  { code: "NL", name: "Niederlande", eu: true },
  { code: "PL", name: "Polen", eu: true },
  { code: "PT", name: "Portugal", eu: true },
  { code: "RO", name: "Rumänien", eu: true },
  { code: "SE", name: "Schweden", eu: true },
  { code: "ES", name: "Spanien", eu: true },
  { code: "CY", name: "Zypern", eu: true },
  { code: "GB", name: "Vereinigtes Königreich", eu: false },
  { code: "NO", name: "Norwegen", eu: false },
  { code: "RS", name: "Serbien", eu: false },
  { code: "BA", name: "Bosnien und Herzegowina", eu: false },
  { code: "TR", name: "Türkei", eu: false },
  { code: "US", name: "USA", eu: false },
];

export const landName = (code?: string | null) => laender.find((l) => l.code === (code || "AT"))?.name ?? code ?? "";
export const istEu = (code?: string | null) => laender.find((l) => l.code === (code || "AT"))?.eu ?? false;
