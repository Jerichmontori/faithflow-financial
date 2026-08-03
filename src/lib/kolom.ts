/** Utilitas ekstraksi "Kolom" dan "Bulan" dari keterangan transaksi. */

export const BULAN_PANJANG = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

const BULAN_PATTERN: Array<[RegExp, number]> = [
  [/\bjan(uari)?\b/i, 0],
  [/\bfeb(ruari)?\b/i, 1],
  [/\bmar(et)?\b/i, 2],
  [/\bapr(il)?\b/i, 3],
  [/\bmei\b/i, 4],
  [/\bjun(i)?\b/i, 5],
  [/\bjul(i)?\b/i, 6],
  [/\bag(u|us|ust|ustus)?\b/i, 7],
  [/\bsep(t|tember)?\b/i, 8],
  [/\bok(t|tober)?\b/i, 9],
  [/\bnop?(v|ember|permber)?\b/i, 10],
  [/\bdes(ember)?\b/i, 11],
];

/** Nomor kolom dari keterangan, mis. "WKI Kolom 3 (12,19,26) Juli" -> 3 */
export const parseKolom = (description: string | null | undefined): number | null => {
  const m = /kolom\s*0*(\d{1,3})/i.exec(description ?? "");
  return m ? Number(m[1]) : null;
};

/** Index bulan (0-11) dari keterangan, null bila tidak disebutkan. */
export const parseBulan = (description: string | null | undefined): number | null => {
  const text = description ?? "";
  for (const [re, idx] of BULAN_PATTERN) {
    if (re.test(text)) return idx;
  }
  return null;
};

export const labelKolom = (kolom: number | null) =>
  kolom === null ? "Tanpa Kolom" : `Kolom ${kolom}`;

export const labelBulan = (bulan: number | null) =>
  bulan === null ? "Tanpa Bulan" : BULAN_PANJANG[bulan];

/**
 * Normalisasi nama kolom hasil ekstraksi keterangan.
 * Abaikan perbedaan huruf kapital; samakan varian tulisan ke nama standar.
 */
const NORMALISASI_NAMA: Array<[RegExp, string]> = [
  [/^Lansia\s+Aras\b.*/i, "Lansia Aras"],
  [/^PKB\s+Aras\b.*/i, "PKB ARAS"],
  [/^Remaja\s+Aras\b.*/i, "Remaja Aras"],
  [/^WKI\s+(Lidya|Lydia)\b.*/i, "WKI Lidya"],
  [/^WKI\s+(Ester|Easter)\b.*/i, "WKI Ester Eunike"],
  [/^WKI\s+(Marta|Martha)\b.*/i, "WKI Martha Maria"],
  [/^WKI\s+.*Monika\b.*/i, "WKI Monika"],
];

function normalisasiNama(nama: string): string {
  for (const [re, canonical] of NORMALISASI_NAMA) {
    if (re.test(nama)) return canonical;
  }
  return nama;
}

/**
 * Nama kolom dari keterangan:
 * - Ada tanda "(" -> ambil teks sebelum tanda kurung.
 *   "PKB Musafir (5,12,19,26) Bulan Juli" -> "PKB Musafir"
 * - Tidak ada "(" tetapi ada kata "Bulan" -> ambil teks sebelum kata "Bulan".
 *   "WKI Debora Bulan Maret" -> "WKI Debora"
 * - Selain itu -> null (tidak ditambahkan ke filter).
 * Varian nama tertentu akan dinormalisasi ke nama standar.
 */
export const parseNamaKolom = (description: string | null | undefined): string | null => {
  const text = (description ?? "").trim();
  if (!text) return null;

  let raw: string | null = null;
  const kurung = text.indexOf("(");
  if (kurung > 0) {
    raw = text.slice(0, kurung);
  } else if (kurung === -1) {
    const m = /\bbulan\b/i.exec(text);
    if (m && m.index > 0) raw = text.slice(0, m.index);
  }

  const nama = (raw ?? "").replace(/[\s,.\-–—:]+$/g, "").trim();
  const normalized = normalisasiNama(nama);
  return normalized.length > 0 ? normalized : null;
};