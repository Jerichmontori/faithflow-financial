import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Paperclip } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TransactionDialog } from "@/components/TransactionDialog";
import { transactionsQuery } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const { user, canApprove } = useSession();
  const queryClient = useQueryClient();

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

  const rows = (trx.data ?? []).filter((t) => t.kind === "pengeluaran");
  const disetujui = rows
    .filter((t) => t.status === "approved")
    .reduce((a, t) => a + Number(t.amount), 0);
  const menunggu = rows.filter((t) => t.status === "pending").length;

  return (
    <AppShell
      title="Transaksi Pengeluaran"
      subtitle={`${rupiah(disetujui)} disetujui · ${menunggu} menunggu approval`}
      actions={<TransactionDialog kind="pengeluaran" />}
    >
      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>No. Bukti</TableHead>
              <TableHead>Penerima</TableHead>
              <TableHead>Mata Anggaran</TableHead>
              <TableHead>Metode</TableHead>
              <TableHead className="text-right">Nominal</TableHead>
              <TableHead>Status</TableHead>
              {canApprove && <TableHead className="text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="whitespace-nowrap">{tanggal(t.trx_date)}</TableCell>
                <TableCell className="font-mono text-xs">{t.voucher_no}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    {t.payee ?? "-"}
                    {t.attachment_url && (
                      <a href={t.attachment_url} target="_blank" rel="noreferrer">
                        <Paperclip className="size-3.5 text-muted-foreground" />
                      </a>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">{t.category}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.budget_lines ? `${t.budget_lines.code} — ${t.budget_lines.name}` : "-"}
                </TableCell>
                <TableCell className="text-sm">{t.payment_method ?? "-"}</TableCell>
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
                <TableCell colSpan={canApprove ? 8 : 7} className="py-10 text-center text-muted-foreground">
                  {trx.isLoading ? "Memuat data…" : "Belum ada transaksi pengeluaran."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}