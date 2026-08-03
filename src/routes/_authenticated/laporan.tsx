import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Download, FileDown, RotateCcw } from "lucide-react";
import html2pdf from "html2pdf.js";
import { AppShell } from "@/components/AppShell";
import { budgetLinesQuery, transactionsQuery, isInternalCash } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { BULAN_PANJANG, labelBulan, labelKolom, parseBulan, parseKolom } from "@/lib/kolom";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/laporan")({
  head: () => ({
    meta: [
      { title: "Laporan Penerimaan per Kolom — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Laporan penerimaan gereja per kolom dan per bulan yang diekstrak otomatis dari keterangan transaksi.",
      },
      { property: "og:title", content: "Laporan Penerimaan per Kolom — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Matriks penerimaan kolom × bulan beserta rincian per mata anggaran.",
      },
    ],
  }),
  component: LaporanPage,
});

const MONTH_KEYS = [...BULAN_PANJANG.map((_, i) => i), null] as Array<number | null>;

/** Grup penerimaan yang ditampilkan pada laporan kolom */
const GRUP_LAPORAN = [
  "Persembahan Ibd Kompelka BIPRA",
  "Persembahan Ibadah Kolom",
  "PERSEMBAHAN IBADAH HUT",
  "PERSEMBAHAN IBADAH MENYAMBUT NATAL",
  "SAMPUL - SAMPUL",
  "PERSEMBAHAN IBADAH KHUSUS",
];

function LaporanPage() {
  const trx = useQuery(transactionsQuery);
  const budgets = useQuery(budgetLinesQuery);

  const [budgetId, setBudgetId] = useState("semua");
  const [kolomFilter, setKolomFilter] = useState("semua");
  const [bulanFilter, setBulanFilter] = useState("semua");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [openBudget, setOpenBudget] = useState(false);
  const [tab, setTab] = useState("matriks");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  /** Semua penerimaan (kecuali mutasi kas internal) dengan kolom & bulan hasil parsing keterangan */
  const parsed = useMemo(
    () =>
      (trx.data ?? [])
        .filter((t) => t.kind === "penerimaan" && !isInternalCash(t))
        .map((t) => ({
          ...t,
          kolom: parseKolom(t.description),
          bulan: parseBulan(t.description),
        })),
    [trx.data],
  );

  const budgetOptions = useMemo(
    () =>
      (budgets.data ?? [])
        .filter((b) => b.kind === "penerimaan")
        .filter((b) => GRUP_LAPORAN.includes(b.grup || ""))
        .filter((b) => parsed.some((t) => t.budget_line_id === b.id)),
    [budgets.data, parsed],
  );

  function resetFilter() {
    setBudgetId("semua");
    setKolomFilter("semua");
    setBulanFilter("semua");
    setDari("");
    setSampai("");
  }


  const rows = useMemo(
    () =>
      parsed.filter((t) => {
        const b = (budgets.data ?? []).find((x) => x.id === t.budget_line_id);
        if (!GRUP_LAPORAN.includes(b?.grup || "")) return false;
        if (budgetId !== "semua" && t.budget_line_id !== budgetId) return false;
        if (kolomFilter !== "semua") {
          if (kolomFilter === "tanpa" ? t.kolom !== null : String(t.kolom) !== kolomFilter)
            return false;
        }
        if (bulanFilter !== "semua") {
          if (bulanFilter === "tanpa" ? t.bulan !== null : String(t.bulan) !== bulanFilter)
            return false;
        }
        if (dari && t.trx_date < dari) return false;
        if (sampai && t.trx_date > sampai) return false;
        return true;
      }),
    [parsed, budgets.data, budgetId, kolomFilter, bulanFilter, dari, sampai],
  );

  const kolomList = useMemo(() => {
    const set = new Set<number>();
    const allowed = new Set(
      (budgets.data ?? [])
        .filter((b) => GRUP_LAPORAN.includes(b.grup || ""))
        .map((b) => b.id),
    );
    parsed.forEach((t) => {
      if (allowed.has(t.budget_line_id) && t.kolom !== null) set.add(t.kolom);
    });
    return [...set].sort((a, b) => a - b);
  }, [parsed, budgets.data]);

  /** Matriks kolom × bulan */
  const matrix = useMemo(() => {
    const map = new Map<string, { kolom: number | null; cells: Map<string, number>; total: number }>();
    for (const t of rows) {
      const key = t.kolom === null ? "tanpa" : String(t.kolom);
      if (!map.has(key)) map.set(key, { kolom: t.kolom, cells: new Map(), total: 0 });
      const entry = map.get(key)!;
      const mk = t.bulan === null ? "tanpa" : String(t.bulan);
      entry.cells.set(mk, (entry.cells.get(mk) ?? 0) + Number(t.amount));
      entry.total += Number(t.amount);
    }
    return [...map.values()].sort((a, b) => (a.kolom ?? 9999) - (b.kolom ?? 9999));
  }, [rows]);

  const columnTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of rows) {
      const mk = t.bulan === null ? "tanpa" : String(t.bulan);
      totals.set(mk, (totals.get(mk) ?? 0) + Number(t.amount));
    }
    return totals;
  }, [rows]);

  const grandTotal = rows.reduce((a, t) => a + Number(t.amount), 0);

  /** Rekap per mata anggaran × bulan */
  const perAnggaran = useMemo(() => {
    const map = new Map<
      string,
      { id: string | null; label: string; cells: Map<string, number>; total: number }
    >();
    for (const t of rows) {
      const label = t.budget_lines
        ? `${t.budget_lines.code} — ${t.budget_lines.name}`
        : "Tanpa Mata Anggaran";
      if (!map.has(label))
        map.set(label, {
          id: t.budget_line_id ?? null,
          label,
          cells: new Map(),
          total: 0,
        });
      const entry = map.get(label)!;
      const mk = t.bulan === null ? "tanpa" : String(t.bulan);
      entry.cells.set(mk, (entry.cells.get(mk) ?? 0) + Number(t.amount));
      entry.total += Number(t.amount);
    }
    return [...map.values()]
      .filter((r) => r.total !== 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const activeMonths = useMemo(
    () => MONTH_KEYS.filter((m) => columnTotals.has(m === null ? "tanpa" : String(m))),
    [columnTotals],
  );

  function exportCsv() {
    const header = ["Kolom", ...activeMonths.map((m) => labelBulan(m)), "Total"];
    const body = matrix.map((r) => [
      labelKolom(r.kolom),
      ...activeMonths.map((m) => r.cells.get(m === null ? "tanpa" : String(m)) ?? 0),
      r.total,
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "laporan-penerimaan-kolom.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedBudget = budgetOptions.find((b) => b.id === budgetId);

  return (
    <AppShell
      title="Laporan Penerimaan per Kolom"
      subtitle={`${rows.length} transaksi · total ${rupiah(grandTotal)}`}
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={resetFilter}>
            <RotateCcw className="size-4" /> Reset filter
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-4" /> Ekspor CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <FileDown className="size-4" /> Download PDF
          </Button>
        </div>
      }
    >
      <div className="print-only mb-4 hidden border-b border-black pb-3">
        <h2 className="text-lg font-bold">Laporan Penerimaan per Kolom</h2>
        <p className="text-sm">BUMOTIK FINANCIAL</p>
        <p className="text-sm">
          {rows.length} transaksi · total {rupiah(grandTotal)}
          {dari && sampai ? ` · periode ${tanggal(dari)} s.d. ${tanggal(sampai)}` : ""}
        </p>
      </div>
      <div className="panel no-print mb-5 grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="space-y-1.5 xl:col-span-2">
          <Label>Mata Anggaran</Label>
          <Popover open={openBudget} onOpenChange={setOpenBudget}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                <span className="truncate">
                  {selectedBudget
                    ? `${selectedBudget.code} — ${selectedBudget.name}`
                    : "Semua mata anggaran"}
                </span>
                <ChevronsUpDown className="size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Cari kode atau nama…" />
                <CommandList>
                  <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="semua"
                      onSelect={() => {
                        setBudgetId("semua");
                        setOpenBudget(false);
                      }}
                    >
                      <Check
                        className={cn("size-4", budgetId === "semua" ? "opacity-100" : "opacity-0")}
                      />
                      Semua mata anggaran
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
                          className={cn("size-4", budgetId === b.id ? "opacity-100" : "opacity-0")}
                        />
                        <span className="font-mono text-xs">{b.code}</span> {b.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label>Kolom</Label>
          <Select
            value={kolomFilter}
            onValueChange={(v) => {
              setKolomFilter(v);
              if (v !== "semua") setTab("rincian");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="semua">Semua kolom</SelectItem>
              <SelectItem value="tanpa">Tanpa kolom</SelectItem>
              {kolomList.map((k) => (
                <SelectItem key={k} value={String(k)}>
                  Kolom {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Bulan (dari keterangan)</Label>
          <Select value={bulanFilter} onValueChange={setBulanFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="semua">Semua bulan</SelectItem>
              <SelectItem value="tanpa">Tanpa bulan</SelectItem>
              {BULAN_PANJANG.map((b, i) => (
                <SelectItem key={b} value={String(i)}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Dari</Label>
            <Input type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Sampai</Label>
            <Input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} />
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="no-print">
          <TabsTrigger value="matriks">Kolom × Bulan</TabsTrigger>
          <TabsTrigger value="anggaran">Mata Anggaran × Bulan</TabsTrigger>
          <TabsTrigger value="rincian">Rincian Transaksi</TabsTrigger>
        </TabsList>

        <TabsContent value="matriks">
          <div className="panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">Kolom</TableHead>
                  {activeMonths.map((m) => (
                    <TableHead key={String(m)} className="text-right whitespace-nowrap">
                      {labelBulan(m)}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.map((r) => (
                  <TableRow
                    key={String(r.kolom)}
                    className="cursor-pointer"
                    onClick={() => {
                      setKolomFilter(r.kolom === null ? "tanpa" : String(r.kolom));
                      setTab("rincian");
                    }}
                  >
                    <TableCell className="sticky left-0 bg-card font-medium">
                      {labelKolom(r.kolom)}
                    </TableCell>
                    {activeMonths.map((m) => {
                      const v = r.cells.get(m === null ? "tanpa" : String(m)) ?? 0;
                      return (
                        <TableCell
                          key={String(m)}
                          className={cn(
                            "text-right text-sm whitespace-nowrap",
                            v === 0 && "text-muted-foreground/50",
                          )}
                        >
                          {v === 0 ? "—" : rupiah(v)}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-semibold whitespace-nowrap text-success">
                      {rupiah(r.total)}
                    </TableCell>
                  </TableRow>
                ))}
                {matrix.length > 0 && (
                  <TableRow className="bg-muted/40">
                    <TableCell className="sticky left-0 bg-muted/40 font-semibold">Total</TableCell>
                    {activeMonths.map((m) => (
                      <TableCell
                        key={String(m)}
                        className="text-right font-semibold whitespace-nowrap"
                      >
                        {rupiah(columnTotals.get(m === null ? "tanpa" : String(m)) ?? 0)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold whitespace-nowrap">
                      {rupiah(grandTotal)}
                    </TableCell>
                  </TableRow>
                )}
                {matrix.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      {trx.isLoading ? "Memuat data…" : "Tidak ada data untuk filter ini."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="anggaran">
          <div className="panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">Mata Anggaran</TableHead>
                  {activeMonths.map((m) => (
                    <TableHead key={String(m)} className="text-right whitespace-nowrap">
                      {labelBulan(m)}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perAnggaran.map((r) => (
                  <TableRow
                    key={r.label}
                    className="cursor-pointer"
                    onClick={() => {
                      if (r.id) setBudgetId(r.id);
                      setTab("rincian");
                    }}
                  >
                    <TableCell className="sticky left-0 bg-card min-w-72 text-sm">
                      {r.label}
                    </TableCell>
                    {activeMonths.map((m) => {
                      const v = r.cells.get(m === null ? "tanpa" : String(m)) ?? 0;
                      return (
                        <TableCell
                          key={String(m)}
                          className={cn(
                            "text-right text-sm whitespace-nowrap",
                            v === 0 && "text-muted-foreground/50",
                          )}
                        >
                          {v === 0 ? "—" : rupiah(v)}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-semibold whitespace-nowrap text-success">
                      {rupiah(r.total)}
                    </TableCell>
                  </TableRow>
                ))}
                {perAnggaran.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      {trx.isLoading ? "Memuat data…" : "Tidak ada data untuk filter ini."}
                    </TableCell>
                  </TableRow>
                )}
                {perAnggaran.length > 0 && (
                  <TableRow className="bg-muted/40">
                    <TableCell className="sticky left-0 bg-muted/40 font-semibold">Total</TableCell>
                    {activeMonths.map((m) => (
                      <TableCell
                        key={String(m)}
                        className="text-right font-semibold whitespace-nowrap"
                      >
                        {rupiah(columnTotals.get(m === null ? "tanpa" : String(m)) ?? 0)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold whitespace-nowrap">
                      {rupiah(grandTotal)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="rincian">
          <div className="panel overflow-x-auto">
            {budgetId !== "semua" && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Mata anggaran terpilih:</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {selectedBudget?.code ?? "-"}
                </Badge>
                <span className="text-sm font-medium">{selectedBudget?.name}</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setBudgetId("semua")}>
                  <RotateCcw className="mr-1 size-3" /> Reset
                </Button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>No. Bukti</TableHead>
                  <TableHead>Kolom</TableHead>
                  <TableHead>Bulan</TableHead>
                  <TableHead>Mata Anggaran</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 500).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">{tanggal(t.trx_date)}</TableCell>
                    <TableCell className="font-mono text-xs">{t.voucher_no}</TableCell>
                    <TableCell>
                      <Badge variant={t.kolom === null ? "outline" : "secondary"}>
                        {labelKolom(t.kolom)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{labelBulan(t.bulan)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.budget_line_id ? (
                        <button
                          className="text-left hover:text-foreground hover:underline"
                          onClick={() => setBudgetId(t.budget_line_id)}
                        >
                          {t.budget_lines ? `${t.budget_lines.code} — ${t.budget_lines.name}` : "-"}
                        </button>
                      ) : (
                        t.budget_lines ? `${t.budget_lines.code} — ${t.budget_lines.name}` : "-"
                      )}
                    </TableCell>
                    <TableCell className="max-w-72 truncate text-sm">{t.description}</TableCell>
                    <TableCell className="text-right font-medium text-success whitespace-nowrap">
                      {rupiah(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length > 0 && (
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={6} className="text-right font-semibold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold whitespace-nowrap text-success">
                      {rupiah(grandTotal)}
                    </TableCell>
                  </TableRow>
                )}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      {trx.isLoading ? "Memuat data…" : "Tidak ada transaksi untuk filter ini."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {rows.length > 500 && (
              <p className="px-4 py-3 text-xs text-muted-foreground">
                Menampilkan 500 dari {rows.length} transaksi — persempit filter untuk melihat sisanya.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}