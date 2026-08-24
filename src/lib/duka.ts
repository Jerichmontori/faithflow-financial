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
  { id: "duka-1", urutan: 1, nama: "Alm. Denny Polii", tanggal: "2026-01-15", kolomKeluarga: 15, iuranPerKolom: 50000, keterangan: "Duka Jemaat Tahap 1 (Kolom 15)" },
  { id: "duka-2", urutan: 2, nama: "Alm. Marie Kontu", tanggal: "2026-02-03", kolomKeluarga: 24, iuranPerKolom: 50000, keterangan: "Duka Jemaat Tahap 2 (Kolom 24)" },
  { id: "duka-3", urutan: 3, nama: "Alm. Jenap Salindeho", tanggal: "2026-02-23", kolomKeluarga: 4, iuranPerKolom: 50000, keterangan: "Duka Jemaat Tahap 3 (Kolom 4)" },
  { id: "duka-4", urutan: 4, nama: "Alm. Anita Poluan", tanggal: "2026-03-05", kolomKeluarga: 26, iuranPerKolom: 50000, keterangan: "Duka Jemaat Tahap 4 (Kolom 26)" },
  { id: "duka-5", urutan: 5, nama: "Alm. Filma Takashaeng", tanggal: "2026-03-20", kolomKeluarga: 26, iuranPerKolom: 50000, keterangan: "Duka Jemaat Tahap 5 (Kolom 26)" },
  { id: "duka-6", urutan: 6, nama: "Alm. Novelia Wangka", tanggal: "2026-04-24", kolomKeluarga: 3, iuranPerKolom: 50000, keterangan: "Duka Jemaat Tahap 6 (Kolom 3)" },
  { id: "duka-7", urutan: 7, nama: "Alma. Belladona Raitung", tanggal: "2026-06-05", kolomKeluarga: 1, iuranPerKolom: 50000, keterangan: "Duka Jemaat Tahap 7 (Kolom 1)" },
  { id: "duka-8", urutan: 8, nama: "Alm. Juventio Pua", tanggal: "2026-06-05", kolomKeluarga: 10, iuranPerKolom: 50000, keterangan: "Duka Jemaat Tahap 8 (Kolom 10)" },
  { id: "duka-9", urutan: 9, nama: "Alm. Natalio Peea", tanggal: "2026-06-11", kolomKeluarga: 12, iuranPerKolom: 50000, keterangan: "Duka Jemaat Tahap 9 (Kolom 12)" },
  { id: "duka-10", urutan: 10, nama: "Alma. Donna Manoy", tanggal: "2026-06-20", kolomKeluarga: 9, iuranPerKolom: 50000, keterangan: "Duka Jemaat Tahap 10 (Kolom 9)" },
  { id: "duka-11", urutan: 11, nama: "Alma. Pince Ate", tanggal: "2026-07-01", kolomKeluarga: 23, iuranPerKolom: 50000, keterangan: "Duka Jemaat Tahap 11 (Kolom 23)" },
  { id: "duka-12", urutan: 12, nama: "Alm. Judson Sindar", tanggal: "2026-07-10", kolomKeluarga: 8, iuranPerKolom: 50000, keterangan: "Duka Jemaat Tahap 12 (Kolom 8)" },
  { id: "duka-13", urutan: 13, nama: "Duka Jemaat Tahap 13", tanggal: "2026-08-01", kolomKeluarga: null, iuranPerKolom: 50000, keterangan: "Duka Jemaat Tahap 13" },
];

/** Standar default tarif 29 kolom */
export const buatDefaultTarifKolom = (nominal = DEFAULT_TARIF_DUKA): Record<number, number> => {
  const res: Record<number, number> = {};
  for (const k of DUKA_KOLOM) {
    res[k] = nominal;
  }
  return res;
};

export const TARIF_29_KOLOM_STANDAR: Record<number, number> = {
  1: 60000,
  2: 66000,
  3: 66000,
  4: 54000,
  5: 51000,
  6: 75000,
  7: 75000,
  8: 42000,
  9: 60000,
  10: 90000,
  11: 66000,
  12: 69000,
  13: 72000,
  14: 75000,
  15: 48000,
  16: 57000,
  17: 60000,
  18: 75000,
  19: 90000,
  20: 69000,
  21: 63000,
  22: 75000,
  23: 75000,
  24: 75000,
  25: 75000,
  26: 66000,
  27: 78000,
  28: 84000,
  29: 75000,
};

export const DEFAULT_TARIF_RULES: TarifKolomRule[] = [
  {
    id: "rule-standar-29-kolom",
    namaAturan: "Ketetapan Tarif 29 Kolom",
    mulaiTahap: 1,
    sampaiTahap: null,
    tarifPerKolom: TARIF_29_KOLOM_STANDAR,
    keterangan: "Tarif iuran per kolom resmi GMIM Bukit Moria Tikala Baru",
  },
];

import { supabase } from "@/integrations/supabase/client";

export const notifyDukaChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("bumotik_duka_updated"));
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel("bumotik_realtime_sync");
      bc.postMessage({ type: "duka_updated" });
      bc.close();
    } catch {}
  }
};

export const syncDukaToDatabase = async () => {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      daftar_duka: bacaDaftarDuka(),
      tarif_rules: bacaTarifRules(),
      tunggakan_lalu: bacaTunggakanTahunLalu(),
      duka_map: bacaDuka(),
    };
    await supabase.from("app_settings").upsert([
      {
        key: "dana_duka_data",
        value: payload,
        updated_at: new Date().toISOString(),
      },
    ]);
  } catch (err) {
    console.error("Gagal sinkronisasi dana duka ke database:", err);
  }
};

export const tarikDukaDariDatabase = async () => {
  if (typeof window === "undefined") return;
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "dana_duka_data")
      .maybeSingle();

    if (!error && data?.value) {
      const v = data.value as any;
      if (Array.isArray(v.daftar_duka)) {
        localStorage.setItem(DAFTAR_DUKA_KEY, JSON.stringify(v.daftar_duka));
      }
      if (Array.isArray(v.tarif_rules)) {
        localStorage.setItem(DUKA_RULES_KEY, JSON.stringify(v.tarif_rules));
      }
      if (v.tunggakan_lalu && typeof v.tunggakan_lalu === "object") {
        localStorage.setItem(DUKA_TAHUN_LALU_KEY, JSON.stringify(v.tunggakan_lalu));
      }
      if (v.duka_map && typeof v.duka_map === "object") {
        localStorage.setItem(DUKA_KEY, JSON.stringify(v.duka_map));
      }
      notifyDukaChanged();
    }
  } catch (err) {
    console.error("Gagal tarik dana duka dari database:", err);
  }
};

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
    notifyDukaChanged();
    syncDukaToDatabase();
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
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_TARIF_RULES;

    const baseIndex = parsed.findIndex((r: any) => r.id === "rule-standar-29-kolom" || r.mulaiTahap === 1);
    if (baseIndex === -1) {
      return [...DEFAULT_TARIF_RULES, ...parsed];
    } else {
      const baseRule = parsed[baseIndex];
      const mergedTarif = { ...TARIF_29_KOLOM_STANDAR, ...(baseRule.tarifPerKolom || {}) };
      parsed[baseIndex] = {
        ...baseRule,
        id: "rule-standar-29-kolom",
        namaAturan: baseRule.namaAturan || "Ketetapan Standar Tarif 29 Kolom",
        mulaiTahap: 1,
        tarifPerKolom: mergedTarif,
        keterangan: "Mulai Tahap 1: Berlaku untuk semua 29 Kolom",
      };
      return parsed;
    }
  } catch {
    return DEFAULT_TARIF_RULES;
  }
};

/** Menyimpan aturan tarif kolom dinamis */
export const simpanTarifRules = (rules: TarifKolomRule[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DUKA_RULES_KEY, JSON.stringify(rules));
    notifyDukaChanged();
    syncDukaToDatabase();
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
    notifyDukaChanged();
    syncDukaToDatabase();
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
  notifyDukaChanged();
  syncDukaToDatabase();
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
  for (const r of sortedRules) {
    if (
      kasus.urutan >= r.mulaiTahap &&
      (r.sampaiTahap === null || r.sampaiTahap === undefined || kasus.urutan <= r.sampaiTahap)
    ) {
      if (typeof r.tarifPerKolom[kolom] === "number" && r.tarifPerKolom[kolom] > 0) {
        return r.tarifPerKolom[kolom];
      }
    }
  }

  if (TARIF_29_KOLOM_STANDAR[kolom] && TARIF_29_KOLOM_STANDAR[kolom] > 0) {
    return TARIF_29_KOLOM_STANDAR[kolom];
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
