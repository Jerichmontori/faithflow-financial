import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("transactions").delete().eq("id", trx.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Transaksi ${trx.voucher_no} dihapus`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error
          ? `Gagal menghapus: ${e.message}`
          : "Gagal menghapus transaksi. Hanya Super Administrator yang dapat menghapus.",
      ),
  });

  return (
    <AlertDialog>
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
          <AlertDialogCancel>Batal</AlertDialogCancel>
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
