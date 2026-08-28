import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase, anonInsforge } from "@/integrations/supabase/client";
import { budgetLinesQuery } from "@/lib/queries";
import { useSession } from "@/hooks/use-session";
import { rupiah } from "@/lib/format";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  trx_date: z.string().min(1, "Tanggal wajib diisi"),
  budget_line_id: z.string().uuid("Mata anggaran wajib dipilih"),
  reklas_budget_line_id: z.string().uuid("Mata anggaran reklas wajib dipilih"),
  amount: z.number().positive("Nominal harus lebih dari 0").max(1_000_000_000_000),
  description: z.string().trim().max(500),
});

export function ReklasDialog() {
  const { user, canManageFinance } = useSession();
  const budgets = useQuery(budgetLinesQuery);
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [reklasBudgetOpen, setReklasBudgetOpen] = useState(false);

  const [items, setItems] = useState([{ description: "", amount: "" }]);
  const [form, setForm] = useState({
    trx_date: new Date().toISOString().slice(0, 10),
    budget_line_id: "",
    reklas_budget_line_id: "",
  });

  const allBudgets = budgets.data ?? [];
  const optionsWajib = allBudgets.filter((b) => b.kind === "penerimaan");
  const optionsReklas = allBudgets; // bisa pengeluaran atau pos lain yang direklas

  const selectedWajib = allBudgets.find((b) => b.id === form.budget_line_id);
  const selectedReklas = allBudgets.find((b) => b.id === form.reklas_budget_line_id);

  const totalNominal = items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);

  const mutation = useMutation({
    mutationFn: async () => {
      const baris = items.filter((i) => i.amount !== "" || i.description.trim() !== "");
      if (baris.length === 0) throw new Error("Minimal satu rincian transaksi wajib diisi");
      if (!form.budget_line_id) throw new Error("Mata anggaran wajib dipilih");
      if (!form.reklas_budget_line_id) throw new Error("Mata anggaran reklas wajib dipilih");

      const reklasInfo = selectedReklas
        ? `${selectedReklas.code} — ${selectedReklas.name}`
        : "";

      const rows = baris.map((b) => {
        const parsed = schema.parse({
          trx_date: form.trx_date,
          budget_line_id: form.budget_line_id,
          reklas_budget_line_id: form.reklas_budget_line_id,
          description: b.description,
          amount: Number(b.amount),
        });

        return {
          trx_date: parsed.trx_date,
          kind: "penerimaan" as const,
          category: "Reklas",
          budget_line_id: parsed.budget_line_id,
          koreksi_dari: `Reklas dari: ${reklasInfo}`,
          koreksi_catatan: `Reklasifikasi dari mata anggaran ${reklasInfo}`,
          amount: parsed.amount,
          description: parsed.description,
          payee: null,
          payment_method: null,
          attachment_url: null,
          status: "approved" as const,
          created_by: user?.id || "d85246e0-b540-4c1f-9ae1-e2eee815376b",
          voucher_no: "",
        };
      });

      const { error } = await supabase.from("transactions").insert(rows);
      if (error) {
        const fb = await anonInsforge.database.from("transactions").insert(rows);
        if (fb.error) throw fb.error;
      }
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} transaksi reklas berhasil dicatat`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setOpen(false);
      setItems([{ description: "", amount: "" }]);
      setForm({
        trx_date: new Date().toISOString().slice(0, 10),
        budget_line_id: "",
        reklas_budget_line_id: "",
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof z.ZodError
          ? (err.issues[0]?.message ?? "Data tidak valid")
          : err instanceof Error
            ? err.message
            : "Gagal menyimpan transaksi reklas",
      );
    },
  });

  if (!canManageFinance) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" /> Input Transaksi Reklas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transaksi Pengembalian / Reklas</DialogTitle>
          <DialogDescription>
            Input transaksi reklasifikasi atau pengembalian dana. Nomor bukti dibuat otomatis oleh sistem.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="tanggal-reklas">Tanggal</Label>
            <Input
              id="tanggal-reklas"
              type="date"
              value={form.trx_date}
              onChange={(e) => setForm({ ...form, trx_date: e.target.value })}
              required
            />
          </div>

          {/* 1. Mata Anggaran Wajib */}
          <div className="space-y-2">
            <Label>1. Mata Anggaran Wajib (Penerimaan)</Label>
            <Popover open={budgetOpen} onOpenChange={setBudgetOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={budgetOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedWajib
                      ? `${selectedWajib.code} — ${selectedWajib.name}`
                      : "Pilih mata anggaran wajib"}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                  filter={(value, search) =>
                    value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                  }
                >
                  <CommandInput placeholder="Cari kode atau nama…" />
                  <CommandList>
                    <CommandEmpty>Mata anggaran tidak ditemukan.</CommandEmpty>
                    <CommandGroup>
                      {optionsWajib.map((b) => (
                        <CommandItem
                          key={b.id}
                          value={`${b.code} ${b.name}`}
                          onSelect={() => {
                            setForm({ ...form, budget_line_id: b.id });
                            setBudgetOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              form.budget_line_id === b.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="font-mono text-xs">{b.code}</span>
                          <span className="truncate">{b.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* 2. Mata Anggaran Reklas */}
          <div className="space-y-2">
            <Label>2. Mata Anggaran Reklas (Asal / Sumber)</Label>
            <Popover open={reklasBudgetOpen} onOpenChange={setReklasBudgetOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={reklasBudgetOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedReklas
                      ? `${selectedReklas.code} — ${selectedReklas.name}`
                      : "Pilih mata anggaran yang direklas"}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                  filter={(value, search) =>
                    value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                  }
                >
                  <CommandInput placeholder="Cari kode atau nama…" />
                  <CommandList>
                    <CommandEmpty>Mata anggaran tidak ditemukan.</CommandEmpty>
                    <CommandGroup>
                      {optionsReklas.map((b) => (
                        <CommandItem
                          key={b.id}
                          value={`${b.code} ${b.name}`}
                          onSelect={() => {
                            setForm({ ...form, reklas_budget_line_id: b.id });
                            setReklasBudgetOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              form.reklas_budget_line_id === b.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="font-mono text-xs">{b.code}</span>
                          <span className="truncate">{b.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Rincian Keterangan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Rincian Keterangan (maks. 5)</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={items.length >= 5}
                onClick={() => setItems([...items, { description: "", amount: "" }])}
              >
                Tambah baris
              </Button>
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
                <Input
                  value={it.description}
                  onChange={(e) =>
                    setItems(
                      items.map((x, i) =>
                        i === idx ? { ...x, description: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder={`Keterangan reklas ${idx + 1}`}
                  maxLength={500}
                />
                <Input
                  type="number"
                  min={1}
                  value={it.amount}
                  onChange={(e) =>
                    setItems(items.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))
                  }
                  placeholder="Nominal"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={items.length === 1}
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  aria-label="Hapus baris"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Total Transaksi */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
            <span className="text-sm font-medium text-muted-foreground">Total Transaksi Reklas</span>
            <span className="text-base font-bold text-primary">{rupiah(totalNominal)}</span>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Menyimpan…" : "Simpan Reklas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
