import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Printer, FileDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { transactionsQuery } from "@/lib/queries";
import { rupiah } from "@/lib/format";
import { exportAoa, type Cell } from "@/lib/xlsx";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/laporan-harian")({
  head: () => ({
    meta: [
      { title: "Laporan Harian Kas — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Laporan kas harian gereja: saldo awal otomatis, total debit dan kredit, saldo berjalan per mata anggaran, siap cetak dan ekspor Excel.",
      },
      { property: "og:title", content: "Laporan Harian Kas — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Rincian transaksi kas harian dengan saldo awal otomatis, cetak dan ekspor Excel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LaporanHarianPage,
});

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

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const angka = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

function LaporanHarianPage() {
  const trx = useQuery(transactionsQuery);
  const [date, setDate] = useState(todayStr);
  const [q, setQ] = useState("");

  const all = trx.data ?? [];
  const [y, m, d] = date.split("-").map(Number);

  /** Saldo awal = akumulasi seluruh mutasi kas sebelum tanggal terpilih */
  const saldoAwal = useMemo(
    () =>
      all
        .filter((t) => t.trx_date < date)
        .reduce((a, t) => a + (t.kind === "penerimaan" ? Number(t.amount) : -Number(t.amount)), 0),
    [all, date],
  );

  const harian = useMemo(
    () =>
      all
        .filter((t) => t.trx_date === date)
        .sort(
          (a, b) =>
            (a.kind === "pengeluaran" ? 1 : 0) - (b.kind === "pengeluaran" ? 1 : 0) ||
            a.voucher_no.localeCompare(b.voucher_no),
        ),
    [all, date],
  );

  const rows = useMemo(
    () =>
      harian.filter(
        (t) =>
          !q ||
          `${t.voucher_no} ${t.description} ${t.payee ?? ""} ${t.budget_lines?.code ?? ""} ${t.budget_lines?.name ?? ""}`
            .toLowerCase()
            .includes(q.toLowerCase()),
      ),
    [harian, q],
  );

  const totalDebit = harian
    .filter((t) => t.kind === "penerimaan")
    .reduce((a, t) => a + Number(t.amount), 0);
  const totalKredit = harian
    .filter((t) => t.kind === "pengeluaran")
    .reduce((a, t) => a + Number(t.amount), 0);
  const saldoAkhir = saldoAwal + totalDebit - totalKredit;

  const baris = useMemo(() => {
    let saldo = saldoAwal;
    return rows.map((t, i) => {
      const nilai = Number(t.amount);
      saldo += t.kind === "penerimaan" ? nilai : -nilai;
      return { t, no: i + 1, saldo, debit: t.kind === "penerimaan" ? nilai : 0, kredit: t.kind === "pengeluaran" ? nilai : 0 };
    });
  }, [rows, saldoAwal]);

  function exportExcel() {
    const data: Cell[][] = [
      ["LAPORAN HARIAN KAS", "", "", "", "", "", "", ""],
      ["Tanggal", d ?? "", "", "", "", "", "Saldo Awal", saldoAwal],
      ["Bulan", BULAN[(m ?? 1) - 1] ?? "", "", "", "", "", "Total Debit", totalDebit],
      ["Tahun", y ?? "", "", "", "", "", "Total Kredit", totalKredit],
      ["", "", "", "", "", "", "Saldo Akhir", saldoAkhir],
      [],
      ["No", "Tanggal", "Mata Anggaran", "Nama Mata Anggaran", "Keterangan", "Debit", "Kredit", "Saldo"],
      ...baris.map((b) => [
        b.no,
        b.no === 1 ? date : "",
        b.t.budget_lines?.code ?? "",
        b.t.budget_lines?.name ?? "",
        b.t.koreksi_catatan ? `${b.t.description} [${b.t.koreksi_catatan}]` : b.t.description,
        b.debit || "",
        b.kredit || "",
        b.saldo,
      ]),
      ["", "", "", "", "TOTAL", totalDebit, totalKredit, saldoAkhir],
    ];
    exportAoa(data, `Laporan-Kas-${date}.xlsx`, "Laporan", [6, 12, 14, 34, 46, 14, 14, 16]);
  }

  return (
    <AppShell
      title="Laporan Harian Kas"
      subtitle="Transaksi kas hari ini dengan saldo awal terisi otomatis dari mutasi sebelumnya"
      actions={
        <div className="no-print flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <FileDown className="mr-2 size-4" /> Export Excel
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 size-4" /> Cetak
          </Button>
        </div>
      }
    >
      <div className="panel no-print mb-5 flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">Tanggal</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <Label htmlFor="q">Cari</Label>
          <Input
            id="q"
            placeholder="No. bukti, mata anggaran, keterangan"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="warta-area panel p-6">
        <div className="kas-sheet">
          <h2 className="text-center text-lg font-bold uppercase tracking-wide">Laporan Harian Kas</h2>
          <div className="mt-3 flex flex-wrap justify-between gap-4">
            <table className="kas-info">
              <tbody>
                <tr>
                  <td className="w-24">Tanggal</td>
                  <td className="font-semibold">{d}</td>
                </tr>
                <tr>
                  <td>Bulan</td>
                  <td className="font-semibold">{BULAN[(m ?? 1) - 1]}</td>
                </tr>
                <tr>
                  <td>Tahun</td>
                  <td className="font-semibold">{y}</td>
                </tr>
              </tbody>
            </table>
            <table className="kas-info">
              <tbody>
                <tr>
                  <td className="w-32">Saldo Awal</td>
                  <td className="text-right font-semibold">{angka(saldoAwal)}</td>
                </tr>
                <tr>
                  <td>Total Debit</td>
                  <td className="text-right font-semibold">{angka(totalDebit)}</td>
                </tr>
                <tr>
                  <td>Total Kredit</td>
                  <td className="text-right font-semibold">{angka(totalKredit)}</td>
                </tr>
                <tr>
                  <td>Saldo Akhir</td>
                  <td className="text-right font-bold">{angka(saldoAkhir)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <table className="warta-table mt-3 w-full">
            <thead>
              <tr>
                <th className="w-10 text-left">No</th>
                <th className="w-24 text-left">Tanggal</th>
                <th className="w-24 text-left">Mata Anggaran</th>
                <th className="w-56 text-left">Nama Mata Anggaran</th>
                <th className="text-left">Keterangan</th>
                <th className="w-28 text-right">Debit</th>
                <th className="w-28 text-right">Kredit</th>
                <th className="w-32 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-bold">
                <td />
                <td />
                <td />
                <td>Saldo Awal</td>
                <td />
                <td />
                <td />
                <td className="text-right">{angka(saldoAwal)}</td>
              </tr>
              {baris.map((b) => (
                <tr key={b.t.id}>
                  <td>{b.no}</td>
                  <td className="whitespace-nowrap">{b.no === 1 ? `${d} ${BULAN[(m ?? 1) - 1]}` : ""}</td>
                  <td className="whitespace-nowrap font-mono">{b.t.budget_lines?.code}</td>
                  <td>{b.t.budget_lines?.name}</td>
                  <td>
                    {b.t.description}
                    {b.t.koreksi_catatan && (
                      <span className="ml-1 italic text-[0.72rem]">({b.t.koreksi_catatan})</span>
                    )}
                  </td>
                  <td className="text-right">{b.debit ? angka(b.debit) : ""}</td>
                  <td className="text-right">{b.kredit ? angka(b.kredit) : ""}</td>
                  <td className="text-right">{angka(b.saldo)}</td>
                </tr>
              ))}
              {baris.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    {trx.isLoading ? "Memuat data…" : "Tidak ada transaksi pada tanggal ini."}
                  </td>
                </tr>
              )}
              <tr className="font-bold">
                <td colSpan={5}>TOTAL</td>
                <td className="text-right">{angka(totalDebit)}</td>
                <td className="text-right">{angka(totalKredit)}</td>
                <td className="text-right">{angka(saldoAkhir)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-8 flex justify-between text-xs">
            <div className="text-center">
              <p>Mengetahui,</p>
              <p className="font-semibold">Ketua BPMJ</p>
              <p className="mt-12">(…………………………………)</p>
            </div>
            <div className="text-center">
              <p>Tikala Baru, {`${d} ${BULAN[(m ?? 1) - 1]} ${y}`}</p>
              <p className="font-semibold">Bendahara</p>
              <p className="mt-12">(…………………………………)</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
