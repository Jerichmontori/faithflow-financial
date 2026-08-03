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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const JENIS: Record<"penerimaan" | "pengeluaran", string[]> = {
  penerimaan: [
    "Persembahan Ibadah Minggu",
    "Persembahan Syukur",
    "Perpuluhan",
    "Persembahan Pembangunan",
    "Sumbangan & Donasi",
    "Penerimaan Lain-lain",
  ],
  pengeluaran: [
    "Tunjangan & Honor",
    "Operasional",
    "Utilitas",
    "Pemeliharaan",
    "Kegiatan Ibadah / UPK",
    "Diakonia",
    "Pengeluaran Lain-lain",
  ],
};

const METODE = ["Tunai", "Transfer Bank", "QRIS", "Cek/Giro"];

const schema = z.object({
  trx_date: z.string().min(1, "Tanggal wajib diisi"),
  category: z.string().min(1, "Jenis wajib dipilih"),
  budget_line_id: z.string().uuid("Mata anggaran wajib dipilih"),
  amount: z.number().positive("Nominal harus lebih dari 0").max(1_000_000_000_000),
  description: z.string().trim().max(500),
  payee: z.string().trim().max(150).optional(),
  payment_method: z.string().max(50).optional(),
  attachment_url: z.string().trim().max(500).optional(),
});

export function TransactionDialog({ kind }: { kind: "penerimaan" | "pengeluaran" }) {
  const { user, canManageFinance } = useSession();
  const budgets = useQuery(budgetLinesQuery);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [form, setForm] = useState({
    trx_date: new Date().toISOString().slice(0, 10),
    category: "",
    budget_line_id: "",
    amount: "",
    description: "",
    payee: "",
    payment_method: "Tunai",
    attachment_url: "",
  });

  const options = (budgets.data ?? []).filter((b) => b.kind === kind);
  const selected = options.find((b) => b.id === form.budget_line_id);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        ...form,
        amount: Number(form.amount),
        payee: form.payee || undefined,
        attachment_url: form.attachment_url || undefined,
      });
      const { error } = await supabase.from("transactions").insert({
        trx_date: parsed.trx_date,
        kind,
        category: parsed.category,
        budget_line_id: parsed.budget_line_id,
        amount: parsed.amount,
        description: parsed.description,
        payee: kind === "pengeluaran" ? (parsed.payee ?? null) : null,
        payment_method: kind === "pengeluaran" ? (parsed.payment_method ?? null) : null,
        attachment_url: kind === "pengeluaran" ? (parsed.attachment_url ?? null) : null,
        status: kind === "pengeluaran" ? "pending" : "approved",
        created_by: user!.id,
        voucher_no: "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        kind === "penerimaan" ? "Penerimaan tercatat" : "Pengeluaran diajukan untuk approval",
      );
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setOpen(false);
      setForm((f) => ({ ...f, amount: "", description: "", payee: "", attachment_url: "" }));
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
          <div className="grid gap-4 sm:grid-cols-2">
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
              <Label>Jenis {kind === "penerimaan" ? "Penerimaan" : "Pengeluaran"}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis" />
                </SelectTrigger>
                <SelectContent>
                  {JENIS[kind].map((j) => (
                    <SelectItem key={j} value={j}>
                      {j}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          {kind === "pengeluaran" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
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
                <div className="space-y-2">
                  <Label>Metode Pembayaran</Label>
                  <Select
                    value={form.payment_method}
                    onValueChange={(v) => setForm({ ...form, payment_method: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METODE.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lampiran">Lampiran (tautan bukti)</Label>
                <Input
                  id="lampiran"
                  value={form.attachment_url}
                  onChange={(e) => setForm({ ...form, attachment_url: e.target.value })}
                  placeholder="https://…"
                  maxLength={500}
                />
              </div>
            </>
          )}

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