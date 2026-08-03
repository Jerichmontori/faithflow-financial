import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { TransactionDialog } from "@/components/TransactionDialog";
import { transactionsQuery } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
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
  const rows = (trx.data ?? []).filter((t) => t.kind === "penerimaan");
  const total = rows.reduce((a, t) => a + Number(t.amount), 0);

  return (
    <AppShell
      title="Transaksi Penerimaan"
      subtitle={`${rows.length} transaksi · total ${rupiah(total)}`}
      actions={<TransactionDialog kind="penerimaan" />}
    >
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
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {trx.isLoading ? "Memuat data…" : "Belum ada transaksi penerimaan."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}