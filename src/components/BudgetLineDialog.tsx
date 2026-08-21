import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import type { BudgetLine } from "@/lib/queries";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BudgetLineDialogProps {
  budget?: BudgetLine;
  defaultKind?: "penerimaan" | "pengeluaran";
}

export function BudgetLineDialog({ budget, defaultKind = "penerimaan" }: BudgetLineDialogProps) {
  const { canManageFinance } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const isEdit = Boolean(budget);

  const [form, setForm] = useState({
    code: "",
    name: "",
    kind: defaultKind as "penerimaan" | "pengeluaran",
    grup: "",
    planned_amount: "",
    fiscal_year: new Date().getFullYear(),
  });

  useEffect(() => {
    if (budget) {
      setForm({
        code: budget.code,
        name: budget.name,
        kind: budget.kind,
        grup: budget.grup || "",
        planned_amount: String(budget.planned_amount || ""),
        fiscal_year: budget.fiscal_year || new Date().getFullYear(),
      });
    } else {
      setForm({
        code: "",
        name: "",
        kind: defaultKind,
        grup: "",
        planned_amount: "",
        fiscal_year: new Date().getFullYear(),
      });
    }
  }, [budget, defaultKind, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const code = form.code.trim();
      const name = form.name.trim();
      const grup = form.grup.trim();
      const planned_amount = Number(form.planned_amount.replace(/[^\d.-]/g, "")) || 0;
      const fiscal_year = Number(form.fiscal_year) || new Date().getFullYear();

      if (!code) throw new Error("Kode mata anggaran wajib diisi");
      if (!name) throw new Error("Nama mata anggaran wajib diisi");

      if (isEdit && budget) {
        const { error } = await supabase
          .from("budget_lines")
          .update({
            code,
            name,
            kind: form.kind,
            grup,
            planned_amount,
            fiscal_year,
          })
          .eq("id", budget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budget_lines").insert({
          code,
          name,
          kind: form.kind,
          grup,
          planned_amount,
          fiscal_year,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        isEdit
          ? "Mata anggaran berhasil diperbarui"
          : "Mata anggaran baru berhasil ditambahkan",
      );
      queryClient.invalidateQueries({ queryKey: ["budget_lines"] });
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan mata anggaran");
    },
  });

  if (!canManageFinance) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="size-8" aria-label="Ubah Mata Anggaran">
            <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" /> Tambah Mata Anggaran
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Ubah Mata Anggaran" : "Tambah Mata Anggaran Baru"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui rincian kode, nama, pagu, atau grup mata anggaran."
              : "Tambahkan kode mata anggaran baru untuk pos penerimaan atau pengeluaran."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="kode-anggaran">Kode Anggaran</Label>
              <Input
                id="kode-anggaran"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="misal: 1.3.01.01"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jenis</Label>
              <Select
                value={form.kind}
                onValueChange={(v: "penerimaan" | "pengeluaran") =>
                  setForm({ ...form, kind: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="penerimaan">Penerimaan (Pendapatan)</SelectItem>
                  <SelectItem value="pengeluaran">Pengeluaran (Belanja)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nama-anggaran">Nama Mata Anggaran</Label>
            <Input
              id="nama-anggaran"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="misal: Pria/Kaum Bapa"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grup-anggaran">Grup / Kategori</Label>
            <Input
              id="grup-anggaran"
              value={form.grup}
              onChange={(e) => setForm({ ...form, grup: e.target.value })}
              placeholder="misal: KOMISI PELAYANAN KATEGORIAL"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pagu-anggaran">Pagu Anggaran (Rp)</Label>
              <Input
                id="pagu-anggaran"
                type="number"
                min={0}
                value={form.planned_amount}
                onChange={(e) => setForm({ ...form, planned_amount: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tahun-anggaran">Tahun</Label>
              <Input
                id="tahun-anggaran"
                type="number"
                value={form.fiscal_year}
                onChange={(e) => setForm({ ...form, fiscal_year: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
