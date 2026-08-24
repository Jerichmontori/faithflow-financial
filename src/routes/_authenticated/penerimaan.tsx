import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useDeferredValue, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { TransactionDialog } from "@/components/TransactionDialog";
import { KoreksiDialog } from "@/components/KoreksiDialog";
import { HapusTransaksiDialog } from "@/components/HapusTransaksiDialog";
import { CetakBuktiTransaksiDialog } from "@/components/CetakBuktiTransaksiDialog";
import { ImportMassalDialog } from "@/components/ImportMassalDialog";
import { BackupDataDialog } from "@/components/BackupDataDialog";
import { ResetTransaksiDialog } from "@/components/ResetTransaksiDialog";
import { transactionsQuery, budgetLinesQuery } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { DateInput, normalizeDateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Printer, Calendar, Clock, RotateCcw, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/penerimaan")({
  head: () => ({
    meta: [
      { title: "Transaksi Penerimaan — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content: "Catat dan telusuri seluruh penerimaan kas gereja beserta mata anggarannya.",
      },
      { property: "og:title", content: "Transaksi Penerimaan — BUMOTIK FINANCIAL" },
      { property: "og:description", content: "Daftar penerimaan kas gereja per mata anggaran." },
    ],
  }),
  component: PenerimaanPage,
});

const BULAN_OPTIONS = [
  { value: "all", label: "Semua Bulan" },
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

function isValidDate(d: string): boolean {
  if (!d) return false;
  const n = normalizeDateInput(d);
  return /^\d{4}-\d{2}-\d{2}$/.test(n) && !isNaN(Date.parse(n));
}

function PenerimaanPage() {
  const trx = useQuery(transactionsQuery);
  const budgets = useQuery(budgetLinesQuery);
  const today = new Date().toISOString().slice(0, 10);

  const [q, setQ] = useState("");
  const [tahun, setTahun] = useState("all");
  const [bulan, setBulan] = useState("all");
  const [budget, setBudget] = useState("all");
  const [openBudget, setOpenBudget] = useState(false);
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [viewMode, setViewMode] = useState<"today" | "latest" | "all">("today");
  const DEFAULT_LIMIT = 50;

  // Defer filter inputs to prevent blocking UI when typing
  const deferredQ = useDeferredValue(q);
  const deferredTahun = useDeferredValue(tahun);
  const deferredBulan = useDeferredValue(bulan);
  const deferredBudget = useDeferredValue(budget);
  const deferredDari = useDeferredValue(dari);
  const deferredSampai = useDeferredValue(sampai);

  const budgetOptions = useMemo(
    () => (budgets.data ?? []).filter((b) => b.kind === "penerimaan").sort((a, b) => a.code.localeCompare(b.code)),
    [budgets.data],
  );

  const selectedBudget = useMemo(
    () => budgetOptions.find((b) => b.id === budget),
    [budgetOptions, budget],
  );

  // Pre-sort transactions only once when raw data changes
  const sortedPenerimaan = useMemo(() => {
    const list = (trx.data ?? []).filter((t) => t.kind === "penerimaan");
    return list.sort((a, b) => {
      const cmpDate = b.trx_date.localeCompare(a.trx_date);
      if (cmpDate !== 0) return cmpDate;
      return (b.voucher_no || "").localeCompare(a.voucher_no || "");
    });
  }, [trx.data]);

  const allFilteredRows = useMemo(() => {
    const term = deferredQ.trim().toLowerCase();
    const validDari = isValidDate(deferredDari) ? normalizeDateInput(deferredDari) : "";
    const validSampai = isValidDate(deferredSampai) ? normalizeDateInput(deferredSampai) : "";

    return sortedPenerimaan.filter((t) => {
      // Filter tahun
      if (deferredTahun !== "all") {
        if (!t.trx_date.startsWith(deferredTahun)) return false;
      }
      // Filter bulan
      if (deferredBulan !== "all") {
        const monthPart = t.trx_date.slice(5, 7);
        if (monthPart !== deferredBulan) return false;
      }
      // Filter mata anggaran
      if (deferredBudget !== "all" && t.budget_line_id !== deferredBudget) return false;
      // Filter rentang tanggal khusus
      if (validDari && t.trx_date < validDari) return false;
      if (validSampai && t.trx_date > validSampai) return false;
      // Filter kata kunci
      if (
        term &&
        !`${t.description} ${t.category} ${t.voucher_no} ${t.budget_lines?.name ?? ""}`
          .toLowerCase()
          .includes(term)
      )
        return false;
      return true;
    });
  }, [
    sortedPenerimaan,
    deferredQ,
    deferredTahun,
    deferredBulan,
    deferredBudget,
    deferredDari,
    deferredSampai,
  ]);

  const aktif =
    q !== "" ||
    tahun !== "all" ||
    bulan !== "all" ||
    budget !== "all" ||
    (dari !== "" && isValidDate(dari)) ||
    (sampai !== "" && isValidDate(sampai));

  const reset = () => {
    setQ("");
    setTahun("all");
    setBulan("all");
    setBudget("all");
    setDari("");
    setSampai("");
    setViewMode("today");
  };

  // Transaksi hari ini
  const todayRows = useMemo(() => {
    return sortedPenerimaan.filter((t) => t.trx_date === today);
  }, [sortedPenerimaan, today]);

  const [displayLimit, setDisplayLimit] = useState(DEFAULT_LIMIT);

  // Reset limit display saat filter berubah
  useEffect(() => {
    setDisplayLimit(DEFAULT_LIMIT);
  }, [q, tahun, bulan, budget, dari, sampai]);

  // Mode Standar: Menampilkan transaksi hari ini secara default
  const rows = useMemo(() => {
    if (aktif) return allFilteredRows;
    if (viewMode === "all") return allFilteredRows;
    if (viewMode === "latest") return allFilteredRows.slice(0, DEFAULT_LIMIT);
    return todayRows;
  }, [allFilteredRows, aktif, viewMode, todayRows]);

  const displayedRows = useMemo(() => {
    if (aktif || viewMode === "all") {
      return rows.slice(0, displayLimit);
    }
    return rows;
  }, [rows, displayLimit, aktif, viewMode]);

  const total = rows.reduce((a, t) => a + Number(t.amount), 0);
  const totalHariIni = todayRows.reduce((a, t) => a + Number(t.amount), 0);

  return (
    <AppShell
      title="Transaksi Penerimaan"
      subtitle={
        aktif
          ? `${allFilteredRows.length} transaksi hasil filter · total ${rupiah(allFilteredRows.reduce((a, t) => a + Number(t.amount), 0))}`
          : viewMode === "today"
            ? `Penerimaan Hari Ini (${tanggal(today)}): ${todayRows.length} transaksi · total ${rupiah(totalHariIni)}`
            : `${rows.length} transaksi ditampilkan · total ${rupiah(total)}`
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <TransactionDialog kind="penerimaan" />
          <ImportMassalDialog kind="penerimaan" />
          <BackupDataDialog kind="penerimaan" />
          <ResetTransaksiDialog kind="penerimaan" jumlah={allFilteredRows.length} />
        </div>
      }
    >
      <div className="panel mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1.5 xl:col-span-2">
            <Label htmlFor="cari">Filter Keterangan / No. Bukti</Label>
            <Input
              id="cari"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari keterangan, no bukti KM-2026-…, pos…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tahun</Label>
            <Select value={tahun} onValueChange={setTahun}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tahun</SelectItem>
                <SelectItem value="2026">Tahun 2026</SelectItem>
                <SelectItem value="2025">Tahun 2025</SelectItem>
                <SelectItem value="2024">Tahun 2024</SelectItem>
                <SelectItem value="2027">Tahun 2027</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Bulan</Label>
            <Select value={bulan} onValueChange={setBulan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {BULAN_OPTIONS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Mata Anggaran (Bisa Diketik / Searchable Combobox) */}
          <div className="space-y-1.5 xl:col-span-2">
            <Label>Mata Anggaran (Ketik / Cari)</Label>
            <Popover open={openBudget} onOpenChange={setOpenBudget}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openBudget}
                  className="w-full justify-between font-normal h-9 text-xs"
                >
                  <span className="truncate">
                    {selectedBudget
                      ? `${selectedBudget.code} — ${selectedBudget.name}`
                      : "Semua mata anggaran"}
                  </span>
                  <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[340px] sm:w-[460px] p-0" align="start">
                <Command
                  filter={(value, search) =>
                    value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                  }
                >
                  <CommandInput placeholder="Ketik kode, nama, atau pos anggaran…" />
                  <CommandList className="max-h-72 overflow-y-auto">
                    <CommandEmpty>Mata anggaran tidak ditemukan.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="semua all"
                        onSelect={() => {
                          setBudget("all");
                          setOpenBudget(false);
                        }}
                        className="cursor-pointer font-medium"
                      >
                        <Check
                          className={cn(
                            "mr-2 size-3.5",
                            budget === "all" ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span>Semua mata anggaran</span>
                      </CommandItem>
                      {budgetOptions.map((b) => (
                        <CommandItem
                          key={b.id}
                          value={`${b.code} ${b.name} ${b.grup || ""}`}
                          onSelect={() => {
                            setBudget(b.id);
                            setOpenBudget(false);
                          }}
                          className="flex items-start py-2 cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 size-3.5 mt-0.5 shrink-0",
                              budget === b.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-primary">{b.code}</span>
                              <span className="text-xs font-medium text-foreground">{b.name}</span>
                            </div>
                            {b.grup && (
                              <span className="text-[11px] text-muted-foreground">
                                {b.grup}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Baris Rentang Tanggal Khusus */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="dari">Dari Tanggal (Opsional)</Label>
            <DateInput id="dari" value={dari} onChange={setDari} placeholder="YYYY-MM-DD" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sampai">Sampai Tanggal (Opsional)</Label>
            <DateInput id="sampai" value={sampai} onChange={setSampai} placeholder="YYYY-MM-DD" />
          </div>
          <div className="flex items-end gap-2 lg:col-span-2 justify-between">
            <div className="text-xs text-muted-foreground">
              {aktif ? (
                <Badge variant="default" className="text-[11px]">
                  Filter Aktif ({allFilteredRows.length} hasil)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] gap-1 font-medium bg-primary/5 text-primary border-primary/20">
                  <Calendar className="size-3" /> Mode Standar: Transaksi Hari Ini ({tanggal(today)})
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={reset} disabled={!aktif && viewMode === "today"}>
              <RotateCcw className="size-3.5 mr-1" /> Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground border-b">
          <div>
            {aktif ? (
              <span>
                Menampilkan <strong>{rows.length}</strong> transaksi hasil filter (dari total {sortedPenerimaan.length} penerimaan)
              </span>
            ) : viewMode === "today" ? (
              <span>
                Mode Standar: Menampilkan <strong>{rows.length} transaksi penerimaan hari ini</strong> ({tanggal(today)}) · Total: <strong>{rupiah(totalHariIni)}</strong>
              </span>
            ) : viewMode === "latest" ? (
              <span>
                Menampilkan <strong>{rows.length} transaksi terbaru</strong>
              </span>
            ) : (
              <span>
                Menampilkan seluruh <strong>{rows.length}</strong> transaksi penerimaan
              </span>
            )}
          </div>
          {!aktif && (
            <div className="flex items-center gap-1.5">
              <Button
                variant={viewMode === "today" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setViewMode("today")}
              >
                <Calendar className="size-3" /> Hari Ini ({todayRows.length})
              </Button>
              <Button
                variant={viewMode === "latest" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setViewMode("latest")}
              >
                <Clock className="size-3" /> 50 Terbaru
              </Button>
              <Button
                variant={viewMode === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setViewMode("all")}
              >
                Semua ({sortedPenerimaan.length})
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-28 font-bold">Tanggal</TableHead>
                <TableHead className="w-36 font-bold">No. Bukti</TableHead>
                <TableHead className="w-48 font-bold">Jenis / Kategori</TableHead>
                <TableHead className="font-bold">Mata Anggaran</TableHead>
                <TableHead className="font-bold">Keterangan</TableHead>
                <TableHead className="w-36 text-right font-bold">Nominal</TableHead>
                <TableHead className="w-28 text-right font-bold">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedRows.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/10">
                  <TableCell className="whitespace-nowrap font-medium">{tanggal(t.trx_date)}</TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-primary">{t.voucher_no}</TableCell>
                  <TableCell className="text-xs">{t.category}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.budget_lines ? `${t.budget_lines.code} — ${t.budget_lines.name}` : "-"}
                  </TableCell>
                  <TableCell className="max-w-72 truncate text-sm font-medium">{t.description}</TableCell>
                  <TableCell className="text-right font-medium font-mono text-xs text-success">
                    {rupiah(t.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <CetakBuktiTransaksiDialog
                        trx={t}
                        trigger={
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Cetak Tanda Terima Setoran (F4 2-Rangkap)">
                            <Printer className="size-3.5 text-primary" />
                          </Button>
                        }
                      />
                      <KoreksiDialog trx={t} />
                      <HapusTransaksiDialog trx={t} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    {trx.isLoading ? (
                      "Memuat data transaksi…"
                    ) : aktif ? (
                      "Tidak ada transaksi yang cocok dengan filter."
                    ) : viewMode === "today" ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Belum ada transaksi penerimaan yang dicatat untuk hari ini ({tanggal(today)}).</p>
                        <p className="text-xs text-muted-foreground">
                          Gunakan tombol <strong>+ Catat Penerimaan</strong> di atas untuk menambah transaksi hari ini, atau pilih tampilan di bawah:
                        </p>
                        <div className="flex justify-center gap-2 pt-2">
                          <Button size="sm" variant="outline" onClick={() => setViewMode("latest")} className="text-xs">
                            <Clock className="size-3.5 mr-1" /> Tampilkan 50 Transaksi Terbaru
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setViewMode("all")} className="text-xs">
                            Tampilkan Seluruh Transaksi ({sortedPenerimaan.length})
                          </Button>
                        </div>
                      </div>
                    ) : (
                      "Belum ada transaksi penerimaan."
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Panel Muat Lebih Banyak Jika Hasil Filter > Limit */}
        {rows.length > displayLimit && (
          <div className="p-3 bg-muted/20 border-t flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Menampilkan <strong>{displayedRows.length}</strong> dari <strong>{rows.length}</strong> transaksi hasil filter
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDisplayLimit((prev) => prev + 50)}
              >
                Muat 50 Lebih Banyak
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDisplayLimit(rows.length)}
              >
                Tampilkan Semua ({rows.length})
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}