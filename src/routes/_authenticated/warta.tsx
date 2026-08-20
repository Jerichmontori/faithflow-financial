import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Printer, FileDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  transactionsQuery,
  isInternalCash,
  isReklas,
  type Transaction,
} from "@/lib/queries";
import { rupiah } from "@/lib/format";
import { exportAoa, type Cell } from "@/lib/xlsx";
import { DUKA_KOLOM, bacaDuka, statusDuka, type DukaMap } from "@/lib/duka";
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
          "Warta keuangan jemaat: rincian penerimaan dan pengeluaran kas mingguan, rekapitulasi dana rutin & simpanan bank, siap cetak F4 dua rangkap.",
      },
      { property: "og:title", content: "Warta Keuangan Mingguan — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Laporan penerimaan & pengeluaran kas jemaat per minggu, format warta siap cetak.",
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
  const [y, m, d] = s.split("-").map(Number);
  return `${d} ${BULAN[(m ?? 1) - 1]} ${y}`;
};

const tglPendek = (s: string) => {
  const [, m, d] = s.split("-").map(Number);
  return `${d} ${(BULAN[(m ?? 1) - 1] ?? "").slice(0, 5)}`;
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
  const [dari, setDari] = useState(seninIni);
  const [sampai, setSampai] = useState(() => plusHari(seninIni(), 4));
  const [ketua, setKetua] = useState("Pdt. Handrie M Dengah M.Th");
  const [bendahara, setBendahara] = useState("Bendahara BPMJ");
  const [tempat, setTempat] = useState("Tikala Baru");
  const [saldoAwalBank, setSaldoAwalBank] = useState("0");
  const [duka, setDuka] = useState<DukaMap>({});

  useEffect(() => {
    setSaldoAwalBank(localStorage.getItem("bumotik.saldoAwalBank") ?? "0");
    setDuka(bacaDuka());
  }, []);

  const simpanSaldoBank = (v: string) => {
    setSaldoAwalBank(v);
    localStorage.setItem("bumotik.saldoAwalBank", v);
  };

  const all = trx.data ?? [];

  const saldoAwal = useMemo(
    () =>
      all
        .filter((t) => t.trx_date < dari)
        .reduce((a, t) => a + (t.kind === "penerimaan" ? Number(t.amount) : -Number(t.amount)), 0),
    [all, dari],
  );

  /** Mutasi bank: kas keluar (setoran) = bank masuk, kas masuk (tarikan) = bank keluar */
  const bankMutasi = (list: Transaction[]) =>
    list
      .filter((t) => isInternalCash(t) && !isReklas(t))
      .reduce(
        (acc, t) => {
          const n = Number(t.amount);
          if (t.kind === "pengeluaran") acc.masuk += n;
          else acc.keluar += n;
          return acc;
        },
        { masuk: 0, keluar: 0 },
      );

  const bankSebelum = useMemo(() => bankMutasi(all.filter((t) => t.trx_date < dari)), [all, dari]);
  const bankAwal = Number(saldoAwalBank || 0) + bankSebelum.masuk - bankSebelum.keluar;

  const rentang = useMemo(
    () =>
      all
        .filter((t) => t.trx_date >= dari && t.trx_date <= sampai)
        .sort(
          (a, b) =>
            a.trx_date.localeCompare(b.trx_date) ||
            (a.kind === "pengeluaran" ? 1 : 0) - (b.kind === "pengeluaran" ? 1 : 0) ||
            (a.budget_lines?.name ?? "").localeCompare(b.budget_lines?.name ?? "") ||
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
      if (t.kind === "penerimaan") {
        saldo += nilai;
        masuk += nilai;
      } else {
        saldo -= nilai;
        keluar += nilai;
      }
      out.push({ tipe: "trx", trx: t, key: t.id, saldo });
    }
    return { baris: out, totalMasuk: masuk, totalKeluar: keluar };
  }, [rentang, saldoAwal]);

  const saldoAkhir = saldoAwal + totalMasuk - totalKeluar;

  const rekap = [
    { no: 1, label: "Saldo Minggu Lalu", rutin: saldoAwal, bank: bankAwal },
    { no: 2, label: "Penerimaan Minggu Ini", rutin: totalMasuk, bank: bankMinggu.masuk },
    { no: 3, label: "Pengeluaran Minggu Ini", rutin: totalKeluar, bank: bankMinggu.keluar },
    { no: 4, label: "Saldo Kas Minggu Ini", rutin: saldoAkhir, bank: bankAkhir },
  ];

  function exportExcel() {
    const data: Cell[][] = [
      ["WARTA KEUANGAN"],
      [`Laporan Penerimaan & Pengeluaran Kas Jemaat Tanggal ${tglPanjang(dari)} s/d ${tglPanjang(sampai)}`],
      [],
      ["Tgl", "Uraian", "Masuk (Rp)", "Keluar (Rp)", "Saldo (Rp)", "Koreksi"],
      ["", "Saldo Awal", "", "", saldoAwal, ""],
      ...baris.map((b) =>
        b.tipe === "grup"
          ? [b.tanggal ? tglPendek(b.tanggal) : "", b.nama, "", "", "", ""]
          : [
              "",
              b.trx.description || b.trx.payee || b.trx.voucher_no,
              b.trx.kind === "penerimaan" ? Number(b.trx.amount) : "",
              b.trx.kind === "pengeluaran" ? Number(b.trx.amount) : "",
              b.saldo,
              b.trx.koreksi_catatan ?? "",
            ],
      ),
      ["TOTAL", "", totalMasuk, totalKeluar, saldoAkhir, ""],
      [],
      ["REKAPITULASI", "", "Dana Rutin", "Simpanan Bank", "Jumlah"],
      ...rekap.map((r) => [`${r.no}.`, r.label, r.rutin, r.bank, r.rutin + r.bank]),
      [],
      ["DANA DIAKONIA DUKA JEMAAT"],
      ...DUKA_KOLOM.map((k) => [`Kolom ${k}`, statusDuka(duka, k)]),
      [],
      ["", `${tempat}, ${tglPanjang(sampai)}`],
      ["Ketua", "Bendahara"],
      [ketua, bendahara],
    ];
    exportAoa(
      data,
      `Warta-Keuangan-${dari}-sd-${sampai}.xlsx`,
      "Warta",
      [12, 56, 16, 16, 18, 34],
    );
  }

  const laporan = (rangkap: number) => (
    <div className={`warta-sheet ${rangkap === 2 ? "warta-copy-2" : ""}`}>
      <div className="text-center">
        <h2 className="text-lg font-bold uppercase tracking-wide">Warta Keuangan</h2>
        <p className="text-sm">
          Laporan Penerimaan &amp; Pengeluaran Kas Jemaat Tanggal {tglPanjang(dari)} s/d{" "}
          {tglPanjang(sampai)}
        </p>
      </div>

      <table className="warta-table mt-3 w-full">
        <thead>
          <tr>
            <th className="w-24 text-left">Tgl</th>
            <th className="text-left">Uraian</th>
            <th className="w-32 text-right">Masuk (Rp)</th>
            <th className="w-32 text-right">Keluar (Rp)</th>
            <th className="w-36 text-right">Saldo (Rp)</th>
            <th className="w-40 text-left">Koreksi</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td />
            <td className="font-bold">Saldo Awal</td>
            <td />
            <td />
            <td className="text-right font-bold">{rupiah(saldoAwal)}</td>
            <td />
          </tr>
          {baris.map((b) =>
            b.tipe === "grup" ? (
              <tr key={b.key}>
                <td className="whitespace-nowrap font-semibold">
                  {b.tanggal ? tglPendek(b.tanggal) : ""}
                </td>
                <td className="font-bold">{b.nama}</td>
                <td />
                <td />
                <td />
                <td />
              </tr>
            ) : (
              <tr key={b.key}>
                <td />
                <td className="pl-4">{b.trx.description || b.trx.payee || b.trx.voucher_no}</td>
                <td className="text-right">
                  {b.trx.kind === "penerimaan" ? rupiah(b.trx.amount) : ""}
                </td>
                <td className="text-right">
                  {b.trx.kind === "pengeluaran" ? rupiah(b.trx.amount) : ""}
                </td>
                <td className="text-right">{rupiah(b.saldo)}</td>
                <td className="text-[0.7rem] italic">{b.trx.koreksi_catatan ?? ""}</td>
              </tr>
            ),
          )}
          {baris.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-muted-foreground">
                {trx.isLoading ? "Memuat data…" : "Tidak ada transaksi pada rentang tanggal ini."}
              </td>
            </tr>
          )}
          <tr className="font-bold">
            <td>TOTAL</td>
            <td />
            <td className="text-right">{rupiah(totalMasuk)}</td>
            <td className="text-right">{rupiah(totalKeluar)}</td>
            <td className="text-right">{rupiah(saldoAkhir)}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <div className="mt-4">
        <p className="text-sm font-bold uppercase">Rekapitulasi</p>
        <table className="warta-table mt-1 w-full">
          <thead>
            <tr>
              <th className="w-10" />
              <th className="text-left">Uraian</th>
              <th className="w-40 text-right">Dana Rutin</th>
              <th className="w-40 text-right">Simpanan Bank</th>
              <th className="w-40 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {rekap.map((r) => (
              <tr key={r.no} className={r.no === 4 ? "font-bold" : ""}>
                <td>{r.no}.</td>
                <td>{r.label}</td>
                <td className="text-right">{rupiah(r.rutin)}</td>
                <td className="text-right">{rupiah(r.bank)}</td>
                <td className="text-right">{rupiah(r.rutin + r.bank)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <p className="text-sm font-bold uppercase">Dana Diakonia Duka Jemaat</p>
        <table className="warta-table mt-1 w-full">
          <tbody>
            {Array.from({ length: 10 }, (_, i) => i).map((i) => {
              const kolomBaris = [i + 1, i + 11, i + 21].filter((k) => k <= 29);
              return (
                <tr key={i}>
                  {kolomBaris.map((k) => (
                    <Fragment key={k}>
                      <td className="w-20 font-semibold">Kolom {k}</td>
                      <td>{statusDuka(duka, k)}</td>
                    </Fragment>
                  ))}
                  {kolomBaris.length < 3 && <td colSpan={(3 - kolomBaris.length) * 2} />}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs leading-relaxed">
        <p>
          Terima kasih kepada seluruh jemaat dan para tamu yang telah berpartisipasi memberikan
          persembahan, baik dalam bentuk Persembahan Persepuluhan, serta Persembahan Syukur lainnya.
        </p>
        <p>Tuhan Yesus Memberkati.</p>
      </div>

      <div className="mt-4 text-xs">
        <p className="text-right">
          {tempat}, {tglPanjang(sampai)}
        </p>
        <p className="mt-1 text-center font-semibold uppercase">Badan Pekerja Majelis Jemaat</p>
        <div className="mt-2 flex justify-between text-center">
          <div className="w-1/2">
            <p>Ketua</p>
            <p className="mt-10 font-semibold underline">{ketua}</p>
          </div>
          <div className="w-1/2">
            <p>Bendahara</p>
            <p className="mt-10 font-semibold underline">{bendahara}</p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[10px] italic">
        * Jika ada persembahan yang sudah diberikan tetapi belum tercantum dalam Warta Jemaat ini,
        dapat diklarifikasikan di kantor jemaat pada waktu jam kerja *
      </p>
      <p className="mt-1 text-right text-[10px]">Rangkap {rangkap} dari 2</p>
    </div>
  );

  return (
    <AppShell
      title="Warta Keuangan Mingguan"
      subtitle={`${tglPanjang(dari)} s/d ${tglPanjang(sampai)} · ${rentang.length} transaksi`}
      actions={
        <div className="no-print flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <FileDown className="mr-2 h-4 w-4" /> Export Excel
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Cetak F4 (2 rangkap)
          </Button>
        </div>
      }
    >
      <div className="panel no-print mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
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
        <p className="mt-3 text-xs text-muted-foreground">
          Saldo awal kas terisi otomatis dari akumulasi mutasi sebelum tanggal mulai. Kolom Simpanan
          Bank dihitung otomatis dari transaksi setor/tarik bank. Status Dana Duka diambil dari
          halaman Dana Duka. Cetak menggunakan kertas F4 landscape, 2 rangkap.
        </p>
      </div>

      <div className="warta-area panel overflow-x-auto p-6">
        {laporan(1)}
        {laporan(2)}
      </div>
    </AppShell>
  );
}
