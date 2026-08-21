import * as XLSX from "xlsx";

export type Cell = string | number | null;

export interface SheetData {
  name: string;
  rows: Cell[][];
  colWidths?: number[];
}

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

/** Ekspor beberapa lembar kerja (multi-sheet) ke dalam satu file Excel. */
export function exportMultiSheet(sheets: SheetData[], filename: string) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows.map((r) => r.map((c) => (c === null ? "" : c))));
    if (s.colWidths) ws["!cols"] = s.colWidths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  XLSX.writeFile(wb, filename);
}
