import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eraser } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
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
  const [open, setOpen] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("transactions").delete().eq("kind", kind);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Semua transaksi ${kind} dihapus`);
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
        <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive">
          <Eraser className="size-3.5" />
          Reset Semua
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset seluruh transaksi {kind}?</DialogTitle>
          <DialogDescription>
            Tindakan ini menghapus permanen seluruh transaksi {kind} di database
            {jumlah > 0 ? ` (saat ini ${jumlah} transaksi terlihat pada filter aktif)` : ""}. Ketik{" "}
            <span className="font-mono font-semibold">RESET</span> untuk melanjutkan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="konfirmasi-reset">Konfirmasi</Label>
          <Input
            id="konfirmasi-reset"
            value={konfirmasi}
            onChange={(e) => setKonfirmasi(e.target.value)}
            placeholder="RESET"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={konfirmasi !== "RESET" || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Menghapus…" : "Hapus Semua"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}