import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TransactionDialog } from "@/components/TransactionDialog";
import { KoreksiDialog } from "@/components/KoreksiDialog";
import { HapusTransaksiDialog } from "@/components/HapusTransaksiDialog";
import { ImportMassalDialog } from "@/components/ImportMassalDialog";
import { ResetTransaksiDialog } from "@/components/ResetTransaksiDialog";
import { transactionsQuery, budgetLinesQuery } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/pengeluaran")({
  head: () => ({
    meta: [
      { title: "Transaksi Pengeluaran — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content: "Ajukan, pantau, dan setujui pengeluaran kas gereja sesuai mata anggaran.",
      },
      { property: "og:title", content: "Transaksi Pengeluaran — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Pengeluaran kas gereja lengkap dengan status approval.",
      },
    ],
  }),
  component: PengeluaranPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending: "Menunggu Approval",
  approved: "Disetujui",
  rejected: "Ditolak",
};

function PengeluaranPage() {
  const trx = useQuery(transactionsQuery);
  const budgets = useQuery(budgetLinesQuery);
  const { user, canApprove } = useSession();
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [budget, setBudget] = useState("all");
  const [status, setStatus] = useState("all");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");

  const budgetOptions = (budgets.data ?? []).filter((b) => b.kind === "pengeluaran");

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ status, approved_by: user!.id, approved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "approved" ? "Pengeluaran disetujui" : "Pengeluaran ditolak");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal memperbarui status"),
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (trx.data ?? []).filter((t) => {
      if (t.kind !== "pengeluaran") return false;
      if (budget !== "all" && t.budget_line_id !== budget) return false;
      if (status !== "all" && t.status !== status) return false;
      if (dari && t.trx_date < dari) return false;
      if (sampai && t.trx_date > sampai) return false;
      if (term && !`${t.description} ${t.payee ?? ""} ${t.voucher_no}`.toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [trx.data, q, budget, status, dari, sampai]);

  const aktif = q !== "" || budget !== "all" || status !== "all" || dari !== "" || sampai !== "";
  const reset = () => {
    setQ("");
    setBudget("all");
    setStatus("all");
    setDari("");
    setSampai("");
  };

  const disetujui = rows
    .filter((t) => t.status === "approved")
    .reduce((a, t) => a + Number(t.amount), 0);
  const menunggu = rows.filter((t) => t.status === "pending").length;

  return (
    <AppShell
      title="Transaksi Pengeluaran"
      subtitle={`${rows.length} transaksi · ${rupiah(disetujui)} disetujui · ${menunggu} menunggu approval`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <TransactionDialog kind="pengeluaran" />
          <ImportMassalDialog kind="pengeluaran" />
          <ResetTransaksiDialog kind="pengeluaran" jumlah={rows.length} />
        </div>
      }
    >
      <div className="panel mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="cari">Filter Keterangan</Label>
            <Input
              id="cari"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Keterangan, penerima, no. bukti…"
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
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
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
              <TableHead>Penerima</TableHead>
              <TableHead>Mata Anggaran</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="text-right">Nominal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Koreksi</TableHead>
              {canApprove && <TableHead className="text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="whitespace-nowrap">{tanggal(t.trx_date)}</TableCell>
                <TableCell className="font-mono text-xs">{t.voucher_no}</TableCell>
                <TableCell>{t.payee ?? "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.budget_lines ? `${t.budget_lines.code} — ${t.budget_lines.name}` : "-"}
                </TableCell>
                <TableCell className="max-w-64 truncate text-sm">{t.description}</TableCell>
                <TableCell className="text-right font-medium text-destructive">
                  {rupiah(t.amount)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      t.status === "approved"
                        ? "default"
                        : t.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {STATUS_LABEL[t.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <KoreksiDialog trx={t} />
                  <HapusTransaksiDialog trx={t} />
                </TableCell>
                {canApprove && (
                  <TableCell className="text-right whitespace-nowrap">
                    {t.status === "pending" ? (
                      <span className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decide.mutate({ id: t.id, status: "approved" })}
                        >
                          <Check className="size-3.5" /> Setujui
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => decide.mutate({ id: t.id, status: "rejected" })}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={canApprove ? 9 : 8} className="py-10 text-center text-muted-foreground">
                  {trx.isLoading
                    ? "Memuat data…"
                    : aktif
                      ? "Tidak ada transaksi yang cocok dengan filter."
                      : "Belum ada transaksi pengeluaran."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
