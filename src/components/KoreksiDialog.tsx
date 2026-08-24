import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Transaction } from "@/lib/queries";
import { rupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function KoreksiDialog({ trx }: { trx: Transaction }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(trx.amount));
  const [description, setDescription] = useState(trx.description ?? "");
  const [paymentMethod, setPaymentMethod] = useState(trx.payment_method || "cash");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setAmount(String(trx.amount));
      setDescription(trx.description ?? "");
      setPaymentMethod(trx.payment_method || "cash");
    }
  }, [open, trx.amount, trx.description, trx.payment_method]);

  const mutation = useMutation({
    mutationFn: async () => {
      const cleanNominal = Number(String(amount).replace(/[^0-9.-]+/g, ""));
      if (!Number.isFinite(cleanNominal) || cleanNominal <= 0) {
        throw new Error("Nominal harus berupa angka lebih dari 0");
      }
      const { error } = await supabase
        .from("transactions")
        .update({ amount: cleanNominal, description, payment_method: paymentMethod })
        .eq("id", trx.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Transaksi ${trx.voucher_no} berhasil dikoreksi`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setOpen(false);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Gagal mengoreksi transaksi"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Pencil className="size-3.5" />
          Koreksi
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Koreksi Transaksi</DialogTitle>
          <DialogDescription>
            {trx.voucher_no} · nilai saat ini {rupiah(trx.amount)}. Perbaiki nominal dan/atau
            keterangan jika terjadi salah input.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="koreksi-nominal">Nominal</Label>
            <Input
              id="koreksi-nominal"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            />
            <p className="text-xs text-muted-foreground">{rupiah(Number(amount) || 0)}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="koreksi-keterangan">Keterangan</Label>
            <Textarea
              id="koreksi-keterangan"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="koreksi-metode">Metode Pembayaran / Sumber Kas</Label>
            <select
              id="koreksi-metode"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="cash">💵 Kas Fisik (Tunai)</option>
              <option value="transfer">🏦 Bank / Non-Tunai (Tidak Kurangi Fisik)</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Menyimpan…" : "Simpan Koreksi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
