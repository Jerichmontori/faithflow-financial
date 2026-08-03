import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TransactionDialog } from "@/components/TransactionDialog";
import { KoreksiDialog } from "@/components/KoreksiDialog";
import { HapusTransaksiDialog } from "@/components/HapusTransaksiDialog";
import { transactionsQuery, budgetLinesQuery } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/penerimaan")({
  head: () => ({
    meta: [
      { title: "Transaksi Penerimaan — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content: "Catat dan telusuri seluruh penerimaan kas gereja beserta mata anggarannya.",
      },
      { property: "og:title", content: "Transaksi Penerimaan — BUMOTIK FINANCIAL" },
      { property: "og:description", content: "Daftar penerimaan kas gereja per mata anggaran." },
    ],
  }),
  component: PenerimaanPage,
});

function PenerimaanPage() {
  const trx = useQuery(transactionsQuery);
  const budgets = useQuery(budgetLinesQuery);
  const [q, setQ] = useState("");
  const [budget, setBudget] = useState("all");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");

  const budgetOptions = (budgets.data ?? []).filter((b) => b.kind === "penerimaan");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (trx.data ?? []).filter((t) => {
      if (t.kind !== "penerimaan") return false;
      if (budget !== "all" && t.budget_line_id !== budget) return false;
      if (dari && t.trx_date < dari) return false;
      if (sampai && t.trx_date > sampai) return false;
      if (
        term &&
        !`${t.description} ${t.category}`
          .toLowerCase()
          .includes(term)
      )
        return false;
      return true;
    });
  }, [trx.data, q, budget, dari, sampai]);

  const aktif = q !== "" || budget !== "all" || dari !== "" || sampai !== "";
  const reset = () => {
    setQ("");
    setBudget("all");
    setDari("");
    setSampai("");
  };
  const total = rows.reduce((a, t) => a + Number(t.amount), 0);

  return (
    <AppShell
      title="Transaksi Penerimaan"
      subtitle={`${rows.length} transaksi · total ${rupiah(total)}`}
      actions={<TransactionDialog kind="penerimaan" />}
    >
      <div className="panel mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5 xl:col-span-2">
            <Label htmlFor="cari">Filter Keterangan</Label>
            <Input
              id="cari"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari keterangan transaksi…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mata Anggaran</Label>
            <Select value={budget} onValueChange={setBudget}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Semua mata anggaran</SelectItem>
                {budgetOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="dari">Dari</Label>
              <Input id="dari" type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sampai">Sampai</Label>
              <Input
                id="sampai"
                type="date"
                value={sampai}
                onChange={(e) => setSampai(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={reset} disabled={!aktif}>
            Reset filter
          </Button>
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>No. Bukti</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Mata Anggaran</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="text-right">Nominal</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="whitespace-nowrap">{tanggal(t.trx_date)}</TableCell>
                <TableCell className="font-mono text-xs">{t.voucher_no}</TableCell>
                <TableCell>{t.category}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.budget_lines ? `${t.budget_lines.code} — ${t.budget_lines.name}` : "-"}
                </TableCell>
                <TableCell className="max-w-64 truncate text-sm">{t.description}</TableCell>
                <TableCell className="text-right font-medium text-success">
                  {rupiah(t.amount)}
                </TableCell>
                <TableCell className="text-right">
                  <KoreksiDialog trx={t} />
                  <HapusTransaksiDialog trx={t} />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {trx.isLoading
                    ? "Memuat data…"
                    : aktif
                      ? "Tidak ada transaksi yang cocok dengan filter."
                      : "Belum ada transaksi penerimaan."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}