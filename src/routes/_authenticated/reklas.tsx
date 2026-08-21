import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ReklasDialog } from "@/components/ReklasDialog";
import { transactionsQuery, isReklas } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/reklas")({
  head: () => ({
    meta: [
      { title: "Transaksi Pengembalian / Reklas — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Daftar transaksi pengembalian dan reklasifikasi kas gereja yang dikecualikan dari perhitungan mutasi bank.",
      },
      { property: "og:title", content: "Transaksi Pengembalian / Reklas — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Rincian transaksi reklas dan pengembalian beserta totalnya.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReklasPage,
});

function ReklasPage() {
  const trx = useQuery(transactionsQuery);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [q, setQ] = useState("");

  const rows = useMemo(
    () =>
      (trx.data ?? [])
        .filter(
          (t) =>
            isReklas(t) &&
            (!start || t.trx_date >= start) &&
            (!end || t.trx_date <= end) &&
            (!q ||
              `${t.voucher_no} ${t.description} ${t.koreksi_dari ?? ""} ${t.payee ?? ""}`
                .toLowerCase()
                .includes(q.toLowerCase())),
        )
        .sort((a, b) => a.trx_date.localeCompare(b.trx_date)),
    [trx.data, start, end, q],
  );

  const total = rows.reduce((a, t) => a + Number(t.amount), 0);

  function exportCsv() {
    const head = ["Tanggal", "No Bukti", "Mata Anggaran Wajib", "Reklas Dari", "Keterangan", "Nominal"];
    const body = rows.map((t) => [
      t.trx_date,
      t.voucher_no,
      `${t.budget_lines?.code ?? ""} ${t.budget_lines?.name ?? ""}`,
      (t.koreksi_dari ?? "").replace(/"/g, "'"),
      (t.description ?? "").replace(/"/g, "'"),
      t.amount,
    ]);
    const csv = [head, ...body].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "transaksi-reklas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Transaksi Pengembalian / Reklas"
      subtitle="Transaksi reklasifikasi & pengembalian dana — tidak dihitung sebagai mutasi bank"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ReklasDialog />
        </div>
      }
    >
      <div className="panel mb-5 flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="start">Dari tanggal</Label>
          <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end">Sampai tanggal</Label>
          <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <Label htmlFor="q">Cari</Label>
          <Input
            id="q"
            placeholder="No. bukti, keterangan, atau reklas asal…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="button" className="text-sm text-muted-foreground underline" onClick={exportCsv}>
          Ekspor CSV
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Jumlah Transaksi" value={String(rows.length)} />
        <Stat label="Total Nilai" value={rupiah(total)} />
        <Stat
          label="Rata-rata"
          value={rupiah(rows.length ? Math.round(total / rows.length) : 0)}
        />
      </div>

      <section className="panel mt-5 overflow-x-auto p-5">
        <h2 className="text-base font-semibold">Rincian Transaksi</h2>
        <table className="mt-4 w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Tanggal</th>
              <th className="py-2 pr-3">No. Bukti</th>
              <th className="py-2 pr-3">Mata Anggaran (Wajib)</th>
              <th className="py-2 pr-3">Reklas Dari / Asal</th>
              <th className="py-2 pr-3">Keterangan</th>
              <th className="py-2 text-right">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-2 pr-3 whitespace-nowrap">{tanggal(t.trx_date)}</td>
                <td className="py-2 pr-3 font-mono text-xs">{t.voucher_no}</td>
                <td className="py-2 pr-3">
                  <Badge variant="outline">
                    {t.budget_lines?.code} — {t.budget_lines?.name}
                  </Badge>
                </td>
                <td className="py-2 pr-3 text-xs">
                  {t.koreksi_dari ? (
                    <Badge variant="secondary" className="font-normal">
                      {t.koreksi_dari}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="py-2 pr-3 max-w-[300px] truncate">{t.description}</td>
                <td className="py-2 text-right font-medium">{rupiah(Number(t.amount))}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  Tidak ada transaksi reklas pada filter ini.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/40">
                <td className="py-2 pr-3 text-xs uppercase tracking-wide text-muted-foreground" colSpan={5}>
                  Total
                </td>
                <td className="py-2 text-right font-semibold">{rupiah(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}