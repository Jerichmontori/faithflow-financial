import { parseKolom } from "@/lib/kolom";
import type { Transaction } from "@/lib/queries";

export const DUKA_KEY = "bumotik.danaDuka";
export const DAFTAR_DUKA_KEY = "bumotik.daftarKasusDuka_v1";
export const DUKA_TARIF_KEY = "bumotik.tarifDukaPerKolom";

export const DUKA_KOLOM = Array.from({ length: 29 }, (_, i) => i + 1);

export interface KasusDuka {
  id: string;
  urutan: number;
  nama: string; // contoh: "Alm. Bpk. John Doe (Kel. Doe - Sumual)"
  tanggal: string; // YYYY-MM-DD
  kolomKeluarga?: number | null;
  iuranPerKolom: number; // default: 50000 atau sesuai ketetapan sidang
  keterangan?: string;
}

export type DukaMap = Record<string, string>;

export const DEFAULT_TARIF_DUKA = 50000;

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

export interface KolomDukaSummary {
  kolom: number;
  totalSetorRp: number;
  jumlahDukaTerbayar: number;
  totalKasusDuka: number;
  tunggakanJumlah: number; // berapa duka yang belum dibayar
  statusLabel: string; // "Lunas" atau "1 x Duka", "2 x Duka", dst
  riwayatTrx: Transaction[];
  terbayarDukaIds: string[];
}

/**
 * Otomatis menghitung status tunggakan duka per kolom berdasarkan transaksi riil dan daftar kasus duka
 */
export const hitungSemuaTunggakanDuka = (
  transactions: Transaction[],
  daftarDuka: KasusDuka[],
  overrideMap: DukaMap = {}
): Record<number, KolomDukaSummary> => {
  const result: Record<number, KolomDukaSummary> = {};
  const totalKasus = daftarDuka.length;

  // Filter semua transaksi duka
  const dukaTrx = transactions.filter(isTransaksiDuka);

  // Default tarif per duka jika tidak ditentukan
  const defaultTarif = daftarDuka[0]?.iuranPerKolom || DEFAULT_TARIF_DUKA;

  for (const k of DUKA_KOLOM) {
    // Cari transaksi untuk kolom k
    const trxKolom = dukaTrx.filter((t) => {
      const parsed = parseKolom(t.description || t.payee || "");
      return parsed === k;
    });

    const totalSetorRp = trxKolom.reduce((acc, t) => acc + Number(t.amount || 0), 0);

    // Hitung berapa duka yang terbayar dari nominal atau jumlah transaksi
    let terbayar = 0;
    if (defaultTarif > 0) {
      terbayar = Math.floor(totalSetorRp / defaultTarif);
    } else {
      terbayar = trxKolom.length;
    }

    if (terbayar > totalKasus) terbayar = totalKasus;

    const sisaTunggakan = Math.max(0, totalKasus - terbayar);

    let statusLabel = "";
    // Cek apakah ada override manual
    const ov = overrideMap[String(k)];
    if (ov && ov.trim() !== "") {
      statusLabel = ov.trim();
    } else {
      if (totalKasus === 0 || sisaTunggakan === 0) {
        statusLabel = "Lunas";
      } else {
        statusLabel = `${sisaTunggakan} x Duka`;
      }
    }

    result[k] = {
      kolom: k,
      totalSetorRp,
      jumlahDukaTerbayar: terbayar,
      totalKasusDuka: totalKasus,
      tunggakanJumlah: sisaTunggakan,
      statusLabel,
      riwayatTrx: trxKolom,
      terbayarDukaIds: daftarDuka.slice(0, terbayar).map((d) => d.id),
    };
  }

  return result;
};

export const statusDuka = (data: DukaMap, kolom: number) => data[String(kolom)] ?? "Lunas";
