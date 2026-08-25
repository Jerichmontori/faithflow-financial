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
  tarikDukaDariDatabase,
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
import { Badge } from "@/components/ui/badge";


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

import { useSession } from "@/hooks/use-session";

export function WartaContent({ isPelsusView = false }: { isPelsusView?: boolean }) {
  const trx = useQuery(transactionsQuery);
  const { settings, updateSettings } = useAppSettings();
  const { isReadOnly } = useSession();
  const [dari, setDari] = useState(seninIni);
  const [sampai, setSampai] = useState(() => plusHari(seninIni(), 4));
  const [ketua, setKetua] = useState(settings.namaKetuaBpmj || "Pdt. Handry Mecky Dengah, M.Th");
  const [bendahara, setBendahara] = useState(settings.namaBendahara || "Dkn. Jerich Montori");
  const [tempat, setTempat] = useState(settings.kotaSurat || "Manado");
  const [saldoAwalBank, setSaldoAwalBank] = useState(() => String(settings.saldoAwalBank ?? 0));
  const [duka, setDuka] = useState<DukaMap>(() => bacaDuka());
  const [daftarDuka, setDaftarDuka] = useState<KasusDuka[]>(() => bacaDaftarDuka());
  const [tarifRules, setTarifRules] = useState<TarifKolomRule[]>(() => bacaTarifRules());
  const [tunggakanLaluMap, setTunggakanLaluMap] = useState<TunggakanTahunLaluMap>(() => bacaTunggakanTahunLalu());

  // Layout Cetak 1/2 Halaman Landscape & Skala 62%
  const [layoutCetak, setLayoutCetak] = useState<"setengah" | "ganda" | "penuh">("setengah");
  const [scale, setScale] = useState<number>(62);

  // Mode Kolom Koreksi: Otomatis Sembunyi jika tidak ada / Tampilkan / Sembunyikan
  const [koreksiMode, setKoreksiMode] = useState<"auto" | "show" | "hide">("auto");

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

    // Tarik versi terkini dari cloud database
    tarikDukaDariDatabase();
    const interval = setInterval(tarikDukaDariDatabase, 10000);
    const handleFocus = () => tarikDukaDariDatabase();
    window.addEventListener("focus", handleFocus);

    const handleDukaUpdate = () => {
      setDuka(bacaDuka());
      setDaftarDuka(bacaDaftarDuka());
      setTarifRules(bacaTarifRules());
      setTunggakanLaluMap(bacaTunggakanTahunLalu());
    };
    window.addEventListener("bumotik_duka_updated", handleDukaUpdate);
    window.addEventListener("storage", handleDukaUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("bumotik_duka_updated", handleDukaUpdate);
      window.removeEventListener("storage", handleDukaUpdate);
    };
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

  const koreksiList = useMemo(() => {
    return rentang.filter((t) => Boolean(t.koreksi_catatan || t.koreksi_dari));
  }, [rentang]);

  const hasKoreksi = koreksiList.length > 0;
  const showKoreksi = koreksiMode === "show" || (koreksiMode === "auto" && hasKoreksi);

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
      showKoreksi
        ? ["No", "KETERANGAN / POS ANGGARAN", "KOREKSI", "PENERIMAAN", "PENGELUARAN", "SALDO KAS"]
        : ["No", "KETERANGAN / POS ANGGARAN", "PENERIMAAN", "PENGELUARAN", "SALDO KAS"],
      showKoreksi
        ? ["#", `SALDO AWAL KAS FISIK (s/d ${tglPanjang(plusHari(dari, -1))})`, "", "", "", saldoAwal]
        : ["#", `SALDO AWAL KAS FISIK (s/d ${tglPanjang(plusHari(dari, -1))})`, "", "", saldoAwal],
      ...baris.map((b) => {
        if (b.tipe === "grup") {
          return showKoreksi
            ? ["", b.nama, "", "", "", b.tanggal ? tglPanjang(b.tanggal) : ""]
            : ["", b.nama, "", "", b.tanggal ? tglPanjang(b.tanggal) : ""];
        }
        const catatanKoreksi = b.trx.koreksi_catatan || (b.trx.koreksi_dari ? `Koreksi: ${b.trx.koreksi_dari}` : "");
        return showKoreksi
          ? [
              b.trx.voucher_no.replace(/^KM-\d{4}-|^KK-\d{4}-/, ""),
              `${b.trx.description}${b.trx.budget_lines ? ` (${b.trx.budget_lines.code})` : ""}`,
              catatanKoreksi,
              b.trx.kind === "penerimaan" ? Number(b.trx.amount) : "",
              b.trx.kind === "pengeluaran" ? Number(b.trx.amount) : "",
              b.saldo,
            ]
          : [
              b.trx.voucher_no.replace(/^KM-\d{4}-|^KK-\d{4}-/, ""),
              `${b.trx.description}${b.trx.budget_lines ? ` (${b.trx.budget_lines.code})` : ""}`,
              b.trx.kind === "penerimaan" ? Number(b.trx.amount) : "",
              b.trx.kind === "pengeluaran" ? Number(b.trx.amount) : "",
              b.saldo,
            ];
      }),
      showKoreksi
        ? ["TOTAL", "", "", totalMasuk, totalKeluar, saldoAkhir]
        : ["TOTAL", "", totalMasuk, totalKeluar, saldoAkhir],
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
      showKoreksi ? [14, 45, 20, 18, 18, 20] : [14, 52, 18, 18, 20, 20],
    );
  }

  const renderWartaContent = () => (
    <div className="space-y-4">
      {isPelsusView && (
        <div className="no-print flex items-center justify-between gap-2 pb-2 border-b">
          <Badge variant="outline" className="text-xs font-mono">Warta Keuangan Mingguan</Badge>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportExcel} className="h-8 gap-1.5 text-xs">
              <FileDown className="size-3.5" /> Export Excel
            </Button>
            <Button size="sm" onClick={() => window.print()} className="h-8 gap-1.5 text-xs">
              <Printer className="size-3.5" /> Cetak Warta
            </Button>
          </div>
        </div>
      )}

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
          {!isPelsusView && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="bank">Saldo Awal Bank</Label>
                <Input
                  id="bank"
                  inputMode="numeric"
                  value={saldoAwalBank}
                  disabled={isReadOnly}
                  onChange={(e) => simpanSaldoBank(e.target.value.replace(/[^\d]/g, ""))}
                  className="disabled:opacity-75"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tempat">Tempat</Label>
                <Input id="tempat" value={tempat} disabled={isReadOnly} onChange={(e) => setTempat(e.target.value)} className="disabled:opacity-75" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ketua">Ketua BPMJ</Label>
                <Input id="ketua" value={ketua} disabled={isReadOnly} onChange={(e) => setKetua(e.target.value)} className="disabled:opacity-75" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bendahara">Bendahara BPMJ</Label>
                <Input
                  id="bendahara"
                  value={bendahara}
                  disabled={isReadOnly}
                  onChange={(e) => setBendahara(e.target.value)}
                  className="disabled:opacity-75"
                />
              </div>
            </>
          )}
        </div>

        {/* Pengaturan Format Cetak & Kolom Koreksi */}
        <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">Layout Cetak:</span>
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
                  1/2 Halaman
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
                  2 Salinan
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
                  Penuh
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">Kolom Koreksi:</span>
              <div className="inline-flex rounded-lg border p-0.5 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setKoreksiMode("auto")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    koreksiMode === "auto"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Otomatis muncul jika ada transaksi koreksi, sembunyi jika tidak ada"
                >
                  Otomatis {hasKoreksi ? `(${koreksiList.length} Koreksi)` : "(Tidak Ada)"}
                </button>
                <button
                  type="button"
                  onClick={() => setKoreksiMode("show")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    koreksiMode === "show"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Tampilkan
                </button>
                <button
                  type="button"
                  onClick={() => setKoreksiMode("hide")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    koreksiMode === "hide"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sembunyi
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="scale" className="font-semibold text-xs text-muted-foreground">
              Skala:
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
              {renderWartaSheet()}
            </div>
            <div className="warta-sheet-half flex-1 border-l-2 border-dashed border-gray-300 pl-6" style={{ zoom: `${scale}%` }}>
              {renderWartaSheet()}
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
    </div>
  );

  function renderWartaSheet() {
    return (
      <div className="warta-content space-y-3 text-[11pt]">
        <div className="text-center pb-2 mb-2 border-b-2 border-black/80">
          <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-black">
            WARTA KEUANGAN
          </h1>
          <p className="text-[11pt] font-semibold mt-1 text-black/90">
            Laporan Penerimaan &amp; Pengeluaran Kas Jemaat Tanggal {tglPanjang(dari)} S/d {tglPanjang(sampai)}
          </p>
        </div>

        <table className="warta-table mt-2 w-full border-collapse text-[11pt]">
          <thead>
            <tr className="bg-muted/40 border-y border-black/70 text-black font-bold text-[11pt]">
              <th className="w-16 sm:w-20 text-left py-1 px-2">Tgl</th>
              <th className="text-left py-1 px-2">Uraian</th>
              {showKoreksi && <th className="w-28 sm:w-36 text-left py-1 px-2">Koreksi</th>}
              <th className="w-24 sm:w-28 text-right py-1 px-2">Masuk (Rp)</th>
              <th className="w-24 sm:w-28 text-right py-1 px-2">Keluar (Rp)</th>
              <th className="w-24 sm:w-32 text-right py-1 px-2">Saldo (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {/* Row 1: Saldo Awal */}
            <tr className="border-b border-border/80">
              <td className="py-1 px-2" />
              <td className="py-1 px-2 font-bold text-black text-[11pt]">Saldo Awal</td>
              {showKoreksi && <td className="py-1 px-2" />}
              <td className="py-1 px-2 text-right" />
              <td className="py-1 px-2 text-right" />
              <td className="py-1 px-2 text-right font-mono font-bold text-black text-[11pt]">
                {angkaSaldo(saldoAwal)}
              </td>
            </tr>

            {/* Data Rows */}
            {baris.map((b) =>
              b.tipe === "grup" ? (
                <tr key={b.key} className="border-b border-border/80 bg-muted/10 font-bold text-[11pt]">
                  <td className="py-1 px-2 whitespace-nowrap font-bold text-black align-top">
                    {b.tanggal ? tglPendek(b.tanggal) : ""}
                  </td>
                  <td className="py-1 px-2 font-bold text-black uppercase tracking-tight">
                    {b.nama}
                  </td>
                  {showKoreksi && <td className="py-1 px-2" />}
                  <td className="py-1 px-2 text-right" />
                  <td className="py-1 px-2 text-right" />
                  <td className="py-1 px-2 text-right" />
                </tr>
              ) : (
                <tr key={b.key} className="border-b border-border/60 hover:bg-muted/10 text-[11pt]">
                  <td className="py-0.5 px-2" />
                  <td className="py-0.5 px-2 pl-5 text-[11pt] text-black">
                    {b.trx.description || b.trx.payee || b.trx.voucher_no}
                  </td>
                  {showKoreksi && (
                    <td className="py-0.5 px-2 text-[10pt] italic text-destructive font-medium">
                      {b.trx.koreksi_catatan || (b.trx.koreksi_dari ? `Koreksi: ${b.trx.koreksi_dari}` : "")}
                    </td>
                  )}
                  <td className="py-0.5 px-2 text-right text-[11pt] font-mono text-black">
                    {b.trx.kind === "penerimaan" ? angka(b.trx.amount) : ""}
                  </td>
                  <td className="py-0.5 px-2 text-right text-[11pt] font-mono text-black">
                    {b.trx.kind === "pengeluaran" ? angka(b.trx.amount) : ""}
                  </td>
                  <td className="py-0.5 px-2 text-right text-[11pt] font-mono text-black">
                    {angkaSaldo(b.saldo)}
                  </td>
                </tr>
              ),
            )}

            {baris.length === 0 && (
              <tr>
                <td colSpan={showKoreksi ? 6 : 5} className="py-6 text-center text-muted-foreground text-[11pt]">
                  {trx.isLoading ? "Memuat data…" : "Tidak ada transaksi pada rentang tanggal ini."}
                </td>
              </tr>
            )}

            {/* Total Row */}
            <tr className="bg-muted/30 font-bold border-t-2 border-black/70 text-[11pt]">
              <td className="py-1 px-2" />
              <td className="py-1 px-2 font-bold text-black">TOTAL</td>
              {showKoreksi && <td className="py-1 px-2" />}
              <td className="py-1 px-2 text-right font-mono font-bold text-black">
                {angkaSaldo(totalMasuk)}
              </td>
              <td className="py-1 px-2 text-right font-mono font-bold text-black">
                {angkaSaldo(totalKeluar)}
              </td>
              <td className="py-1 px-2 text-right font-mono font-bold text-black">
                {angkaSaldo(saldoAkhir)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 text-[11pt]">
          <p className="text-[11pt] font-bold uppercase tracking-wide text-black">Rekapitulasi</p>
          <table className="warta-table mt-1 w-full border-collapse text-[11pt]">
            <thead>
              <tr className="bg-muted/30 border-y border-black/60 font-bold text-black">
                <th className="w-10 text-center py-1 px-1.5">No</th>
                <th className="text-left py-1 px-2">Uraian</th>
                <th className="w-32 sm:w-36 text-right py-1 px-2">DANA RUTIN</th>
                {!isPelsusView && <th className="w-32 sm:w-36 text-right py-1 px-2">SIMPANAN BANK</th>}
                <th className="w-32 sm:w-36 text-right py-1 px-2">JUMLAH</th>
              </tr>
            </thead>
            <tbody>
              {rekap.map((r) => (
                <tr key={r.no} className={`border-b border-border/80 ${r.no === "4." ? "bg-muted/20 font-bold text-black" : ""}`}>
                  <td className="text-center py-1 px-1.5">{r.no}</td>
                  <td className="py-1 px-2 font-medium text-black">{r.label}</td>
                  <td className="text-right py-1 px-2 font-mono text-black">{angkaSaldo(r.rutin)}</td>
                  {!isPelsusView && <td className="text-right py-1 px-2 font-mono text-black">{angkaSaldo(r.bank)}</td>}
                  <td className="text-right py-1 px-2 font-mono font-bold text-black">{angkaSaldo(isPelsusView ? r.rutin : r.rutin + r.bank)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3.5 text-[11pt] leading-relaxed">
          <p>
            Terima kasih kepada seluruh jemaat dan para tamu yang telah berpartispasi memberikan
            persembahan, baik dalam bentuk Persembahan Persepuluhan, serta Persembahan Syukur lainnya.
          </p>
          <p className="font-medium mt-0.5">Tuhan Yesus Memberkati.</p>
        </div>

        {!isPelsusView && (
          <div className="mt-3.5 text-[11pt]">
            <p className="text-right">
              {tempat}, {tglPanjang(sampai)}
            </p>
            <p className="mt-1 text-center font-bold uppercase tracking-wider">
              BADAN PEKERJA MAJELIS JEMAAT
            </p>
            <div className="mt-2.5 flex justify-between text-center">
              <div className="w-1/2">
                <p className="font-semibold">Ketua</p>
                <p className="mt-10 font-bold underline">{ketua}</p>
              </div>
              <div className="w-1/2">
                <p className="font-semibold">Bendahara</p>
                <p className="mt-10 font-bold underline">{bendahara}</p>
              </div>
            </div>
          </div>
        )}

        <p className="mt-2.5 text-[9.5pt] italic text-muted-foreground text-center">
          * Jika ada persembahan-persembahan yang sudah diberikan, tetapi belum tercantum/masuk dalam Warta Jemaat ini
          dapat diklarifikasikan di kantor jemaat pada waktu jam kerja *
        </p>

        <div className="mt-4 border-t pt-2.5">
          <p className="text-[11pt] font-bold uppercase tracking-wide text-black">DANA DIAKONIA DUKA JEMAAT</p>
          <table className="warta-table mt-1.5 w-full text-[11pt]">
            <thead>
              <tr className="bg-muted/30 border-y border-black/60 font-bold">
                <th className="w-16 py-1 px-1">Kolom</th>
                <th className="text-left py-1 px-2">Tunggakan</th>
                <th className="w-16 py-1 px-1">Kolom</th>
                <th className="text-left py-1 px-2">Tunggakan</th>
                <th className="w-16 py-1 px-1">Kolom</th>
                <th className="text-left py-1 px-2">Tunggakan</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, i) => {
                const k1 = i + 1;
                const k2 = i + 11;
                const k3 = i + 21;
                return (
                  <tr key={i} className="border-b border-border/80">
                    <td className="font-semibold text-center py-1 px-1">{k1 <= 29 ? `Kolom ${k1}` : ""}</td>
                    <td className="py-1 px-2">{k1 <= 29 ? (ringkasanDuka[k1]?.statusLabel || "Lunas") : ""}</td>
                    <td className="font-semibold text-center py-1 px-1">{k2 <= 29 ? `Kolom ${k2}` : ""}</td>
                    <td className="py-1 px-2">{k2 <= 29 ? (ringkasanDuka[k2]?.statusLabel || "Lunas") : ""}</td>
                    <td className="font-semibold text-center py-1 px-1">{k3 <= 29 ? `Kolom ${k3}` : ""}</td>
                    <td className="py-1 px-2">{k3 <= 29 ? (ringkasanDuka[k3]?.statusLabel || "Lunas") : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (isPelsusView) {
    return renderWartaContent();
  }

  return (
    <AppShell
      title="Warta Keuangan Mingguan"
      subtitle={`${tglPanjang(dari)} s/d ${tglPanjang(sampai)}`}
      actions={
        !isReadOnly ? (
          <div className="no-print flex gap-2">
            <Button variant="outline" onClick={exportExcel}>
              <FileDown className="mr-2 h-4 w-4" /> Export Excel (Warta)
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Cetak Warta
            </Button>
          </div>
        ) : null
      }
    >
      {renderWartaContent()}
    </AppShell>
  );
}

