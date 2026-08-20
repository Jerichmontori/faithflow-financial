import * as XLSX from "xlsx";

export type Cell = string | number | null;

/** Ekspor satu lembar kerja dari matriks baris/kolom. */
export function exportAoa(
  rows: Cell[][],
  filename: string,
  sheetName = "Sheet1",
  colWidths?: number[],
) {
  const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map((c) => (c === null ? "" : c))));
  if (colWidths) ws["!cols"] = colWidths.map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
