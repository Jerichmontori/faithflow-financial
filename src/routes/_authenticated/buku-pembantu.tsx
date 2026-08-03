import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { budgetLinesQuery, transactionsQuery } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/buku-pembantu")({
  head: () => ({
    meta: [
      { title: "Buku Pembantu — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Telusuri rincian transaksi kas gereja dengan filter jenis transaksi, mata anggaran, periode, dan kata kunci.",
      },
      { property: "og:title", content: "Buku Pembantu — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Rincian mutasi kas per mata anggaran lengkap dengan saldo berjalan.",
      },
    ],
  }),
  component: BukuPembantuPage,
});

type KindFilter = "semua" | "penerimaan" | "pengeluaran";

function BukuPembantuPage() {
  const trx = useQuery(transactionsQuery);
  const budgets = useQuery(budgetLinesQuery);

  const [kind, setKind] = useState<KindFilter>("semua");
  const [budgetId, setBudgetId] = useState<string>("semua");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [q, setQ] = useState("");
  const [openBudget, setOpenBudget] = useState(false);

  const budgetOptions = useMemo(
    () => (budgets.data ?? []).filter((b) => kind === "semua" || b.kind === kind),
    [budgets.data, kind],
  );
  const selectedBudget = budgetOptions.find((b) => b.id === budgetId);

  const rows = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return (trx.data ?? [])
      .filter((t) => t.status !== "rejected")
      .filter((t) => kind === "semua" || t.kind === kind)
      .filter((t) => budgetId === "semua" || t.budget_line_id === budgetId)
      .filter((t) => (dari ? t.trx_date >= dari : true))
      .filter((t) => (sampai ? t.trx_date <= sampai : true))
      .filter((t) =>
        keyword
          ? [t.voucher_no, t.description, t.category, t.payee ?? "", t.budget_lines?.code ?? "", t.budget_lines?.name ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(keyword)
          : true,
      )
      .slice()
      .sort((a, b) =>
        a.trx_date === b.trx_date
          ? a.created_at.localeCompare(b.created_at)
          : a.trx_date.localeCompare(b.trx_date),
      );
  }, [trx.data, kind, budgetId, dari, sampai, q]);

  const totalMasuk = rows
    .filter((t) => t.kind === "penerimaan")
    .reduce((a, t) => a + Number(t.amount), 0);
  const totalKeluar = rows
    .filter((t) => t.kind === "pengeluaran")
    .reduce((a, t) => a + Number(t.amount), 0);

  let running = 0;
  const withSaldo = rows.map((t) => {
    running += t.kind === "penerimaan" ? Number(t.amount) : -Number(t.amount);
    return { t, saldo: running };
  });

  const adaFilter =
    kind !== "semua" || budgetId !== "semua" || dari !== "" || sampai !== "" || q !== "";

  function reset() {
    setKind("semua");
    setBudgetId("semua");
    setDari("");
    setSampai("");
    setQ("");
  }

  return (
    <AppShell
      title="Buku Pembantu"
      subtitle={`${rows.length} rincian transaksi · masuk ${rupiah(totalMasuk)} · keluar ${rupiah(totalKeluar)}`}
      actions={
        adaFilter ? (
          <Button variant="outline" size="sm" onClick={reset}>
            <X className="size-4" /> Reset filter
          </Button>
        ) : null
      }
    >
      <section className="panel p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label>Jenis Transaksi</Label>
            <Select
              value={kind}
              onValueChange={(v) => {
                setKind(v as KindFilter);
                setBudgetId("semua");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Jenis</SelectItem>
                <SelectItem value="penerimaan">Penerimaan</SelectItem>
                <SelectItem value="pengeluaran">Pengeluaran</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 xl:col-span-2">
            <Label>Mata Anggaran</Label>
            <Popover open={openBudget} onOpenChange={setOpenBudget}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openBudget}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedBudget
                      ? `${selectedBudget.code} — ${selectedBudget.name}`
                      : "Semua Mata Anggaran"}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
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
                      <CommandItem
                        value="semua mata anggaran"
                        onSelect={() => {
                          setBudgetId("semua");
                          setOpenBudget(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "size-4",
                            budgetId === "semua" ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Semua Mata Anggaran
                      </CommandItem>
                      {budgetOptions.map((b) => (
                        <CommandItem
                          key={b.id}
                          value={`${b.code} ${b.name}`}
                          onSelect={() => {
                            setBudgetId(b.id);
                            setOpenBudget(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "size-4",
                              budgetId === b.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="font-mono text-xs text-muted-foreground">{b.code}</span>
                          <span className="truncate">{b.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dari">Dari Tanggal</Label>
            <Input id="dari" type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sampai">Sampai Tanggal</Label>
            <Input
              id="sampai"
              type="date"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2 xl:col-span-5">
            <Label htmlFor="q">Kata Kunci</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari no. bukti, keterangan, penerima…"
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </section>

      {selectedBudget && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pagu Anggaran</p>
            <p className="mt-1.5 text-lg font-semibold">{rupiah(selectedBudget.planned_amount)}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Realisasi</p>
            <p className="mt-1.5 text-lg font-semibold">{rupiah(totalMasuk + totalKeluar)}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Sisa Pagu</p>
            <p className="mt-1.5 text-lg font-semibold">
              {rupiah(Number(selectedBudget.planned_amount) - (totalMasuk + totalKeluar))}
            </p>
          </div>
        </div>
      )}

      <div className="panel mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>No. Bukti</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Mata Anggaran</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="text-right">Masuk</TableHead>
              <TableHead className="text-right">Keluar</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {withSaldo.map(({ t, saldo }) => (
              <TableRow key={t.id}>
                <TableCell className="whitespace-nowrap">{tanggal(t.trx_date)}</TableCell>
                <TableCell className="font-mono text-xs">{t.voucher_no}</TableCell>
                <TableCell>
                  <Badge variant={t.kind === "penerimaan" ? "secondary" : "outline"}>
                    {t.kind === "penerimaan" ? "Penerimaan" : "Pengeluaran"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.budget_lines ? `${t.budget_lines.code} — ${t.budget_lines.name}` : "-"}
                </TableCell>
                <TableCell className="max-w-64 truncate text-sm">
                  {t.description || t.category}
                </TableCell>
                <TableCell className="text-right font-medium text-success">
                  {t.kind === "penerimaan" ? rupiah(t.amount) : "—"}
                </TableCell>
                <TableCell className="text-right font-medium text-destructive">
                  {t.kind === "pengeluaran" ? rupiah(t.amount) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{rupiah(saldo)}</TableCell>
              </TableRow>
            ))}
            {withSaldo.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  {trx.isLoading ? "Memuat data…" : "Tidak ada transaksi sesuai filter."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/buku-pembantu')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/buku-pembantu"!</div>
}
