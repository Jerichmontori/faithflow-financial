import { parseKolom } from "@/lib/kolom";
import type { Transaction } from "@/lib/queries";

export const DUKA_KEY = "bumotik.danaDuka";
export const DAFTAR_DUKA_KEY = "bumotik.daftarKasusDuka_v1";
export const DUKA_RULES_KEY = "bumotik.tarifDukaRules_v1";
export const DUKA_TAHUN_LALU_KEY = "bumotik.tunggakanDukaTahunLalu_v1";

export const DUKA_KOLOM = Array.from({ length: 29 }, (_, i) => i + 1);

export const DEFAULT_TARIF_DUKA = 50000;

export interface KasusDuka {
  id: string;
  urutan: number; // Tahap 1, 2, 3, dst
  nama: string; // contoh: "Alm. Bpk. John Doe (Kel. Doe - Sumual)"
  tanggal: string; // YYYY-MM-DD
  kolomKeluarga?: number | null;
  iuranPerKolom: number; // Tarif standar/default untuk tahap ini
  tarifKhususKolom?: Record<number, number>; // Override khusus kolom tertentu pada tahap ini
  keterangan?: string;
}

export interface TarifKolomRule {
  id: string;
  namaAturan: string; // contoh: "Ketetapan Awal Tahun" atau "Penyesuaian Triwulan II"
  mulaiTahap: number; // Mulai berlaku dari duka tahap ke-berapa
  sampaiTahap?: number | null; // Berlaku sampai tahap ke-berapa (null = seterusnya)
  tarifPerKolom: Record<number, number>; // Kolom 1: 50000, Kolom 2: 75000, dst
  keterangan?: string;
}

export interface TunggakanTahunLaluItem {
  kolom: number;
  nominalRp: number; // Besaran rupiah tunggakan dari tahun lalu
  jumlahKasus: number; // Berapa x duka tahun lalu yang belum dibayar
  keterangan?: string; // Catatan, misal "Sisa duka Nov-Des 2025"
}

export type TunggakanTahunLaluMap = Record<number, TunggakanTahunLaluItem>;

export type DukaMap = Record<string, string>;

export const DEFAULT_KASUS_DUKA: KasusDuka[] = [
  {
    id: "duka-1",
    urutan: 1,
    nama: "Alm. Kel. Kawalo - Rumagit",
    tanggal: "2026-01-12",
    kolomKeluarga: 15,
    iuranPerKolom: 50000,
    keterangan: "Duka Jemaat Tahap 1",
  },
  {
    id: "duka-2",
    urutan: 2,
    nama: "Alm. Kel. Sondakh - Pandeirot",
    tanggal: "2026-02-05",
    kolomKeluarga: 7,
    iuranPerKolom: 50000,
    keterangan: "Duka Jemaat Tahap 2",
  },
];

/** Standar default tarif 29 kolom */
export const buatDefaultTarifKolom = (nominal = DEFAULT_TARIF_DUKA): Record<number, number> => {
  const res: Record<number, number> = {};
  for (const k of DUKA_KOLOM) {
    res[k] = nominal;
  }
  return res;
};

export const DEFAULT_TARIF_RULES: TarifKolomRule[] = [
  {
    id: "rule-awal",
    namaAturan: "Tarif Standar Awal Tahun",
    mulaiTahap: 1,
    sampaiTahap: null,
    tarifPerKolom: buatDefaultTarifKolom(50000),
    keterangan: "Berlaku mulai Duka Tahap 1",
  },
];

/** Membaca daftar nama/peristiwa duka */
export const bacaDaftarDuka = (): KasusDuka[] => {
  if (typeof window === "undefined") return DEFAULT_KASUS_DUKA;
  try {
    const raw = localStorage.getItem(DAFTAR_DUKA_KEY);
    if (!raw) return DEFAULT_KASUS_DUKA;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_KASUS_DUKA;
  } catch {
    return DEFAULT_KASUS_DUKA;
  }
};

/** Menyimpan daftar nama/peristiwa duka */
export const simpanDaftarDuka = (list: KasusDuka[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DAFTAR_DUKA_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("bumotik_duka_updated"));
  } catch (e) {
    console.error("Gagal simpan daftar duka:", e);
  }
};

/** Membaca aturan tarif kolom dinamis */
export const bacaTarifRules = (): TarifKolomRule[] => {
  if (typeof window === "undefined") return DEFAULT_TARIF_RULES;
  try {
    const raw = localStorage.getItem(DUKA_RULES_KEY);
    if (!raw) return DEFAULT_TARIF_RULES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TARIF_RULES;
  } catch {
    return DEFAULT_TARIF_RULES;
  }
};

/** Menyimpan aturan tarif kolom dinamis */
export const simpanTarifRules = (rules: TarifKolomRule[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DUKA_RULES_KEY, JSON.stringify(rules));
    window.dispatchEvent(new CustomEvent("bumotik_duka_updated"));
  } catch (e) {
    console.error("Gagal simpan aturan tarif:", e);
  }
};

/** Membaca data tunggakan dari tahun lalu per kolom */
export const bacaTunggakanTahunLalu = (): TunggakanTahunLaluMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DUKA_TAHUN_LALU_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as TunggakanTahunLaluMap;
  } catch {
    return {};
  }
};

/** Menyimpan data tunggakan dari tahun lalu per kolom */
export const simpanTunggakanTahunLalu = (data: TunggakanTahunLaluMap): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DUKA_TAHUN_LALU_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("bumotik_duka_updated"));
  } catch (e) {
    console.error("Gagal simpan tunggakan tahun lalu:", e);
  }
};

/** Membaca override manual status duka */
export const bacaDuka = (): DukaMap => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DUKA_KEY) ?? "{}") as DukaMap;
  } catch {
    return {};
  }
};

/** Menyimpan override status duka */
export const simpanDuka = (data: DukaMap) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(DUKA_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent("bumotik_duka_updated"));
};

/**
 * Menghitung nominal kewajiban iuran untuk suatu kolom pada kasus duka tertentu
 */
export function dapatkanTarifDukaKolom(
  kasus: KasusDuka,
  kolom: number,
  rules: TarifKolomRule[] = []
): number {
  if (kasus.tarifKhususKolom && typeof kasus.tarifKhususKolom[kolom] === "number") {
    return kasus.tarifKhususKolom[kolom];
  }

  const sortedRules = [...rules].sort((a, b) => b.mulaiTahap - a.mulaiTahap);
  const matchedRule = sortedRules.find(
    (r) =>
      kasus.urutan >= r.mulaiTahap &&
      (r.sampaiTahap === null || r.sampaiTahap === undefined || kasus.urutan <= r.sampaiTahap)
  );

  if (matchedRule && typeof matchedRule.tarifPerKolom[kolom] === "number") {
    return matchedRule.tarifPerKolom[kolom];
  }

  return kasus.iuranPerKolom || DEFAULT_TARIF_DUKA;
}

/**
 * Menghitung total target penerimaan duka dari seluruh 29 kolom untuk suatu kasus duka
 */
export function hitungTotalTargetDukaTahap(
  kasus: KasusDuka,
  rules: TarifKolomRule[] = []
): { totalTargetRp: number; rataRataPerKolom: number; detailPerKolom: Record<number, number> } {
  let totalTargetRp = 0;
  const detailPerKolom: Record<number, number> = {};

  for (const k of DUKA_KOLOM) {
    const tarifK = dapatkanTarifDukaKolom(kasus, k, rules);
    detailPerKolom[k] = tarifK;
    totalTargetRp += tarifK;
  }

  const rataRataPerKolom = DUKA_KOLOM.length > 0 ? Math.round(totalTargetRp / DUKA_KOLOM.length) : 0;
  return { totalTargetRp, rataRataPerKolom, detailPerKolom };
}

/** Mengecek apakah suatu transaksi adalah setoran dana duka */
export const isTransaksiDuka = (t: Transaction): boolean => {
  if (t.kind !== "penerimaan" || t.status === "rejected" || t.status === "draft") return false;
  const code = t.budget_lines?.code ?? "";
  const desc = (t.description ?? "").toLowerCase();
  const category = (t.category ?? "").toLowerCase();

  return (
    code === "1.3.55.01" ||
    code === "3.3.03.01" ||
    category.includes("duka") ||
    desc.includes("dana duka") ||
    desc.includes("diakonia duka") ||
    desc.includes("setoran duka")
  );
};

export interface TahapDukaKolomDetail {
  kasusId: string;
  urutan: number;
  nama: string;
  tanggal: string;
  kewajibanRp: number;
  terbayarRp: number;
  lunas: boolean;
  sisaKurangRp: number;
}

export interface DetailTahunLaluKolom {
  kewajibanTahunLaluRp: number;
  kasusTahunLalu: number;
  terbayarTahunLaluRp: number;
  sisaTunggakanTahunLaluRp: number;
  lunas: boolean;
  keterangan?: string;
}

export interface KolomDukaSummary {
  kolom: number;
  totalSetorRp: number;
  totalKewajibanRp: number;
  totalSisaTunggakanRp: number;
  jumlahDukaTerbayar: number;
  totalKasusDuka: number;
  tunggakanJumlah: number; // berapa duka yang tertunggak (tahun lalu + tahun berjalan)
  statusLabel: string; // "Lunas" atau "1 x Duka", "2 x Duka", dst
  tahapTertunggak: number[]; // daftar nomor tahap tahun berjalan yang belum lunas
  detailTahunLalu: DetailTahunLaluKolom;
  detailTahap: TahapDukaKolomDetail[];
  riwayatTrx: Transaction[];
  terbayarDukaIds: string[];
}

/**
 * Otomatis menghitung status tunggakan duka per kolom berdasarkan transaksi riil,
 * tunggakan tahun lalu, daftar kasus duka, dan aturan tarif dinamis bertahap.
 */
export const hitungSemuaTunggakanDuka = (
  transactions: Transaction[],
  daftarDuka: KasusDuka[],
  overrideMap: DukaMap = {},
  rules: TarifKolomRule[] = [],
  tunggakanLaluMap: TunggakanTahunLaluMap = {}
): Record<number, KolomDukaSummary> => {
  const result: Record<number, KolomDukaSummary> = {};
  const totalKasus = daftarDuka.length;

  // Filter semua transaksi duka
  const dukaTrx = transactions.filter(isTransaksiDuka);

  // Urutkan kasus duka berdasarkan urutan tahap (1, 2, 3, ...)
  const sortedKasus = [...daftarDuka].sort((a, b) => a.urutan - b.urutan);

  for (const k of DUKA_KOLOM) {
    // Cari transaksi untuk kolom k
    const trxKolom = dukaTrx.filter((t) => {
      const parsed = parseKolom(t.description || t.payee || "");
      return parsed === k;
    });

    const totalSetorRp = trxKolom.reduce((acc, t) => acc + Number(t.amount || 0), 0);

    // 1. Alokasikan setoran ke Tunggakan Tahun Lalu terlebih dahulu (FIFO)
    const infoLalu = tunggakanLaluMap[k] || { kolom: k, nominalRp: 0, jumlahKasus: 0, keterangan: "" };
    const kewajibanLaluRp = Number(infoLalu.nominalRp || 0);
    const kasusLalu = Number(infoLalu.jumlahKasus || (kewajibanLaluRp > 0 ? 1 : 0));

    let terbayarLaluRp = 0;
    let sisaLaluKurangRp = 0;
    let lunasLalu = true;
    let sisaSetoran = totalSetorRp;

    if (kewajibanLaluRp > 0) {
      if (sisaSetoran >= kewajibanLaluRp) {
        terbayarLaluRp = kewajibanLaluRp;
        sisaSetoran -= kewajibanLaluRp;
        lunasLalu = true;
        sisaLaluKurangRp = 0;
      } else {
        terbayarLaluRp = sisaSetoran;
        sisaLaluKurangRp = kewajibanLaluRp - sisaSetoran;
        sisaSetoran = 0;
        lunasLalu = false;
      }
    }

    const detailTahunLalu: DetailTahunLaluKolom = {
      kewajibanTahunLaluRp: kewajibanLaluRp,
      kasusTahunLalu: kasusLalu,
      terbayarTahunLaluRp: terbayarLaluRp,
      sisaTunggakanTahunLaluRp: sisaLaluKurangRp,
      lunas: lunasLalu,
      keterangan: infoLalu.keterangan || "",
    };

    // 2. Alokasikan sisa setoran ke Kasus Duka Tahun Berjalan
    let totalKewajibanTahunIniRp = 0;
    let countLunasTahunIni = 0;
    const detailTahap: TahapDukaKolomDetail[] = [];
    const tahapTertunggak: number[] = [];
    const terbayarDukaIds: string[] = [];

    for (const kasus of sortedKasus) {
      const kewajiban = dapatkanTarifDukaKolom(kasus, k, rules);
      totalKewajibanTahunIniRp += kewajiban;

      if (kewajiban === 0) {
        countLunasTahunIni++;
        terbayarDukaIds.push(kasus.id);
        detailTahap.push({
          kasusId: kasus.id,
          urutan: kasus.urutan,
          nama: kasus.nama,
          tanggal: kasus.tanggal,
          kewajibanRp: 0,
          terbayarRp: 0,
          lunas: true,
          sisaKurangRp: 0,
        });
        continue;
      }

      if (sisaSetoran >= kewajiban) {
        sisaSetoran -= kewajiban;
        countLunasTahunIni++;
        terbayarDukaIds.push(kasus.id);
        detailTahap.push({
          kasusId: kasus.id,
          urutan: kasus.urutan,
          nama: kasus.nama,
          tanggal: kasus.tanggal,
          kewajibanRp: kewajiban,
          terbayarRp: kewajiban,
          lunas: true,
          sisaKurangRp: 0,
        });
      } else {
        const terbayarParsial = sisaSetoran;
        const kurang = kewajiban - terbayarParsial;
        sisaSetoran = 0;
        tahapTertunggak.push(kasus.urutan);
        detailTahap.push({
          kasusId: kasus.id,
          urutan: kasus.urutan,
          nama: kasus.nama,
          tanggal: kasus.tanggal,
          kewajibanRp: kewajiban,
          terbayarRp: terbayarParsial,
          lunas: false,
          sisaKurangRp: kurang,
        });
      }
    }

    const sisaTunggakanTahapTahunIni = totalKasus - countLunasTahunIni;
    const sisaKasusLaluTertunggak = lunasLalu ? 0 : (kasusLalu || 1);
    const totalTunggakanJumlah = sisaKasusLaluTertunggak + sisaTunggakanTahapTahunIni;

    const totalKewajibanSemuaRp = kewajibanLaluRp + totalKewajibanTahunIniRp;
    const totalSisaTunggakanSemuaRp = Math.max(0, totalKewajibanSemuaRp - totalSetorRp);

    let statusLabel = "";
    // Cek apakah ada override manual
    const ov = overrideMap[String(k)];
    if (ov && ov.trim() !== "") {
      statusLabel = ov.trim();
    } else {
      if (totalSisaTunggakanSemuaRp === 0) {
        statusLabel = "Lunas";
      } else {
        statusLabel = `${totalTunggakanJumlah} x Duka`;
      }
    }

    result[k] = {
      kolom: k,
      totalSetorRp,
      totalKewajibanRp: totalKewajibanSemuaRp,
      totalSisaTunggakanRp: totalSisaTunggakanSemuaRp,
      jumlahDukaTerbayar: countLunasTahunIni,
      totalKasusDuka: totalKasus,
      tunggakanJumlah: totalTunggakanJumlah,
      statusLabel,
      tahapTertunggak,
      detailTahunLalu,
      detailTahap,
      riwayatTrx: trxKolom,
      terbayarDukaIds,
    };
  }

  return result;
};

export const statusDuka = (data: DukaMap, kolom: number) => data[String(kolom)] ?? "Lunas";
