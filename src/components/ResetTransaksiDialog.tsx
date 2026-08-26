import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eraser, Download, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { supabase, anonInsforge } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { transactionsQuery } from "@/lib/queries";
import { exportAoa } from "@/lib/xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Kind = "penerimaan" | "pengeluaran";

export function ResetTransaksiDialog({ kind, jumlah }: { kind: Kind; jumlah: number }) {
  const { roles } = useSession();
  const queryClient = useQueryClient();
  const trx = useQuery(transactionsQuery);
  const [open, setOpen] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState("");

  const list = (trx.data ?? []).filter((t) => t.kind === kind);

  const downloadBackup = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const rows =
      kind === "penerimaan"
        ? [
            ["Tanggal", "Kode Anggaran", "Nominal", "Keterangan", "No Bukti"],
            ...list.map((t) => [
              t.trx_date,
              t.budget_lines?.code || "",
              Number(t.amount || 0),
              t.description || "",
              t.voucher_no || "",
            ]),
          ]
        : [
            ["Tanggal", "Kode Anggaran", "Nominal", "Keterangan", "Penerima", "No Bukti"],
            ...list.map((t) => [
              t.trx_date,
              t.budget_lines?.code || "",
              Number(t.amount || 0),
              t.description || "",
              t.payee || "",
              t.voucher_no || "",
            ]),
          ];
    const filename = `Backup_${kind === "penerimaan" ? "Penerimaan" : "Pengeluaran"}_SebelumReset_${todayStr}.xlsx`;
    exportAoa(rows, filename, kind, [14, 16, 16, 45, 20, 16]);
    toast.success(`Backup data berhasil diunduh: ${filename}`);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.from("transactions").delete().eq("kind", kind).select();
      if (res.error || !res.data || res.data.length === 0) {
        const fallback = await anonInsforge.database.from("transactions").delete().eq("kind", kind).select();
        if (fallback.error) throw fallback.error;
      }
    },
    onSuccess: () => {
      toast.success(`Semua transaksi ${kind} berhasil direset/dihapus`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setKonfirmasi("");
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal mereset transaksi"),
  });

  if (!roles.includes("super_admin")) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
          <Eraser className="size-3.5" />
          Reset Semua
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            <DialogTitle>Reset Seluruh Transaksi {kind === "penerimaan" ? "Penerimaan" : "Pengeluaran"}?</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Tindakan ini menghapus permanen seluruh <strong>{list.length} transaksi {kind}</strong> di database.
            Setelah di-reset, Anda dapat meng-import kembali data kapan saja menggunakan file backup Excel.
          </DialogDescription>
        </DialogHeader>

        {/* Tombol Backup Cepat Sebelum Reset */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileSpreadsheet className="size-4 text-success" />
              Amankan Data Terlebih Dahulu
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={downloadBackup}
              disabled={list.length === 0}
              className="h-7 text-xs font-semibold gap-1 text-primary"
            >
              <Download className="size-3" /> Unduh Backup Excel
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            File Excel yang diunduh langsung dapat di-import kembali melalui tombol <strong>Import Data</strong> jika dibutuhkan.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="konfirmasi-reset" className="text-xs font-semibold">
            Ketik <span className="font-mono text-destructive font-bold">RESET</span> untuk konfirmasi penghapusan:
          </Label>
          <Input
            id="konfirmasi-reset"
            value={konfirmasi}
            onChange={(e) => setKonfirmasi(e.target.value)}
            placeholder="RESET"
            className="h-9 font-mono uppercase"
          />
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            size="sm"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
            disabled={konfirmasi !== "RESET" || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Menghapus…" : "Hapus & Reset Semua"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}