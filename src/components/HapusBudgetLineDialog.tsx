import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { transactionsQuery, type BudgetLine } from "@/lib/queries";
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

export function HapusBudgetLineDialog({ budget }: { budget: BudgetLine }) {
  const { canManageFinance } = useSession();
  const queryClient = useQueryClient();
  const trx = useQuery(transactionsQuery);
  const [open, setOpen] = useState(false);

  // Cek apakah mata anggaran ini sedang digunakan transaksi
  const usedCount = (trx.data ?? []).filter((t) => t.budget_line_id === budget.id).length;

  const mutation = useMutation({
    mutationFn: async () => {
      if (usedCount > 0) {
        throw new Error(
          `Mata anggaran "${budget.code} - ${budget.name}" sedang digunakan oleh ${usedCount} transaksi dan tidak dapat dihapus. Hapus atau pindahkan transaksi terkait terlebih dahulu.`,
        );
      }
      const { error } = await supabase.from("budget_lines").delete().eq("id", budget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Mata anggaran "${budget.code}" berhasil dihapus.`);
      queryClient.invalidateQueries({ queryKey: ["budget_lines"] });
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus mata anggaran");
    },
  });

  if (!canManageFinance) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
          aria-label="Hapus Mata Anggaran"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Mata Anggaran?</AlertDialogTitle>
          <AlertDialogDescription>
            Apakah Anda yakin ingin menghapus mata anggaran{" "}
            <strong>
              {budget.code} — {budget.name}
            </strong>
            ?
            {usedCount > 0 && (
              <span className="mt-2 block text-xs font-semibold text-destructive">
                Perhatian: Mata anggaran ini memiliki {usedCount} transaksi tercatat dan tidak dapat dihapus.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={mutation.isPending || usedCount > 0}
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
