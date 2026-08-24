import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Printer, FileDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  transactionsQuery,
  isInternalCash,
  isReklas,
  isCashPayment,
  isBankPayment,
  type Transaction,
} from "@/lib/queries";
import { rupiah } from "@/lib/format";
import { exportAoa, type Cell } from "@/lib/xlsx";
import {
  DUKA_KOLOM,
  bacaDuka,
  bacaDaftarDuka,
  bacaTarifRules,
  bacaTunggakanTahunLalu,
  hitungSemuaTunggakanDuka,
  type DukaMap,
  type KasusDuka,
  type TarifKolomRule,
  type TunggakanTahunLaluMap,
} from "@/lib/duka";
import { useAppSettings } from "@/lib/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/warta")({
  head: () => ({
    meta: [
      { title: "Warta Keuangan Mingguan — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Warta keuangan jemaat: rincian penerimaan dan pengeluaran kas mingguan, rekapitulasi dana rutin & simpanan bank, format warta resmi BUMOTIK.",
      },
      { property: "og:title", content: "Warta Keuangan Mingguan — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Laporan penerimaan & pengeluaran kas jemaat per minggu, format warta resmi BUMOTIK.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WartaPage,
});

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const BULAN = [
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
];

const tglPanjang = (s: string) => {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return `${d} ${BULAN[(m ?? 1) - 1]} ${y}`;
};

const tglPendek = (s: string) => {
  if (!s) return "";
  const [, m, d] = s.split("-").map(Number);
  const b = BULAN[(m ?? 1) - 1] ?? "";
  const bShort = b === "Agustus" ? "Agust" : b.slice(0, 4);
  return `${d} ${bShort}`;
};

/** Format angka tabel warta tanpa label "Rp" sesuai cetakan resmi */
const angka = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (isNaN(n) || n === 0) return "";
  return new Intl.NumberFormat("id-ID").format(n);
};

const angkaSaldo = (value: number | string | null | undefined) => {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID").format(n);
};

/** Senin minggu berjalan */
const seninIni = () => {
  const d = new Date();
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return iso(d);
};
const plusHari = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
};

type Baris =
  | { tipe: "grup"; nama: string; key: string; tanggal: string | null }
  | { tipe: "trx"; trx: Transaction; key: string; saldo: number };

function WartaPage() {
  const trx = useQuery(transactionsQuery);
  const { settings, updateSettings } = useAppSettings();
  const [dari, setDari] = useState(seninIni);
  const [sampai, setSampai] = useState(() => plusHari(seninIni(), 4));
  const [ketua, setKetua] = useState(settings.namaKetuaBpmj || "Pdt. Handry Mecky Dengah, M.Th");
  const [bendahara, setBendahara] = useState(settings.namaBendahara || "Dkn. Jerich Montori");
  const [tempat, setTempat] = useState(settings.kotaSurat || "Manado");
  const [saldoAwalBank, setSaldoAwalBank] = useState(() => String(settings.saldoAwalBank ?? 0));
  const [duka, setDuka] = useState<DukaMap>({});
  const [daftarDuka, setDaftarDuka] = useState<KasusDuka[]>([]);
  const [tarifRules, setTarifRules] = useState<TarifKolomRule[]>([]);
  const [tunggakanLaluMap, setTunggakanLaluMap] = useState<TunggakanTahunLaluMap>({});

  // Layout Cetak 1/2 Halaman Landscape & Skala 62%
  const [layoutCetak, setLayoutCetak] = useState<"setengah" | "ganda" | "penuh">("setengah");
  const [scale, setScale] = useState<number>(62);

  useEffect(() => {
    setSaldoAwalBank(String(settings.saldoAwalBank ?? 0));
    setKetua(settings.namaKetuaBpmj || "Pdt. Handry Mecky Dengah, M.Th");
    setBendahara(settings.namaBendahara || "Dkn. Jerich Montori");
    setTempat(settings.kotaSurat || "Manado");
  }, [settings]);

  useEffect(() => {
    setDuka(bacaDuka());
    setDaftarDuka(bacaDaftarDuka());
    setTarifRules(bacaTarifRules());
    setTunggakanLaluMap(bacaTunggakanTahunLalu());

    const handleDukaUpdate = () => {
      setDuka(bacaDuka());
      setDaftarDuka(bacaDaftarDuka());
      setTarifRules(bacaTarifRules());
      setTunggakanLaluMap(bacaTunggakanTahunLalu());
    };
    window.addEventListener("bumotik_duka_updated", handleDukaUpdate);
    return () => window.removeEventListener("bumotik_duka_updated", handleDukaUpdate);
  }, []);

  const simpanSaldoBank = (v: string) => {
    setSaldoAwalBank(v);
    const num = Number(v.replace(/[^\d-]/g, "")) || 0;
    updateSettings({ saldoAwalBank: num });
    localStorage.setItem("bumotik.saldoAwalBank", String(num));
  };

  const all = trx.data ?? [];

  const saldoAwal = useMemo(
    () =>
      all
        .filter((t) => t.trx_date < dari && isCashPayment(t) && t.status !== "rejected")
        .reduce((a, t) => a + (t.kind === "penerimaan" ? Number(t.amount) : -Number(t.amount)), 0),
    [all, dari],
  );

  /** Mutasi bank: setoran & penerimaan transfer = bank masuk; tarikan & pengeluaran transfer = bank keluar */
  const bankMutasi = (list: Transaction[]) =>
    list
      .filter((t) => !isReklas(t) && t.status !== "rejected")
      .reduce(
        (acc, t) => {
          const n = Number(t.amount);
          if (t.budget_lines?.code === "2.2.22.22" || (t.kind === "penerimaan" && isBankPayment(t))) {
            acc.masuk += n;
          } else if (t.budget_lines?.code === "1.1.11.11" || (t.kind === "pengeluaran" && isBankPayment(t))) {
            acc.keluar += n;
          }
          return acc;
        },
        { masuk: 0, keluar: 0 },
      );

  const bankSebelum = useMemo(() => bankMutasi(all.filter((t) => t.trx_date < dari)), [all, dari]);
  const bankAwal = Number(saldoAwalBank || 0) + bankSebelum.masuk - bankSebelum.keluar;

  const rentang = useMemo(
    () =>
      all
        .filter((t) => t.trx_date >= dari && t.trx_date <= sampai && t.status !== "rejected")
        .sort(
          (a, b) =>
            a.trx_date.localeCompare(b.trx_date) ||
            (a.kind === "pengeluaran" ? 1 : 0) - (b.kind === "pengeluaran" ? 1 : 0) ||
            (a.budget_lines?.code ?? "").localeCompare(b.budget_lines?.code ?? "") ||
            a.voucher_no.localeCompare(b.voucher_no),
        ),
    [all, dari, sampai],
  );

  const bankMinggu = useMemo(() => bankMutasi(rentang), [rentang]);
  const bankAkhir = bankAwal + bankMinggu.masuk - bankMinggu.keluar;

  const { baris, totalMasuk, totalKeluar } = useMemo(() => {
    const out: Baris[] = [];
    let saldo = saldoAwal;
    let masuk = 0;
    let keluar = 0;
    let tglAktif = "";
    let grupAktif = "";

    for (const t of rentang) {
      let tanggalBaris: string | null = null;
      if (t.trx_date !== tglAktif) {
        tglAktif = t.trx_date;
        grupAktif = "";
        tanggalBaris = t.trx_date;
      }
      const nama = t.budget_lines ? t.budget_lines.name : t.category || "Lain-lain";
      if (nama !== grupAktif) {
        grupAktif = nama;
        out.push({ tipe: "grup", nama, key: `g-${t.id}`, tanggal: tanggalBaris });
      }
      const nilai = Number(t.amount);
      if (isCashPayment(t)) {
        if (t.kind === "penerimaan") {
          saldo += nilai;
          masuk += nilai;
        } else {
          saldo -= nilai;
          keluar += nilai;
        }
      }
      out.push({ tipe: "trx", trx: t, key: t.id, saldo });
    }
    return { baris: out, totalMasuk: masuk, totalKeluar: keluar };
  }, [rentang, saldoAwal]);

  const saldoAkhir = saldoAwal + totalMasuk - totalKeluar;

  const rekap = [
    { no: "1.", label: "Saldo Minggu Lalu", rutin: saldoAwal, bank: bankAwal },
    { no: "2.", label: "Penerimaan Minggu ini", rutin: totalMasuk, bank: bankMinggu.masuk },
    { no: "3.", label: "Pengeluaran Minggu ini", rutin: totalKeluar, bank: bankMinggu.keluar },
    { no: "4.", label: "Saldo Kas Minggu ini", rutin: saldoAkhir, bank: bankAkhir },
  ];

  const ringkasanDuka = useMemo(() => {
    return hitungSemuaTunggakanDuka(all, daftarDuka, duka, tarifRules, tunggakanLaluMap);
  }, [all, daftarDuka, duka, tarifRules, tunggakanLaluMap]);

  function exportExcel() {
    const data: (string | number)[][] = [
      [`${settings.namaGereja || "GEREJA MASEHI INJILI DI MINAHASA (GMIM)"}`],
      [`${settings.namaJemaat || "JEMAAT BUKIT MORIA TIKALA BARU"}`],
      [`${settings.wilayah || "WILAYAH MANADO WAWONASA KOMBOS"}`],
      ["WARTA KEUANGAN JEMAAT"],
      [`Periode: ${tglPanjang(dari)} s/d ${tglPanjang(sampai)}`],
      [],
      ["No", "KETERANGAN / POS ANGGARAN", "PENERIMAAN", "PENGELUARAN", "SALDO KAS"],
      ["#", `SALDO AWAL KAS FISIK (s/d ${tglPanjang(plusHari(dari, -1))})`, "", "", saldoAwal],
      ...baris.map((b) =>
        b.tipe === "grup"
          ? ["", b.nama, "", "", b.tanggal ? tglPanjang(b.tanggal) : ""]
          : [
              b.trx.voucher_no.replace(/^KM-\d{4}-|^KK-\d{4}-/, ""),
              `${b.trx.description}${b.trx.budget_lines ? ` (${b.trx.budget_lines.code})` : ""}`,
              b.trx.kind === "penerimaan" ? Number(b.trx.amount) : "",
              b.trx.kind === "pengeluaran" ? Number(b.trx.amount) : "",
              b.saldo,
            ],
      ),
      ["TOTAL", "", totalMasuk, totalKeluar, saldoAkhir],
      [],
      ["REKAPITULASI"],
      ["No", "Uraian", "DANA RUTIN", "SIMPANAN BANK", "JUMLAH"],
      ...rekap.map((r) => [r.no, r.label, r.rutin, r.bank, r.rutin + r.bank]),
      [],
      ["Terima kasih kepada seluruh jemaat dan para tamu yang telah berpartispasi memberikan persembahan,"],
      ["baik dalam bentuk Persembahan Persepuluhan, serta Persembahan Syukur lainnya."],
      ["Tuhan Yesus Memberkati."],
      [],
      ["", `${tempat}, ${tglPanjang(sampai)}`],
      ["BADAN PEKERJA MAJELIS JEMAAT"],
      ["Ketua", "Bendahara"],
      [ketua, bendahara],
      [],
      ["* Jika ada persembahan-persembahan yang sudah diberikan, tetapi belum tercantum/masuk dalam Warta Jemaat ini"],
      ["dapat diklarifikasikan dikantor jemaat pada waktu jam kerja *"],
      [],
      ["DANA DIAKONIA DUKA JEMAAT"],
      ["Kolom", "Tunggakan", "Kolom", "Tunggakan", "Kolom", "Tunggakan"],
      ...Array.from({ length: 10 }, (_, i) => {
        const k1 = i + 1;
        const k2 = i + 11;
        const k3 = i + 21;
        return [
          k1 <= 29 ? `Kolom ${k1}` : "",
          k1 <= 29 ? (ringkasanDuka[k1]?.statusLabel || "Lunas") : "",
          k2 <= 29 ? `Kolom ${k2}` : "",
          k2 <= 29 ? (ringkasanDuka[k2]?.statusLabel || "Lunas") : "",
          k3 <= 29 ? `Kolom ${k3}` : "",
          k3 <= 29 ? (ringkasanDuka[k3]?.statusLabel || "Lunas") : "",
        ];
      }),
    ];

    exportAoa(
      data,
      `Warta-Keuangan-${dari}-sd-${sampai}.xlsx`,
      "warta",
      [14, 52, 18, 18, 20, 20],
    );
  }

  return (
    <AppShell
      title="Warta Keuangan Mingguan"
      subtitle={`${tglPanjang(dari)} s/d ${tglPanjang(sampai)} · ${rentang.length} transaksi`}
      actions={
        <div className="no-print flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <FileDown className="mr-2 h-4 w-4" /> Export Excel (Warta)
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Cetak Warta
          </Button>
        </div>
      }
    >
      <div className="panel no-print mb-4 p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-1.5">
            <Label htmlFor="dari">Tanggal Mulai</Label>
            <Input id="dari" type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sampai">Tanggal Selesai</Label>
            <Input
              id="sampai"
              type="date"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bank">Saldo Awal Bank</Label>
            <Input
              id="bank"
              inputMode="numeric"
              value={saldoAwalBank}
              onChange={(e) => simpanSaldoBank(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tempat">Tempat</Label>
            <Input id="tempat" value={tempat} onChange={(e) => setTempat(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ketua">Ketua BPMJ</Label>
            <Input id="ketua" value={ketua} onChange={(e) => setKetua(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bendahara">Bendahara BPMJ</Label>
            <Input
              id="bendahara"
              value={bendahara}
              onChange={(e) => setBendahara(e.target.value)}
            />
          </div>
        </div>

        {/* Pengaturan Format Cetak: 1/2 Halaman Landscape & Scale 62% */}
        <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-foreground">Format Cetak Landscape:</span>
            <div className="inline-flex rounded-lg border p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={() => setLayoutCetak("setengah")}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  layoutCetak === "setengah"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                1/2 Halaman (Landscape)
              </button>
              <button
                type="button"
                onClick={() => setLayoutCetak("ganda")}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  layoutCetak === "ganda"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                2 Salinan (Kiri & Kanan)
              </button>
              <button
                type="button"
                onClick={() => setLayoutCetak("penuh")}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  layoutCetak === "penuh"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                1 Halaman Penuh
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="scale" className="font-semibold text-xs text-muted-foreground">
              Skala Cetak:
            </Label>
            <Input
              id="scale"
              type="number"
              min="30"
              max="100"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value) || 62)}
              className="w-16 h-8 text-xs font-mono font-bold"
            />
            <span className="text-xs text-muted-foreground">%</span>
            {scale !== 62 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setScale(62)}
                className="h-8 text-[11px] px-2 text-primary"
              >
                Set 62%
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="warta-area panel overflow-x-auto p-4 sm:p-6 bg-white text-black">
        {layoutCetak === "ganda" ? (
          <div className="warta-half-layout flex justify-between gap-6 w-full">
            <div className="warta-sheet-half flex-1" style={{ zoom: `${scale}%` }}>
              {renderWartaSheet("Salinan 1 (Kiri)")}
            </div>
            <div className="warta-sheet-half flex-1 border-l-2 border-dashed border-gray-300 pl-6" style={{ zoom: `${scale}%` }}>
              {renderWartaSheet("Salinan 2 (Kanan)")}
            </div>
          </div>
        ) : layoutCetak === "setengah" ? (
          <div className="warta-half-layout flex justify-start w-full">
            <div className="warta-sheet-half w-full sm:w-[49%]" style={{ zoom: `${scale}%` }}>
              {renderWartaSheet()}
            </div>
          </div>
        ) : (
          <div className="warta-sheet-full max-w-5xl mx-auto" style={{ zoom: `${scale}%` }}>
            {renderWartaSheet()}
          </div>
        )}
      </div>
    </AppShell>
  );

  function renderWartaSheet(tagSalinan?: string) {
    return (
      <div className="warta-content space-y-3">
        <div className="text-center pb-2 mb-2 border-b-2 border-black/80">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold uppercase tracking-wider text-black">
              WARTA KEUANGAN
            </h1>
            {tagSalinan && (
              <span className="text-[10px] uppercase font-bold text-gray-500 border border-gray-300 px-1.5 py-0.5 rounded">
                {tagSalinan}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm font-semibold mt-0.5 text-black/90">
            Laporan Penerimaan &amp; Pengeluaran Kas Jemaat Tanggal {tglPanjang(dari)} S/d {tglPanjang(sampai)}
          </p>
        </div>

        <table className="warta-table mt-2 w-full border-collapse">
          <thead>
            <tr className="bg-muted/40 border-y border-black/70 text-black font-bold">
              <th className="w-16 text-left py-1 px-1.5">Tgl</th>
              <th className="text-left py-1 px-1.5">Uraian</th>
              <th className="w-24 sm:w-28 text-right py-1 px-1.5">Masuk (Rp)</th>
              <th className="w-24 sm:w-28 text-right py-1 px-1.5">Keluar (Rp)</th>
              <th className="w-24 sm:w-32 text-right py-1 px-1.5">Saldo (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {/* Row 1: Saldo Awal */}
            <tr className="border-b border-border/80">
              <td className="py-0.5 px-1.5" />
              <td className="py-0.5 px-1.5 font-bold text-black">Saldo Awal</td>
              <td className="py-0.5 px-1.5 text-right" />
              <td className="py-0.5 px-1.5 text-right" />
              <td className="py-0.5 px-1.5 text-right font-mono font-bold text-black">
                {angkaSaldo(saldoAwal)}
              </td>
            </tr>

            {/* Data Rows */}
            {baris.map((b) =>
              b.tipe === "grup" ? (
                <tr key={b.key} className="border-b border-border/80 bg-muted/10 font-bold">
                  <td className="py-0.5 px-1.5 whitespace-nowrap font-bold text-black align-top">
                    {b.tanggal ? tglPendek(b.tanggal) : ""}
                  </td>
                  <td className="py-0.5 px-1.5 font-bold text-black">
                    {b.nama}
                  </td>
                  <td className="py-0.5 px-1.5 text-right" />
                  <td className="py-0.5 px-1.5 text-right" />
                  <td className="py-0.5 px-1.5 text-right" />
                </tr>
              ) : (
                <tr key={b.key} className="border-b border-border/60 hover:bg-muted/10">
                  <td className="py-0.5 px-1.5" />
                  <td className="py-0.5 px-1.5 pl-4 text-xs text-black">
                    {b.trx.description || b.trx.payee || b.trx.voucher_no}
                    {b.trx.koreksi_catatan && (
                      <span className="ml-1 text-[10px] italic text-muted-foreground">
                        [{b.trx.koreksi_catatan}]
                      </span>
                    )}
                  </td>
                  <td className="py-0.5 px-1.5 text-right text-xs font-mono text-black">
                    {b.trx.kind === "penerimaan" ? angka(b.trx.amount) : ""}
                  </td>
                  <td className="py-0.5 px-1.5 text-right text-xs font-mono text-black">
                    {b.trx.kind === "pengeluaran" ? angka(b.trx.amount) : ""}
                  </td>
                  <td className="py-0.5 px-1.5 text-right text-xs font-mono text-black">
                    {angkaSaldo(b.saldo)}
                  </td>
                </tr>
              ),
            )}

            {baris.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  {trx.isLoading ? "Memuat data…" : "Tidak ada transaksi pada rentang tanggal ini."}
                </td>
              </tr>
            )}

            {/* Total Row */}
            <tr className="bg-muted/30 font-bold border-t-2 border-black/70">
              <td className="py-1 px-1.5" />
              <td className="py-1 px-1.5 font-bold text-black">TOTAL</td>
              <td className="py-1 px-1.5 text-right font-mono font-bold text-black">
                {angkaSaldo(totalMasuk)}
              </td>
              <td className="py-1 px-1.5 text-right font-mono font-bold text-black">
                {angkaSaldo(totalKeluar)}
              </td>
              <td className="py-1 px-1.5 text-right font-mono font-bold text-black">
                {angkaSaldo(saldoAkhir)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black">Rekapitulasi</p>
          <table className="warta-table mt-1 w-full border-collapse">
            <thead>
              <tr className="bg-muted/30 border-y border-black/60 font-bold text-black">
                <th className="w-8 text-center py-0.5 px-1">No</th>
                <th className="text-left py-0.5 px-1.5">Uraian</th>
                <th className="w-28 text-right py-0.5 px-1.5">DANA RUTIN</th>
                <th className="w-28 text-right py-0.5 px-1.5">SIMPANAN BANK</th>
                <th className="w-28 text-right py-0.5 px-1.5">JUMLAH</th>
              </tr>
            </thead>
            <tbody>
              {rekap.map((r) => (
                <tr key={r.no} className={`border-b border-border/80 ${r.no === "4." ? "bg-muted/20 font-bold text-black" : ""}`}>
                  <td className="text-center py-0.5 px-1">{r.no}</td>
                  <td className="py-0.5 px-1.5 font-medium text-black">{r.label}</td>
                  <td className="text-right py-0.5 px-1.5 font-mono text-black">{angkaSaldo(r.rutin)}</td>
                  <td className="text-right py-0.5 px-1.5 font-mono text-black">{angkaSaldo(r.bank)}</td>
                  <td className="text-right py-0.5 px-1.5 font-mono font-bold text-black">{angkaSaldo(r.rutin + r.bank)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-[11px] leading-relaxed">
          <p>
            Terima kasih kepada seluruh jemaat dan para tamu yang telah berpartispasi memberikan
            persembahan, baik dalam bentuk Persembahan Persepuluhan, serta Persembahan Syukur lainnya.
          </p>
          <p className="font-medium">Tuhan Yesus Memberkati.</p>
        </div>

        <div className="mt-3 text-[11px]">
          <p className="text-right">
            {tempat}, {tglPanjang(sampai)}
          </p>
          <p className="mt-1 text-center font-bold uppercase tracking-wider">
            BADAN PEKERJA MAJELIS JEMAAT
          </p>
          <div className="mt-2 flex justify-between text-center">
            <div className="w-1/2">
              <p className="font-semibold">Ketua</p>
              <p className="mt-8 font-bold underline">{ketua}</p>
            </div>
            <div className="w-1/2">
              <p className="font-semibold">Bendahara</p>
              <p className="mt-8 font-bold underline">{bendahara}</p>
            </div>
          </div>
        </div>

        <p className="mt-2 text-[9.5px] italic text-muted-foreground text-center">
          * Jika ada persembahan-persembahan yang sudah diberikan, tetapi belum tercantum/masuk dalam Warta Jemaat ini
          dapat diklarifikasikan di kantor jemaat pada waktu jam kerja *
        </p>

        <div className="mt-4 border-t pt-2">
          <p className="text-xs font-bold uppercase tracking-wide text-black">DANA DIAKONIA DUKA JEMAAT</p>
          <table className="warta-table mt-1 w-full text-[10.5px]">
            <thead>
              <tr className="bg-muted/30 border-y border-black/60">
                <th className="w-14">Kolom</th>
                <th className="text-left">Tunggakan</th>
                <th className="w-14">Kolom</th>
                <th className="text-left">Tunggakan</th>
                <th className="w-14">Kolom</th>
                <th className="text-left">Tunggakan</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, i) => {
                const k1 = i + 1;
                const k2 = i + 11;
                const k3 = i + 21;
                return (
                  <tr key={i} className="border-b border-border/80">
                    <td className="font-semibold text-center">{k1 <= 29 ? `Kolom ${k1}` : ""}</td>
                    <td>{k1 <= 29 ? (ringkasanDuka[k1]?.statusLabel || "Lunas") : ""}</td>
                    <td className="font-semibold text-center">{k2 <= 29 ? `Kolom ${k2}` : ""}</td>
                    <td>{k2 <= 29 ? (ringkasanDuka[k2]?.statusLabel || "Lunas") : ""}</td>
                    <td className="font-semibold text-center">{k3 <= 29 ? `Kolom ${k3}` : ""}</td>
                    <td>{k3 <= 29 ? (ringkasanDuka[k3]?.statusLabel || "Lunas") : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}
