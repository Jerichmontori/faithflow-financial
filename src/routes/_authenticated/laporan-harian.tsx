import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { transactionsQuery } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/laporan-harian")({
  head: () => ({
    meta: [
      { title: "Laporan Harian Kas — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Laporan kas harian gereja: saldo awal otomatis, penerimaan dan pengeluaran hari ini, serta saldo akhir kas.",
      },
      { property: "og:title", content: "Laporan Harian Kas — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Rincian transaksi kas hari ini dengan saldo awal otomatis dan saldo berjalan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LaporanHarianPage,
});

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function LaporanHarianPage() {
  const trx = useQuery(transactionsQuery);
  const [date, setDate] = useState(todayStr);
  const [q, setQ] = useState("");

  const all = trx.data ?? [];

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
            a.kind.localeCompare(b.kind) || a.voucher_no.localeCompare(b.voucher_no),
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

  const masuk = harian
    .filter((t) => t.kind === "penerimaan")
    .reduce((a, t) => a + Number(t.amount), 0);
  const keluar = harian
    .filter((t) => t.kind === "pengeluaran")
    .reduce((a, t) => a + Number(t.amount), 0);
  const saldoAkhir = saldoAwal + masuk - keluar;

  let running = saldoAwal;

  function exportCsv() {
    const head = ["Tanggal", "No Bukti", "Jenis", "Mata Anggaran", "Keterangan", "Masuk", "Keluar"];
    const body = rows.map((t) => [
      t.trx_date,
      t.voucher_no,
      t.kind,
      `${t.budget_lines?.code ?? ""} ${t.budget_lines?.name ?? ""}`,
      (t.description ?? "").replace(/"/g, "'"),
      t.kind === "penerimaan" ? t.amount : 0,
      t.kind === "pengeluaran" ? t.amount : 0,
    ]);
    const csv = [
      ["Saldo Awal", "", "", "", "", saldoAwal, ""],
      head,
      ...body,
      ["Saldo Akhir", "", "", "", "", saldoAkhir, ""],
    ]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-harian-kas-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Laporan Harian Kas"
      subtitle="Transaksi kas hari ini dengan saldo awal terisi otomatis dari mutasi sebelumnya"
    >
      <div className="panel mb-5 flex flex-wrap items-end gap-4 p-4">
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
        <button type="button" className="text-sm text-muted-foreground underline" onClick={exportCsv}>
          Ekspor CSV
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Saldo Awal" value={rupiah(saldoAwal)} />
        <Stat label="Kas Masuk Hari Ini" value={rupiah(masuk)} tone="in" />
        <Stat label="Kas Keluar Hari Ini" value={rupiah(keluar)} tone="out" />
        <Stat label="Saldo Akhir" value={rupiah(saldoAkhir)} />
      </div>

      <section className="panel mt-5 overflow-x-auto p-5">
        <h2 className="text-base font-semibold">Rincian Kas {tanggal(date)}</h2>
        <table className="mt-4 w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">No. Bukti</th>
              <th className="py-2 pr-3">Mata Anggaran</th>
              <th className="py-2 pr-3">Keterangan</th>
              <th className="py-2 pr-3 text-right">Masuk</th>
              <th className="py-2 pr-3 text-right">Keluar</th>
              <th className="py-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b bg-muted/40">
              <td className="py-2 pr-3 text-xs uppercase tracking-wide text-muted-foreground" colSpan={5}>
                Saldo Awal
              </td>
              <td className="py-2 text-right font-semibold">{rupiah(saldoAwal)}</td>
            </tr>
            {rows.map((t) => {
              const amount = Number(t.amount);
              running += t.kind === "penerimaan" ? amount : -amount;
              return (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs">{t.voucher_no}</td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline">
                      {t.budget_lines?.code} — {t.budget_lines?.name}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 max-w-[300px] truncate">{t.description}</td>
                  <td className="py-2 pr-3 text-right">
                    {t.kind === "penerimaan" ? rupiah(amount) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {t.kind === "pengeluaran" ? rupiah(amount) : "—"}
                  </td>
                  <td className="py-2 text-right font-medium">{rupiah(running)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  Tidak ada transaksi pada tanggal ini.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40">
              <td className="py-2 pr-3 text-xs uppercase tracking-wide text-muted-foreground" colSpan={3}>
                Total Hari Ini / Saldo Akhir
              </td>
              <td className="py-2 pr-3 text-right font-semibold">{rupiah(masuk)}</td>
              <td className="py-2 pr-3 text-right font-semibold">{rupiah(keluar)}</td>
              <td className="py-2 text-right font-semibold">{rupiah(saldoAkhir)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "in" | "out" }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          "mt-1 text-xl font-semibold " +
          (tone === "in" ? "text-emerald-600" : tone === "out" ? "text-destructive" : "")
        }
      >
        {value}
      </p>
    </div>
  );
}
