/** PDF erzeugen und speichern (Desktop: Speichern-Dialog, Browser: Download). */
import type { BelegPdfDaten } from "./BelegPdf";

export async function pdfBlob(daten: BelegPdfDaten): Promise<Blob> {
  const [{ pdf }, { BelegPdf }] = await Promise.all([import("@react-pdf/renderer"), import("./BelegPdf")]);
  return pdf(BelegPdf(daten)).toBlob();
}

export async function pdfSpeichern(daten: BelegPdfDaten, dateiname: string): Promise<string | null> {
  const blob = await pdfBlob(daten);
  if ("__TAURI_INTERNALS__" in window) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const pfad = await save({ defaultPath: dateiname, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (!pfad) return null;
    await writeFile(pfad, new Uint8Array(await blob.arrayBuffer()));
    return pfad;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return dateiname;
}
