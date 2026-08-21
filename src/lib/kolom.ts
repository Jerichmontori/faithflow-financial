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
  // Lansia Rayon 1 - 5 & Aras (Case-Insensitive)
  [/^Lansia\s+Rayon\s*0*1\b.*/i, "Lansia Rayon 1"],
  [/^Lansia\s+Rayon\s*0*2\b.*/i, "Lansia Rayon 2"],
  [/^Lansia\s+Rayon\s*0*3\b.*/i, "Lansia Rayon 3"],
  [/^Lansia\s+Rayon\s*0*4\b.*/i, "Lansia Rayon 4"],
  [/^Lansia\s+Rayon\s*0*5\b.*/i, "Lansia Rayon 5"],
  [/^Lansia\s+(Aras|Rayon\s+Aras)\b.*/i, "Lansia Aras"],

  // WKI
  [/^WKI\s+(Lidya|Lydia)\b.*/i, "WKI Lidya"],
  [/^WKI\s+(Ester|Easter)\b.*/i, "WKI Ester Eunike"],
  [/^WKI\s+(Marta|Martha)\b.*/i, "WKI Martha Maria"],
  [/^WKI\s+(Debora|Deborah)\b.*/i, "WKI Debora"],
  [/^WKI\s+(Sifra|Shifra)\b.*/i, "WKI Sifra"],
  [/^WKI\s+.*Monika\b.*/i, "WKI Monika"],
  [/^WKI\s+.*Aras\b.*/i, "WKI Aras"],

  // PKB
  [/^PKB\s+(Musafir|Muzafir)\b.*/i, "PKB Musafir"],
  [/^PKB\s+(Abraham|Ibrahim)\b.*/i, "PKB Abraham"],
  [/^PKB\s+.*Aras\b.*/i, "PKB ARAS"],

  // Pemuda & Remaja & ASM
  [/^Pemuda\s+(Imanuel|Immanuel)\b.*/i, "Pemuda Imanuel"],
  [/^Pemuda\s+(Baithany|Betania|Bethany)\b.*/i, "Pemuda Bethany"],
  [/^Remaja\s+.*Aras\b.*/i, "Remaja Aras"],
  [/^ASM\s+.*Aras\b.*/i, "ASM Aras"],
  [/^Katekisasi\s+sidi\s+Baru\b.*/i, "Katekisasi Sidi Baru"],
];

function toTitleCase(str: string): string {
  return str
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "wki") return "WKI";
      if (lower === "pkb") return "PKB";
      if (lower === "asm") return "ASM";
      if (lower === "bipra") return "BIPRA";
      if (lower === "aras") return "Aras";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function normalisasiNama(nama: string): string {
  const trimmed = nama.trim();
  for (const [re, canonical] of NORMALISASI_NAMA) {
    if (re.test(trimmed)) return canonical;
  }
  return toTitleCase(trimmed);
}

/**
 * Normalisasi dan standarisasi teks keterangan transaksi secara otomatis
 * untuk meminimalisir kesalahan pengetikan manual (typo, casing, spasi tanda kurung, variasi ejaan).
 */
export function standardizeDescription(text: string): string {
  if (!text) return "";
  let clean = text.trim();

  // 1. Perbaiki spasi di dalam dan sekitar tanda kurung: "( 3 Duka )" -> "(3 Duka)"
  clean = clean.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  clean = clean.replace(/\s{2,}/g, " ");

  // 2. Standardisasi format kata Kolom: "kolom 04" / "KOlom 4" -> "Kolom 4"
  clean = clean.replace(/\bkolom\s*0*(\d+)\b/gi, (_, num) => `Kolom ${Number(num)}`);

  // 3. Standardisasi kata Bulan: "bulan februari" -> "Bulan Februari", "bulan" -> "Bulan"
  clean = clean.replace(/\bbulan\s+([a-z]+)/gi, (_, bln) => {
    const idx = parseBulan(bln);
    if (idx !== null) return `Bulan ${BULAN_PANJANG[idx]}`;
    return `Bulan ${bln.charAt(0).toUpperCase() + bln.slice(1)}`;
  });

  // 4. Standardisasi ejaan Lansia Rayon: "lansia rayon 2" -> "Lansia Rayon 2"
  clean = clean.replace(/\blansia\s+rayon\s*0*(\d+)\b/gi, (_, r) => `Lansia Rayon ${Number(r)}`);
  clean = clean.replace(/\blansia\s+aras\b/gi, "Lansia Aras");

  // 5. Standardisasi ejaan BIPRA Kelompok
  clean = clean.replace(/\bwki\s+(lidya|lydia)\b/gi, "WKI Lidya");
  clean = clean.replace(/\bwki\s+(marta|martha)\s*(maria)?\b/gi, "WKI Martha Maria");
  clean = clean.replace(/\bwki\s+(ester|easter)\s*(eunike)?\b/gi, "WKI Ester Eunike");
  clean = clean.replace(/\bwki\s+(debora|deborah)\b/gi, "WKI Debora");
  clean = clean.replace(/\bwki\s+(sifra|shifra)\b/gi, "WKI Sifra");
  clean = clean.replace(/\bwki\s+(monika)\b/gi, "WKI Monika");
  clean = clean.replace(/\bpkb\s+(musafir|muzafir)\b/gi, "PKB Musafir");
  clean = clean.replace(/\bpkb\s+(abraham|ibrahim)\b/gi, "PKB Abraham");
  clean = clean.replace(/\bpemuda\s+(imanuel|immanuel)\b/gi, "Pemuda Imanuel");
  clean = clean.replace(/\bpemuda\s+(baithany|betania|bethany)\b/gi, "Pemuda Bethany");

  // 6. Standardisasi Dana Duka
  clean = clean.replace(/\bdana\s+duka\b/gi, "Dana Duka");
  clean = clean.replace(/\((\d+)\)\s*duka\b/gi, "($1 Duka)");
  clean = clean.replace(/\((\d+)\s*duka\)/gi, "($1 Duka)");

  // 7. Standardisasi PBTK
  clean = clean.replace(/\bpbtk\b/gi, "PBTK");

  // 8. Standardisasi Acronyms WKI / PKB / ASM
  clean = clean.replace(/\bwki\b/gi, "WKI");
  clean = clean.replace(/\bpkb\b/gi, "PKB");
  clean = clean.replace(/\basm\b/gi, "ASM");

  // 9. Standardisasi TK Bumotik & SD GMIM
  clean = clean.replace(/\b(persembahan\s+)?tk\s+bumotik\b/gi, "TK Bumotik");
  clean = clean.replace(/\b(persembahan\s+)?sd\s+gmim\s*(0*5|v)(\s+manado)?\b/gi, "SD GMIM 5");

  return clean;
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