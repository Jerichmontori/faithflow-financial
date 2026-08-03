import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { budgetLinesQuery } from "@/lib/queries";
import { useSession } from "@/hooks/use-session";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  trx_date: z.string().min(1, "Tanggal wajib diisi"),
  category: z.string().max(150),
  budget_line_id: z.string().uuid("Mata anggaran wajib dipilih"),
  amount: z.number().positive("Nominal harus lebih dari 0").max(1_000_000_000_000),
  description: z.string().trim().max(500),
  payee: z.string().trim().max(150).optional(),
});

export function TransactionDialog({ kind }: { kind: "penerimaan" | "pengeluaran" }) {
  const { user, canManageFinance } = useSession();
  const budgets = useQuery(budgetLinesQuery);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [items, setItems] = useState([{ description: "", amount: "" }]);
  const [form, setForm] = useState({
    trx_date: new Date().toISOString().slice(0, 10),
    category: "",
    budget_line_id: "",
    amount: "",
    description: "",
    payee: "",
  });

  const options = (budgets.data ?? []).filter((b) => b.kind === kind);
  const selected = options.find((b) => b.id === form.budget_line_id);

  const mutation = useMutation({
    mutationFn: async () => {
      const baris =
        kind === "penerimaan"
          ? items.filter((i) => i.amount !== "" || i.description.trim() !== "")
          : [{ description: form.description, amount: form.amount }];
      if (baris.length === 0) throw new Error("Minimal satu keterangan wajib diisi");
      const rows = baris.map((b) => {
        const parsed = schema.parse({
          ...form,
          description: b.description,
          amount: Number(b.amount),
          payee: form.payee || undefined,
        });
        return {
          trx_date: parsed.trx_date,
          kind,
          category: "",
          budget_line_id: parsed.budget_line_id,
          amount: parsed.amount,
          description: parsed.description,
          payee: kind === "pengeluaran" ? (parsed.payee ?? null) : null,
          payment_method: null,
          attachment_url: null,
          status: (kind === "pengeluaran" ? "pending" : "approved") as "pending" | "approved",
          created_by: user!.id,
          voucher_no: "",
        };
      });
      const { error } = await supabase.from("transactions").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(
        kind === "penerimaan"
          ? `${count} penerimaan tercatat`
          : "Pengeluaran diajukan untuk approval",
      );
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setOpen(false);
      setItems([{ description: "", amount: "" }]);
      setForm((f) => ({ ...f, amount: "", description: "", payee: "" }));
    },
    onError: (err) => {
      toast.error(
        err instanceof z.ZodError
          ? (err.issues[0]?.message ?? "Data tidak valid")
          : err instanceof Error
            ? err.message
            : "Gagal menyimpan",
      );
    },
  });

  if (!canManageFinance) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          {kind === "penerimaan" ? "Catat Penerimaan" : "Ajukan Pengeluaran"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {kind === "penerimaan" ? "Transaksi Penerimaan" : "Transaksi Pengeluaran"}
          </DialogTitle>
          <DialogDescription>
            Nomor bukti dibuat otomatis oleh sistem setelah transaksi disimpan.
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
              <Label htmlFor="tanggal">Tanggal</Label>
              <Input
                id="tanggal"
                type="date"
                value={form.trx_date}
                onChange={(e) => setForm({ ...form, trx_date: e.target.value })}
                required
              />
          </div>

          <div className="space-y-2">
            <Label>Mata Anggaran (wajib)</Label>
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
                    {selected ? `${selected.code} — ${selected.name}` : "Pilih kode mata anggaran"}
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
                      {options.map((b) => (
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

          {kind === "penerimaan" ? (
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
                    placeholder={`Keterangan ${idx + 1}`}
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
          ) : (
            <div className="space-y-2">
              <Label htmlFor="nominal">Nominal (Rp)</Label>
              <Input
                id="nominal"
                type="number"
                min={1}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                required
              />
            </div>
          )}

          {kind === "pengeluaran" && (
            <div className="space-y-2">
                  <Label htmlFor="penerima">Penerima</Label>
                  <Input
                    id="penerima"
                    value={form.payee}
                    onChange={(e) => setForm({ ...form, payee: e.target.value })}
                    placeholder="Nama penerima"
                    maxLength={150}
                  />
            </div>
          )}

          {kind === "pengeluaran" && (
            <div className="space-y-2">
              <Label htmlFor="ket">Keterangan</Label>
              <Textarea
                id="ket"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Uraian transaksi"
                maxLength={500}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}