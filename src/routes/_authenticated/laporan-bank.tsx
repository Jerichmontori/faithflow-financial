import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { transactionsQuery, INTERNAL_CASH_CODES, type Transaction } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/laporan-bank")({
  head: () => ({
    meta: [
      { title: "Laporan Bank — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Laporan mutasi rekening bank gereja: kas masuk sebagai pengeluaran bank dan kas keluar sebagai pemasukan bank.",
      },
      { property: "og:title", content: "Laporan Bank — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Dashboard mutasi bank berdasarkan mata anggaran kas masuk dan kas keluar.",
      },
    ],
  }),
  component: LaporanBankPage,
});

const BULAN = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** Kas Masuk (kas gereja bertambah) = penarikan dari bank → pengeluaran bank.
 *  Kas Keluar (kas gereja berkurang) = setoran ke bank → pemasukan bank. */
const isBankIn = (t: Transaction) => t.budget_lines?.code === "2.2.22.22";

function LaporanBankPage() {
  const trx = useQuery(transactionsQuery);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [q, setQ] = useState("");
  const [saldoAwal, setSaldoAwal] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("bumotik.saldoAwalBank");
    if (saved !== null) setSaldoAwal(saved);
  }, []);

  const saldoAwalNum = Number(saldoAwal.replace(/[^\d-]/g, "")) || 0;

  function onSaldoAwalChange(v: string) {
    setSaldoAwal(v);
    localStorage.setItem("bumotik.saldoAwalBank", v);
  }

  const rows = useMemo(() => {
    return (trx.data ?? [])
      .filter(
        (t) =>
          INTERNAL_CASH_CODES.includes(t.budget_lines?.code ?? "") &&
          t.status !== "rejected" &&
          t.status !== "draft" &&
          (!start || t.trx_date >= start) &&
          (!end || t.trx_date <= end) &&
          (!q ||
            `${t.voucher_no} ${t.description} ${t.payee ?? ""}`
              .toLowerCase()
              .includes(q.toLowerCase())),
      )
      .sort((a, b) =>
        a.trx_date === b.trx_date
          ? a.created_at.localeCompare(b.created_at)
          : a.trx_date.localeCompare(b.trx_date),
      );
  }, [trx.data, start, end, q]);

  const totalIn = rows.filter(isBankIn).reduce((a, t) => a + Number(t.amount), 0);
  const totalOut = rows.filter((t) => !isBankIn(t)).reduce((a, t) => a + Number(t.amount), 0);

  const chart = useMemo(() => {
    const map = new Map<string, { name: string; masuk: number; keluar: number }>();
    for (const t of rows) {
      const d = new Date(t.trx_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const item =
        map.get(key) ?? { name: `${BULAN[d.getMonth()]} ${d.getFullYear()}`, masuk: 0, keluar: 0 };
      if (isBankIn(t)) item.masuk += Number(t.amount);
      else item.keluar += Number(t.amount);
      map.set(key, item);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [rows]);

  let saldo = saldoAwalNum;
  const ledger = rows.map((t) => {
    const masuk = isBankIn(t) ? Number(t.amount) : 0;
    const keluar = isBankIn(t) ? 0 : Number(t.amount);
    saldo += masuk - keluar;
    return { t, masuk, keluar, saldo };
  });

  function exportCsv() {
    const head = ["Tanggal", "No Bukti", "Mata Anggaran", "Keterangan", "Pemasukan Bank", "Pengeluaran Bank", "Saldo"];
    const body = ledger.map((r) => [
      r.t.trx_date,
      r.t.voucher_no,
      `${r.t.budget_lines?.code ?? ""} ${r.t.budget_lines?.name ?? ""}`,
      (r.t.description ?? "").replace(/"/g, "'"),
      r.masuk,
      r.keluar,
      r.saldo,
    ]);
    const csv = [head, ...body].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "laporan-bank.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Laporan Bank"
      subtitle="Kas Masuk dicatat sebagai pengeluaran bank, Kas Keluar sebagai pemasukan bank"
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
            placeholder="No. bukti atau keterangan"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="saldo-awal">Saldo Awal Bank</Label>
          <Input
            id="saldo-awal"
            inputMode="numeric"
            placeholder="0"
            className="w-[180px] text-right"
            value={saldoAwal}
            onChange={(e) => onSaldoAwalChange(e.target.value)}
          />
        </div>
        <button type="button" className="text-sm text-muted-foreground underline" onClick={exportCsv}>
          Ekspor CSV
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Saldo Awal Bank" value={rupiah(saldoAwalNum)} hint="Saldo sebelum periode" />
        <Stat label="Pemasukan Bank (Kas Keluar)" value={rupiah(totalIn)} />
        <Stat label="Pengeluaran Bank (Kas Masuk)" value={rupiah(totalOut)} />
        <Stat
          label="Saldo Akhir Bank"
          value={rupiah(saldoAwalNum + totalIn - totalOut)}
          hint={`Mutasi ${rupiah(totalIn - totalOut)}`}
        />
        <Stat label="Jumlah Transaksi" value={String(rows.length)} hint={`${rows.filter(isBankIn).length} setoran · ${rows.filter((t) => !isBankIn(t)).length} penarikan`} />
      </div>

      <section className="panel mt-5 p-5">
        <h2 className="text-base font-semibold">Mutasi Bank per Bulan</h2>
        <div className="mt-4 h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)}jt`} fontSize={11} />
              <Tooltip
                formatter={(v: number | string) => rupiah(Number(v))}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Legend />
              <Bar dataKey="masuk" name="Pemasukan Bank" className="fill-primary" radius={[4, 4, 0, 0]} />
              <Bar dataKey="keluar" name="Pengeluaran Bank" className="fill-destructive" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel mt-5 overflow-x-auto p-5">
        <h2 className="text-base font-semibold">Rincian Mutasi Bank</h2>
        <table className="mt-4 w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Tanggal</th>
              <th className="py-2 pr-3">No. Bukti</th>
              <th className="py-2 pr-3">Mata Anggaran</th>
              <th className="py-2 pr-3">Keterangan</th>
              <th className="py-2 pr-3 text-right">Pemasukan</th>
              <th className="py-2 pr-3 text-right">Pengeluaran</th>
              <th className="py-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b bg-muted/40">
              <td className="py-2 pr-3 text-xs uppercase tracking-wide text-muted-foreground" colSpan={6}>
                Saldo Awal Bank
              </td>
              <td className="py-2 text-right font-medium">{rupiah(saldoAwalNum)}</td>
            </tr>
            {ledger.map((r) => (
              <tr key={r.t.id} className="border-b last:border-0">
                <td className="py-2 pr-3 whitespace-nowrap">{tanggal(r.t.trx_date)}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.t.voucher_no}</td>
                <td className="py-2 pr-3">
                  <Badge variant={r.masuk ? "secondary" : "outline"}>
                    {r.t.budget_lines?.code} — {r.t.budget_lines?.name}
                  </Badge>
                </td>
                <td className="py-2 pr-3 max-w-[280px] truncate">{r.t.description}</td>
                <td className="py-2 pr-3 text-right">{r.masuk ? rupiah(r.masuk) : "—"}</td>
                <td className="py-2 pr-3 text-right">{r.keluar ? rupiah(r.keluar) : "—"}</td>
                <td className="py-2 text-right font-medium">{rupiah(r.saldo)}</td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted-foreground">
                  Belum ada mutasi bank pada filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
