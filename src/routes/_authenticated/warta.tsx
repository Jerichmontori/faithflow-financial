import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { transactionsQuery, type Transaction } from "@/lib/queries";
import { rupiah } from "@/lib/format";
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
          "Warta keuangan jemaat: rincian penerimaan dan pengeluaran kas mingguan per mata anggaran, siap cetak kertas F4 dua rangkap.",
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

  const all = trx.data ?? [];

  const saldoAwal = useMemo(
    () =>
      all
        .filter((t) => t.trx_date < dari)
        .reduce((a, t) => a + (t.kind === "penerimaan" ? Number(t.amount) : -Number(t.amount)), 0),
    [all, dari],
  );

  const rentang = useMemo(
    () =>
      all
        .filter((t) => t.trx_date >= dari && t.trx_date <= sampai)
        .sort(
          (a, b) =>
            a.trx_date.localeCompare(b.trx_date) ||
            (a.budget_lines?.name ?? "").localeCompare(b.budget_lines?.name ?? "") ||
            a.voucher_no.localeCompare(b.voucher_no),
        ),
    [all, dari, sampai],
  );

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
          </tr>
        </thead>
        <tbody>
          <tr>
            <td />
            <td className="font-bold">Saldo Awal</td>
            <td />
            <td />
            <td className="text-right font-bold">{rupiah(saldoAwal)}</td>
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
          <tr className="font-bold">
            <td>TOTAL</td>
            <td />
            <td className="text-right">{rupiah(totalMasuk)}</td>
            <td className="text-right">{rupiah(totalKeluar)}</td>
            <td className="text-right">{rupiah(saldoAkhir)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4">
        <p className="text-sm font-bold uppercase">Rekapitulasi</p>
        <table className="warta-table mt-1 w-full">
          <tbody>
            <tr>
              <td className="w-10">1.</td>
              <td>Saldo Minggu Lalu</td>
              <td className="w-48 text-right">{rupiah(saldoAwal)}</td>
            </tr>
            <tr>
              <td>2.</td>
              <td>Penerimaan Minggu Ini</td>
              <td className="text-right">{rupiah(totalMasuk)}</td>
            </tr>
            <tr>
              <td>3.</td>
              <td>Pengeluaran Minggu Ini</td>
              <td className="text-right">{rupiah(totalKeluar)}</td>
            </tr>
            <tr className="font-bold">
              <td>4.</td>
              <td>Saldo Kas Minggu Ini</td>
              <td className="text-right">{rupiah(saldoAkhir)}</td>
            </tr>
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

      <div className="mt-6 text-center text-xs">
        <p className="font-semibold uppercase">Badan Pekerja Majelis Jemaat</p>
        <p>Ketua</p>
        <p className="mt-10 font-semibold underline">{ketua}</p>
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
        <Button onClick={() => window.print()} className="no-print">
          <Printer className="mr-2 h-4 w-4" /> Cetak F4 (2 rangkap)
        </Button>
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
            <Label htmlFor="ketua">Ketua BPMJ</Label>
            <Input id="ketua" value={ketua} onChange={(e) => setKetua(e.target.value)} />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Saldo awal terisi otomatis dari akumulasi seluruh mutasi kas sebelum tanggal mulai.
          Halaman cetak menggunakan kertas F4 (215 × 330 mm) landscape dan otomatis menghasilkan 2
          rangkap.
        </p>
      </div>

      <div className="warta-area panel overflow-x-auto p-6">
        {laporan(1)}
        {laporan(2)}
      </div>
    </AppShell>
  );
}
