import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Download, FileDown, RotateCcw, AlertCircle, CheckCircle2, Filter } from "lucide-react";
import html2pdf from "html2pdf.js";
import { AppShell } from "@/components/AppShell";
import { budgetLinesQuery, transactionsQuery, isInternalCash } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import {
  BULAN_PANJANG,
  labelBulan,
  labelKolom,
  parseBulan,
  parseKolom,
  parseNamaKolom,
} from "@/lib/kolom";
import { exportAoa, type Cell } from "@/lib/xlsx";
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
        content: "Matriks penerimaan kolom × bulan beserta monitoring setoran belum setor.",
      },
    ],
  }),
  component: LaporanPage,
});

const MONTH_KEYS = [...BULAN_PANJANG.map((_, i) => i), null] as Array<number | null>;
const DAFTAR_29_KOLOM = Array.from({ length: 29 }, (_, i) => i + 1);

/** Grup penerimaan yang ditampilkan pada laporan kolom */
const GRUP_LAPORAN = [
  "Persembahan Ibd Kompelka BIPRA",
  "Persembahan Ibadah Kolom",
  "PERSEMBAHAN IBADAH HUT",
  "PERSEMBAHAN IBADAH MENYAMBUT NATAL",
  "SAMPUL - SAMPUL",
  "PERSEMBAHAN IBADAH KHUSUS",
  "Diakonia Dana Duka",
  "HASIL PENGGALANGAN DANA PEMBANGUNAN DARI KOLOM",
];

const KATEGORI_MONITORING = [
  { id: "semua", label: "Semua Pos Setoran Kolom" },
  { id: "1.3.53.01", label: "Ibadah Perkunjungan Rutin Kolom" },
  { id: "1.3.53.02", label: "Pria/Kaum Bapa (PKB) Kolom" },
  { id: "1.3.53.03", label: "Wanita/Kaum Ibu (WKI) Kolom" },
  { id: "1.3.53.04", label: "Pemuda Kolom" },
  { id: "1.3.53.05", label: "Remaja Kolom" },
  { id: "1.3.53.06", label: "Anak Sekolah Minggu (ASM) Kolom" },
  { id: "1.3.55.01", label: "Diakonia Dana Duka Kolom" },
  { id: "1.3.57.01", label: "Pembangunan dari Kolom" },
];

/** Nama kolom hasil ekstraksi keterangan hanya berlaku untuk grup ini */
const GRUP_NAMA_KOLOM = "Persembahan Ibd Kompelka BIPRA";

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

  // Filter khusus Monitoring Setoran
  const [monitoringBulan, setMonitoringBulan] = useState(() => String(new Date().getMonth()));
  const [monitoringKat, setMonitoringKat] = useState("semua");
  const [monitoringStatusFilter, setMonitoringStatusFilter] = useState<"semua" | "belum" | "sudah">("semua");

  /** Semua penerimaan (kecuali mutasi kas internal) dengan kolom & bulan hasil parsing keterangan */
  const parsed = useMemo(
    () =>
      (trx.data ?? [])
        .filter((t) => t.kind === "penerimaan" && !isInternalCash(t))
        .map((t) => ({
          ...t,
          kolom: parseKolom(t.description),
          bulan: parseBulan(t.description),
          nama: parseNamaKolom(t.description),
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

  async function downloadPdf() {
    setIsGeneratingPdf(true);
    await new Promise((r) => setTimeout(r, 100));
    const element = pdfRef.current;
    if (!element) {
      setIsGeneratingPdf(false);
      return;
    }
    await html2pdf(element, {
      filename: `laporan-penerimaan-kolom-${new Date().toISOString().slice(0, 10)}.pdf`,
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      html2canvas: { scale: 2, useCORS: true },
      margin: [10, 10],
    });
    setIsGeneratingPdf(false);
  }

  const rows = useMemo(
    () =>
      parsed.filter((t) => {
        const b = (budgets.data ?? []).find((x) => x.id === t.budget_line_id);
        if (!GRUP_LAPORAN.includes(b?.grup || "")) return false;
        if (budgetId !== "semua" && t.budget_line_id !== budgetId) return false;
        if (kolomFilter !== "semua") {
          if (kolomFilter === "tanpa") {
            if (t.kolom !== null) return false;
          } else if (kolomFilter.startsWith("nama:")) {
            if ((b?.grup || "") !== GRUP_NAMA_KOLOM) return false;
            if ((t.nama || "").toLowerCase() !== kolomFilter.slice(5).toLowerCase()) return false;
          } else if (String(t.kolom) !== kolomFilter) {
            return false;
          }
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

  /** Daftar nama kolom hasil ekstraksi keterangan (khusus grup BIPRA) */
  const namaList = useMemo(() => {
    const allowed = new Set(
      (budgets.data ?? [])
        .filter((b) => (b.grup || "") === GRUP_NAMA_KOLOM)
        .map((b) => b.id),
    );
    const set = new Set<string>();
    parsed.forEach((t) => {
      if (allowed.has(t.budget_line_id) && t.nama) set.add(t.nama);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
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

  // DATA MONITORING SETORAN KOLOM 1 - 29 PADA BULAN TERPILIH
  const monitoringData = useMemo(() => {
    const targetBulanIdx = Number(monitoringBulan);
    const targetKatCode = monitoringKat;

    return DAFTAR_29_KOLOM.map((k) => {
      // Cari transaksi yang cocok untuk kolom k pada bulan targetBulanIdx
      const matches = parsed.filter((t) => {
        if (t.kolom !== k) return false;
        // Cek bulan dari keterangan atau trx_date
        const trxMonth = t.bulan !== null ? t.bulan : new Date(t.trx_date).getMonth();
        if (trxMonth !== targetBulanIdx) return false;

        // Cek kategori anggaran jika difilter
        if (targetKatCode !== "semua") {
          const b = (budgets.data ?? []).find((x) => x.id === t.budget_line_id);
          if (b?.code !== targetKatCode) return false;
        }
        return true;
      });

      const sudahSetor = matches.length > 0;
      const totalSetoran = matches.reduce((acc, m) => acc + Number(m.amount), 0);
      const transaksiTerakhir = matches[matches.length - 1];

      return {
        kolom: k,
        sudahSetor,
        totalSetoran,
        transaksiCount: matches.length,
        transaksiTerakhir,
        matches,
      };
    });
  }, [parsed, monitoringBulan, monitoringKat, budgets.data]);

  const monitoringFiltered = useMemo(() => {
    if (monitoringStatusFilter === "belum") return monitoringData.filter((d) => !d.sudahSetor);
    if (monitoringStatusFilter === "sudah") return monitoringData.filter((d) => d.sudahSetor);
    return monitoringData;
  }, [monitoringData, monitoringStatusFilter]);

  const totalSudahSetor = monitoringData.filter((d) => d.sudahSetor).length;
  const totalBelumSetor = monitoringData.filter((d) => !d.sudahSetor).length;
  const totalNominalMonitoring = monitoringData.reduce((acc, d) => acc + d.totalSetoran, 0);

  function exportMonitoringExcel() {
    const bulanNama = BULAN_PANJANG[Number(monitoringBulan)];
    const katLabel = KATEGORI_MONITORING.find((k) => k.id === monitoringKat)?.label || "Semua Pos";

    const rowsAoa: Cell[][] = [
      ["MONITORING SETORAN KOLOM GEREJA", null, null, null, null, null, null],
      [`Bulan: ${bulanNama} · Pos: ${katLabel}`, null, null, null, null, null, null],
      [`Diekspor: ${new Date().toLocaleString("id-ID")}`, null, null, null, null, null, null],
      [null, null, null, null, null, null, null],
      [
        "Kolom",
        "Status Setoran",
        "Total Nominal (Rp)",
        "Jumlah Transaksi",
        "Tanggal Setor",
        "No. Bukti",
        "Keterangan Transaksi",
      ],
    ];

    for (const d of monitoringFiltered) {
      rowsAoa.push([
        `Kolom ${d.kolom}`,
        d.sudahSetor ? "SUDAH SETOR" : "BELUM MENYETOR",
        d.totalSetoran,
        d.transaksiCount,
        d.transaksiTerakhir ? tanggal(d.transaksiTerakhir.trx_date) : "-",
        d.transaksiTerakhir?.voucher_no ?? "-",
        d.transaksiTerakhir?.description ?? "-",
      ]);
    }

    rowsAoa.push([null, null, null, null, null, null, null]);
    rowsAoa.push([
      "TOTAL",
      `${totalSudahSetor} Sudah Setor · ${totalBelumSetor} Belum Setor`,
      totalNominalMonitoring,
      null,
      null,
      null,
      null,
    ]);

    exportAoa(rowsAoa, `Monitoring_Setoran_Kolom_${bulanNama}.xlsx`, "Monitoring", [12, 18, 20, 16, 16, 20, 40]);
  }

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
      title="Laporan Penerimaan per Kolom & BIPRA"
      subtitle={`${rows.length} transaksi · total ${rupiah(grandTotal)}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={resetFilter}>
            <RotateCcw className="size-4" /> Reset filter
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-4" /> Ekspor CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadPdf}
            disabled={isGeneratingPdf}
          >
            <FileDown className="size-4" />
            {isGeneratingPdf ? "Membuat PDF…" : "Download PDF"}
          </Button>
        </div>
      }
    >
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
              {namaList.map((n) => (
                <SelectItem key={`nama:${n}`} value={`nama:${n}`}>
                  {n}
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

      <div ref={pdfRef}>
        <div className={cn("mb-4 border-b border-black pb-3", isGeneratingPdf ? "block" : "hidden")}>
          <h2 className="text-lg font-bold">Laporan Penerimaan per Kolom & BIPRA</h2>
          <p className="text-sm">BUMOTIK FINANCIAL</p>
          <p className="text-sm">
            {rows.length} transaksi · total {rupiah(grandTotal)}
            {dari && sampai ? ` · periode ${tanggal(dari)} s.d. ${tanggal(sampai)}` : ""}
          </p>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="no-print mb-4">
          <TabsTrigger value="matriks">Matriks Kolom × Bulan</TabsTrigger>
          <TabsTrigger value="monitoring" className="font-semibold text-primary">
            🔍 Monitoring Setoran (Belum Setor)
          </TabsTrigger>
          <TabsTrigger value="anggaran">Mata Anggaran × Bulan</TabsTrigger>
          <TabsTrigger value="rincian">Rincian Transaksi ({rows.length})</TabsTrigger>
        </TabsList>

        {/* TAB 1: MATRIKS KOLOM X BULAN */}
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
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.map((r) => (
                  <TableRow
                    key={String(r.kolom)}
                    className="cursor-pointer hover:bg-muted/20"
                    onClick={() => {
                      setKolomFilter(r.kolom === null ? "tanpa" : String(r.kolom));
                      setTab("rincian");
                    }}
                  >
                    <TableCell className="sticky left-0 bg-card font-semibold">
                      {labelKolom(r.kolom)}
                    </TableCell>
                    {activeMonths.map((m) => {
                      const v = r.cells.get(m === null ? "tanpa" : String(m)) ?? 0;
                      return (
                        <TableCell
                          key={String(m)}
                          className={cn(
                            "text-right text-sm whitespace-nowrap font-mono",
                            v === 0 && "text-muted-foreground/40",
                          )}
                        >
                          {v === 0 ? "—" : rupiah(v)}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-bold font-mono whitespace-nowrap text-success">
                      {rupiah(r.total)}
                    </TableCell>
                  </TableRow>
                ))}
                {matrix.length > 0 && (
                  <TableRow className="bg-muted/40">
                    <TableCell className="sticky left-0 bg-muted/40 font-bold">Total</TableCell>
                    {activeMonths.map((m) => (
                      <TableCell
                        key={String(m)}
                        className="text-right font-bold font-mono whitespace-nowrap text-primary"
                      >
                        {rupiah(columnTotals.get(m === null ? "tanpa" : String(m)) ?? 0)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold font-mono whitespace-nowrap text-success text-base">
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

        {/* TAB 2: MONITORING SETORAN & KOLOM YANG BELUM MENYETOR */}
        <TabsContent value="monitoring">
          <div className="space-y-4">
            {/* Filter Bar Monitoring */}
            <div className="panel p-4 bg-muted/20 border">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Bulan Yang Dimonitor</Label>
                  <Select value={monitoringBulan} onValueChange={setMonitoringBulan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {BULAN_PANJANG.map((b, i) => (
                        <SelectItem key={b} value={String(i)}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Pos Setoran / Kompelka</Label>
                  <Select value={monitoringKat} onValueChange={setMonitoringKat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {KATEGORI_MONITORING.map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Status Kolom</Label>
                  <Select
                    value={monitoringStatusFilter}
                    onValueChange={(v: any) => setMonitoringStatusFilter(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semua">Semua Status (29 Kolom)</SelectItem>
                      <SelectItem value="belum">🔴 Hanya Yang Belum Setor ({totalBelumSetor})</SelectItem>
                      <SelectItem value="sudah">🟢 Hanya Yang Sudah Setor ({totalSudahSetor})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button variant="outline" onClick={exportMonitoringExcel} className="w-full gap-1.5">
                    <Download className="size-4" /> Ekspor Status Excel
                  </Button>
                </div>
              </div>

              {/* Stat Card Ringkasan Monitoring */}
              <div className="mt-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
                <div className="panel p-3 bg-background border">
                  <span className="text-xs text-muted-foreground block">Total Kolom Terdaftar</span>
                  <span className="text-xl font-bold font-mono">29 Kolom</span>
                </div>
                <div className="panel p-3 bg-success/10 border border-success/20">
                  <span className="text-xs text-success font-semibold flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" /> Sudah Menyetor
                  </span>
                  <span className="text-xl font-bold font-mono text-success">
                    {totalSudahSetor} Kolom ({((totalSudahSetor / 29) * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="panel p-3 bg-destructive/10 border border-destructive/20">
                  <span className="text-xs text-destructive font-semibold flex items-center gap-1">
                    <AlertCircle className="size-3.5" /> Belum Menyetor
                  </span>
                  <span className="text-xl font-bold font-mono text-destructive">
                    {totalBelumSetor} Kolom
                  </span>
                </div>
                <div className="panel p-3 bg-primary/10 border border-primary/20">
                  <span className="text-xs text-primary font-semibold block">Total Setoran Terkumpul</span>
                  <span className="text-xl font-bold font-mono text-primary">
                    {rupiah(totalNominalMonitoring)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabel Daftar Status Kolom */}
            <div className="panel overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-28 font-bold">Kolom</TableHead>
                    <TableHead className="w-44 font-bold">Status Setoran</TableHead>
                    <TableHead className="w-40 text-right font-bold">Total Setoran</TableHead>
                    <TableHead className="w-32 font-bold">Tgl Transaksi</TableHead>
                    <TableHead className="w-36 font-bold">No. Bukti</TableHead>
                    <TableHead className="font-bold">Keterangan Transaksi</TableHead>
                    <TableHead className="w-24 text-right font-bold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monitoringFiltered.map((d) => (
                    <TableRow
                      key={d.kolom}
                      className={cn("hover:bg-muted/20", !d.sudahSetor && "bg-destructive/5")}
                    >
                      <TableCell className="font-bold">Kolom {d.kolom}</TableCell>
                      <TableCell>
                        {d.sudahSetor ? (
                          <Badge variant="default" className="bg-success text-white hover:bg-success/90 gap-1 text-[11px]">
                            <CheckCircle2 className="size-3" /> Sudah Setor ({d.transaksiCount}x)
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1 text-[11px]">
                            <AlertCircle className="size-3" /> BELUM SETOR
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-sm">
                        {d.sudahSetor ? (
                          <span className="text-success">{rupiah(d.totalSetoran)}</span>
                        ) : (
                          <span className="text-muted-foreground font-normal">Rp 0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {d.transaksiTerakhir ? tanggal(d.transaksiTerakhir.trx_date) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-primary font-semibold">
                        {d.transaksiTerakhir?.voucher_no ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-72 truncate text-xs text-muted-foreground">
                        {d.transaksiTerakhir?.description ?? "Belum ada transaksi setoran pada bulan ini."}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.sudahSetor ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setKolomFilter(String(d.kolom));
                              setBulanFilter(monitoringBulan);
                              setTab("rincian");
                            }}
                          >
                            Rincian
                          </Button>
                        ) : (
                          <span className="text-[11px] text-destructive font-medium italic">Tunggakan</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: MATA ANGGARAN X BULAN */}
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
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perAnggaran.map((r) => (
                  <TableRow
                    key={r.label}
                    className="cursor-pointer hover:bg-muted/20"
                    onClick={() => {
                      if (r.id) setBudgetId(r.id);
                      setTab("rincian");
                    }}
                  >
                    <TableCell className="sticky left-0 bg-card min-w-72 text-sm font-medium">
                      {r.label}
                    </TableCell>
                    {activeMonths.map((m) => {
                      const v = r.cells.get(m === null ? "tanpa" : String(m)) ?? 0;
                      return (
                        <TableCell
                          key={String(m)}
                          className={cn(
                            "text-right text-sm whitespace-nowrap font-mono",
                            v === 0 && "text-muted-foreground/40",
                          )}
                        >
                          {v === 0 ? "—" : rupiah(v)}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-bold font-mono whitespace-nowrap text-success">
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
                    <TableCell className="sticky left-0 bg-muted/40 font-bold">Total</TableCell>
                    {activeMonths.map((m) => (
                      <TableCell
                        key={String(m)}
                        className="text-right font-bold font-mono whitespace-nowrap text-primary"
                      >
                        {rupiah(columnTotals.get(m === null ? "tanpa" : String(m)) ?? 0)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold font-mono whitespace-nowrap text-success text-base">
                      {rupiah(grandTotal)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB 4: RINCIAN TRANSAKSI */}
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
                <TableRow className="bg-muted/30">
                  <TableHead className="font-bold">Tanggal</TableHead>
                  <TableHead className="font-bold">No. Bukti</TableHead>
                  <TableHead className="font-bold">Kolom</TableHead>
                  <TableHead className="font-bold">Bulan</TableHead>
                  <TableHead className="font-bold">Mata Anggaran</TableHead>
                  <TableHead className="font-bold">Keterangan</TableHead>
                  <TableHead className="text-right font-bold">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 500).map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/10">
                    <TableCell className="whitespace-nowrap font-medium">{tanggal(t.trx_date)}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-primary">{t.voucher_no}</TableCell>
                    <TableCell>
                      <Badge variant={t.kolom === null ? "outline" : "secondary"} className="font-mono text-xs">
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
                    <TableCell className="text-right font-mono font-medium text-success whitespace-nowrap">
                      {rupiah(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length > 0 && (
                  <TableRow className="bg-muted/40 font-bold">
                    <TableCell colSpan={6} className="text-right font-bold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold whitespace-nowrap text-success text-base">
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
      </div>
    </AppShell>
  );
}