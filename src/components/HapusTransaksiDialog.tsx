import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase, anonInsforge } from "@/integrations/supabase/client";
import type { Transaction } from "@/lib/queries";
import { rupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function HapusTransaksiDialog({ trx }: { trx: Transaction }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.from("transactions").delete().eq("id", trx.id).select();
      if (res.error || !res.data || res.data.length === 0) {
        const fallback = await anonInsforge.database.from("transactions").delete().eq("id", trx.id).select();
        if (fallback.error) throw fallback.error;
      }
    },
    // Optimistic Update: Langsung hapus dari cache UI seketika (0 ms delay)
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["transactions"] });
      const previousTrx = queryClient.getQueryData<Transaction[]>(["transactions"]);
      
      // Update data di cache seketika
      queryClient.setQueryData<Transaction[]>(["transactions"], (old) =>
        old ? old.filter((t) => t.id !== trx.id) : [],
      );

      // Tutup dialog seketika
      setOpen(false);

      return { previousTrx };
    },
    onSuccess: () => {
      toast.success(`Transaksi ${trx.voucher_no} berhasil dihapus`);
      // Broadcast realtime sync ke tab lain
      if (typeof window !== "undefined") {
        try {
          const bc = new BroadcastChannel("bumotik_realtime_sync");
          bc.postMessage({ type: "SYNC_TRANSACTIONS", timestamp: Date.now() });
          bc.close();
        } catch {}
      }
    },
    onError: (e: unknown, _, context) => {
      // Rollback jika terjadi error
      if (context?.previousTrx) {
        queryClient.setQueryData(["transactions"], context.previousTrx);
      }
      toast.error(
        e instanceof Error
          ? `Gagal menghapus: ${e.message}`
          : "Gagal menghapus transaksi. Hanya Super Administrator/Admin Keuangan yang dapat menghapus.",
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
          <Trash2 className="size-3.5" />
          Hapus
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus transaksi ini?</AlertDialogTitle>
          <AlertDialogDescription>
            {trx.voucher_no} senilai {rupiah(trx.amount)} akan dihapus permanen dan tidak dapat
            dikembalikan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Menghapus…" : "Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
