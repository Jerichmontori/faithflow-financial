import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Printer, FileDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { transactionsQuery, isInternalCash, isReklas, isCashPayment } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { exportAoa, type Cell } from "@/lib/xlsx";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/laporan-harian")({
  head: () => ({
    meta: [
      { title: "Laporan Harian Kas — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Laporan kas harian gereja format Buku Kas BUMOTIK: saldo awal otomatis, total debit dan kredit, saldo berjalan per mata anggaran, siap cetak dan ekspor Excel.",
      },
      { property: "og:title", content: "Laporan Harian Kas — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Rincian transaksi kas harian format Buku Kas BUMOTIK, cetak dan ekspor Excel.",
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

function LaporanHarianPage() {
  const trx = useQuery(transactionsQuery);
  const [date, setDate] = useState(todayStr);
  const [q, setQ] = useState("");

  const all = trx.data ?? [];
  const [y, m, d] = date.split("-").map(Number);
  const bulanNama = BULAN[(m ?? 1) - 1] ?? "";

  /** Saldo awal = akumulasi seluruh mutasi kas fisik sebelum tanggal terpilih */
  const saldoAwal = useMemo(
    () =>
      all
        .filter((t) => t.trx_date < date && isCashPayment(t) && t.status !== "rejected")
        .reduce((a, t) => a + (t.kind === "penerimaan" ? Number(t.amount) : -Number(t.amount)), 0),
    [all, date],
  );

  const harian = useMemo(
    () =>
      all
        .filter((t) => t.trx_date === date && t.status !== "rejected")
        .sort(
          (a, b) =>
            (a.kind === "pengeluaran" ? 1 : 0) - (b.kind === "pengeluaran" ? 1 : 0) ||
            (a.budget_lines?.code ?? "").localeCompare(b.budget_lines?.code ?? "") ||
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
    .filter((t) => t.kind === "penerimaan" && isCashPayment(t))
    .reduce((a, t) => a + Number(t.amount), 0);
  const totalKredit = harian
    .filter((t) => t.kind === "pengeluaran" && isCashPayment(t))
    .reduce((a, t) => a + Number(t.amount), 0);
  const saldoAkhir = saldoAwal + totalDebit - totalKredit;

  const baris = useMemo(() => {
    let saldo = saldoAwal;
    return rows.map((t, i) => {
      const nilai = Number(t.amount);
      const isFisik = isCashPayment(t);
      if (isFisik) {
        saldo += t.kind === "penerimaan" ? nilai : -nilai;
      }
      return {
        t,
        no: i + 1,
        saldo,
        debit: t.kind === "penerimaan" && isFisik ? nilai : 0,
        kredit: t.kind === "pengeluaran" && isFisik ? nilai : 0,
      };
    });
  }, [rows, saldoAwal]);

  function exportExcel() {
    const data: Cell[][] = [
      ["", "", "", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "Saldo Awal", saldoAwal],
      ["Tanggal", "", d ?? "", "", "", "", "Total Debit", totalDebit],
      ["Bulan", "", bulanNama, "", "", "", "Total Kredit", totalKredit],
      ["Tahun", "", y ?? "", "", "", "", "Saldo Akhir", saldoAkhir],
      [],
      ["No", "Tanggal", "Mata Anggaran", "Nama Mata Anggaran", "Keterangan", "Debit", "Kredit", "Saldo"],
      ...baris.map((b) => [
        b.no,
        `${d} ${bulanNama} ${y}`,
        b.t.budget_lines?.code ?? (isReklas(b.t) ? "REKLAS" : isInternalCash(b.t) ? "KAS/BANK" : ""),
        b.t.budget_lines?.name ?? (isReklas(b.t) ? "Pengembalian / Reklas" : isInternalCash(b.t) ? "Mutasi Kas Bank" : b.t.category || "Lain-lain"),
        b.t.koreksi_catatan ? `${b.t.description || b.t.payee || ""} [${b.t.koreksi_catatan}]` : (b.t.description || b.t.payee || "-"),
        b.debit || "",
        b.kredit || "",
        b.saldo,
      ]),
      ["TOTAL", "", "", "", "", totalDebit, totalKredit, saldoAkhir],
    ];

    exportAoa(
      data,
      `BUKU-KAS-${date}.xlsx`,
      "Laporan",
      [6, 16, 16, 38, 48, 16, 16, 18],
    );
  }

  return (
    <AppShell
      title="Laporan Harian Kas"
      subtitle={`Buku Kas Tanggal ${d} ${bulanNama} ${y} · ${harian.length} transaksi`}
      actions={
        <div className="no-print flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <FileDown className="mr-2 size-4" /> Export Excel (BUKU KAS)
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 size-4" /> Cetak
          </Button>
        </div>
      }
    >
      <div className="panel no-print mb-5 flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">Tanggal Laporan</Label>
          <DateInput id="date" value={date} onChange={setDate} />
        </div>
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <Label htmlFor="q">Cari Transaksi</Label>
          <Input
            id="q"
            placeholder="Kode anggaran, nama pos, keterangan…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="warta-area panel p-6">
        <div className="kas-sheet">
          <h2 className="text-center text-lg font-bold uppercase tracking-wide">Laporan Harian Kas</h2>
          
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <table className="kas-info w-72">
              <tbody>
                <tr>
                  <td className="w-24 font-medium">Tanggal</td>
                  <td className="font-semibold">{d}</td>
                </tr>
                <tr>
                  <td className="font-medium">Bulan</td>
                  <td className="font-semibold">{bulanNama}</td>
                </tr>
                <tr>
                  <td className="font-medium">Tahun</td>
                  <td className="font-semibold">{y}</td>
                </tr>
              </tbody>
            </table>

            <table className="kas-info w-80">
              <tbody>
                <tr>
                  <td className="font-medium">Saldo Awal</td>
                  <td className="text-right font-bold">{rupiah(saldoAwal)}</td>
                </tr>
                <tr>
                  <td className="font-medium">Total Debit</td>
                  <td className="text-right font-semibold text-success">{rupiah(totalDebit)}</td>
                </tr>
                <tr>
                  <td className="font-medium">Total Kredit</td>
                  <td className="text-right font-semibold text-destructive">{rupiah(totalKredit)}</td>
                </tr>
                <tr className="bg-muted/30">
                  <td className="font-bold">Saldo Akhir</td>
                  <td className="text-right font-bold text-primary">{rupiah(saldoAkhir)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <table className="warta-table mt-5 w-full">
            <thead>
              <tr className="bg-muted/40">
                <th className="w-12 text-center">No</th>
                <th className="w-28 text-left">Tanggal</th>
                <th className="w-28 text-left">Mata Anggaran</th>
                <th className="text-left">Nama Mata Anggaran</th>
                <th className="text-left">Keterangan</th>
                <th className="w-32 text-right">Debit</th>
                <th className="w-32 text-right">Kredit</th>
                <th className="w-36 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.t.id}>
                  <td className="text-center font-mono text-xs">{b.no}</td>
                  <td className="whitespace-nowrap text-xs">
                    {tanggal(b.t.trx_date)}
                  </td>
                  <td className="font-mono text-xs font-semibold text-primary">
                    {b.t.budget_lines?.code ?? (isReklas(b.t) ? "REKLAS" : isInternalCash(b.t) ? "KAS/BANK" : "-")}
                  </td>
                  <td className="text-xs font-medium">
                    {b.t.budget_lines?.name ?? (isReklas(b.t) ? "Pengembalian / Reklas" : isInternalCash(b.t) ? "Mutasi Kas Bank" : b.t.category || "-")}
                  </td>
                  <td className="text-xs">
                    {b.t.description || b.t.payee || "-"}
                    {b.t.koreksi_catatan && (
                      <span className="ml-1 text-[11px] italic text-muted-foreground">
                        [{b.t.koreksi_catatan}]
                      </span>
                    )}
                  </td>
                  <td className="text-right text-xs font-medium text-success">
                    {b.debit ? rupiah(b.debit) : ""}
                  </td>
                  <td className="text-right text-xs font-medium text-destructive">
                    {b.kredit ? rupiah(b.kredit) : ""}
                  </td>
                  <td className="text-right text-xs font-semibold font-mono">
                    {rupiah(b.saldo)}
                  </td>
                </tr>
              ))}

              {baris.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-muted-foreground">
                    {trx.isLoading ? "Memuat data transaksi…" : "Tidak ada transaksi kas pada tanggal ini."}
                  </td>
                </tr>
              )}

              <tr className="bg-muted/40 font-bold">
                <td colSpan={5} className="text-center">
                  TOTAL
                </td>
                <td className="text-right text-success">{rupiah(totalDebit)}</td>
                <td className="text-right text-destructive">{rupiah(totalKredit)}</td>
                <td className="text-right text-primary">{rupiah(saldoAkhir)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
