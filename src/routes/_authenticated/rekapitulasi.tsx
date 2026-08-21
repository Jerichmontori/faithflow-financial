import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, Fragment } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Printer, FileDown, TrendingUp, TrendingDown, Calendar, Layers, Zap, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BudgetLineDialog } from "@/components/BudgetLineDialog";
import { HapusBudgetLineDialog } from "@/components/HapusBudgetLineDialog";
import { budgetLinesQuery, transactionsQuery, isInternalCash, type BudgetLine } from "@/lib/queries";
import { rupiah } from "@/lib/format";
import { exportAoa, type Cell as ExcelCell } from "@/lib/xlsx";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/rekapitulasi")({
  head: () => ({
    meta: [
      { title: "RAB Pendapatan & Belanja — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Rekapitulasi anggaran format 5 kolom RAB Pendapatan dan RAB Belanja resmi BUMOTIK: filter realisasi di atas 100%, penetapan anggaran, realisasi nominal, dan selisih.",
      },
      { property: "og:title", content: "RAB Pendapatan & Belanja — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Laporan RAB Pendapatan dan RAB Belanja format 5 kolom resmi BUMOTIK siap ekspor dan cetak.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RekapitulasiPage,
});

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

interface GroupRekap {
  grup: string;
  parentCode: string;
  pagu: number;
  realisasi: number;
  selisih: number;
  persen: number;
  items: {
    id: string;
    code: string;
    name: string;
    pagu: number;
    realisasi: number;
    selisih: number;
    persen: number;
    rawBudget: BudgetLine;
  }[];
}

function RekapitulasiPage() {
  const budgets = useQuery(budgetLinesQuery);
  const trx = useQuery(transactionsQuery);
  const [tab, setTab] = useState<"pendapatan" | "belanja" | "bulanan" | "grafik">("pendapatan");
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [search, setSearch] = useState("");
  const [filterOver100, setFilterOver100] = useState(false);

  const currentYear = Number(selectedYear) || new Date().getFullYear();

  // Filter transaksi aktif
  const activeTrx = useMemo(() => {
    return (trx.data ?? []).filter(
      (t) =>
        t.status !== "rejected" &&
        t.status !== "draft" &&
        !isInternalCash(t) &&
        (!start || t.trx_date >= start) &&
        (!end || t.trx_date <= end),
    );
  }, [trx.data, start, end]);

  // Realisasi per mata anggaran
  const realisasiMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of activeTrx) {
      map.set(t.budget_line_id, (map.get(t.budget_line_id) ?? 0) + Number(t.amount));
    }
    return map;
  }, [activeTrx]);

  // Sembunyikan kode kas internal (1.1.11.11 & 2.2.22.22) dari laporan RAB Pendapatan & Belanja
  const HIDDEN_RAB_CODES = ["1.1.11.11", "2.2.22.22"];

  // Bangun data RAB Pendapatan
  const dataPendapatan = useMemo(() => {
    const list = (budgets.data ?? []).filter(
      (b) => b.kind === "penerimaan" && !HIDDEN_RAB_CODES.includes(b.code.trim()),
    );
    const groupMap = new Map<string, GroupRekap>();

    for (const b of list) {
      const gName = b.grup || "Pendapatan Lainnya";
      if (!groupMap.has(gName)) {
        const parts = b.code.split(".");
        const parentCode = parts.length >= 2 ? `${parts[0]}.${parts[1]}.00` : "";
        groupMap.set(gName, {
          grup: gName,
          parentCode,
          pagu: 0,
          realisasi: 0,
          selisih: 0,
          persen: 0,
          items: [],
        });
      }

      const g = groupMap.get(gName)!;
      const pagu = Number(b.planned_amount) || 0;
      const real = realisasiMap.get(b.id) || 0;
      const selisih = pagu - real;
      const persen = pagu > 0 ? (real / pagu) * 100 : 0;

      g.pagu += pagu;
      g.realisasi += real;
      g.selisih += selisih;
      g.items.push({
        id: b.id,
        code: b.code,
        name: b.name,
        pagu,
        realisasi: real,
        selisih,
        persen,
        rawBudget: b,
      });
    }

    const res: GroupRekap[] = [];
    for (const g of groupMap.values()) {
      g.persen = g.pagu > 0 ? (g.realisasi / g.pagu) * 100 : 0;
      g.items.sort((a, b) => a.code.localeCompare(b.code));
      res.push(g);
    }
    return res;
  }, [budgets.data, realisasiMap]);

  // Bangun data RAB Belanja
  const dataBelanja = useMemo(() => {
    const list = (budgets.data ?? []).filter(
      (b) => b.kind === "pengeluaran" && !HIDDEN_RAB_CODES.includes(b.code.trim()),
    );
    const groupMap = new Map<string, GroupRekap>();

    for (const b of list) {
      const gName = b.grup || "Belanja Lainnya";
      if (!groupMap.has(gName)) {
        const parts = b.code.split(".");
        const parentCode = parts.length >= 2 ? `${parts[0]}.${parts[1]}.00` : "";
        groupMap.set(gName, {
          grup: gName,
          parentCode,
          pagu: 0,
          realisasi: 0,
          selisih: 0,
          persen: 0,
          items: [],
        });
      }

      const g = groupMap.get(gName)!;
      const pagu = Number(b.planned_amount) || 0;
      const real = realisasiMap.get(b.id) || 0;
      const selisih = pagu - real;
      const persen = pagu > 0 ? (real / pagu) * 100 : 0;

      g.pagu += pagu;
      g.realisasi += real;
      g.selisih += selisih;
      g.items.push({
        id: b.id,
        code: b.code,
        name: b.name,
        pagu,
        realisasi: real,
        selisih,
        persen,
        rawBudget: b,
      });
    }

    const res: GroupRekap[] = [];
    for (const g of groupMap.values()) {
      g.persen = g.pagu > 0 ? (g.realisasi / g.pagu) * 100 : 0;
      g.items.sort((a, b) => a.code.localeCompare(b.code));
      res.push(g);
    }
    return res;
  }, [budgets.data, realisasiMap]);

  // Hitung jumlah pos di atas 100%
  const countOver100Pendapatan = useMemo(() => {
    return dataPendapatan.flatMap((g) => g.items).filter((i) => i.persen > 100).length;
  }, [dataPendapatan]);

  const countOver100Belanja = useMemo(() => {
    return dataBelanja.flatMap((g) => g.items).filter((i) => i.persen > 100).length;
  }, [dataBelanja]);

  // Totals RAB
  const totalPaguPendapatan = dataPendapatan.reduce((a, b) => a + b.pagu, 0);
  const totalRealPendapatan = dataPendapatan.reduce((a, b) => a + b.realisasi, 0);
  const persenTotalPendapatan = totalPaguPendapatan > 0 ? (totalRealPendapatan / totalPaguPendapatan) * 100 : 0;

  const totalPaguBelanja = dataBelanja.reduce((a, b) => a + b.pagu, 0);
  const totalRealBelanja = dataBelanja.reduce((a, b) => a + b.realisasi, 0);
  const totalSelisihBelanja = totalPaguBelanja - totalRealBelanja;
  const persenTotalBelanja = totalPaguBelanja > 0 ? (totalRealBelanja / totalPaguBelanja) * 100 : 0;

  // Bangun data REKAP PERBULAN (12 Bulan)
  const dataBulanan = useMemo(() => {
    const listTrx = (trx.data ?? []).filter(
      (t) => t.status !== "rejected" && t.status !== "draft" && !isInternalCash(t),
    );

    return Array.from({ length: 12 }, (_, idx) => {
      const monthNum = idx + 1;
      const monthPad = String(monthNum).padStart(2, "0");
      const lastDay = new Date(currentYear, monthNum, 0).getDate();
      const tglAwal = `${currentYear}-${monthPad}-01`;
      const tglAkhir = `${currentYear}-${monthPad}-${String(lastDay).padStart(2, "0")}`;

      const trxInMonth = listTrx.filter(
        (t) => t.trx_date >= tglAwal && t.trx_date <= tglAkhir,
      );

      const pendapatan = trxInMonth
        .filter((t) => t.kind === "penerimaan")
        .reduce((a, t) => a + Number(t.amount), 0);

      const pengeluaran = trxInMonth
        .filter((t) => t.kind === "pengeluaran")
        .reduce((a, t) => a + Number(t.amount), 0);

      const saldo = pendapatan - pengeluaran;

      return {
        no: monthNum,
        bulan: BULAN[idx] || `Bulan ${monthNum}`,
        tglAwal,
        tglAkhir,
        pendapatan,
        pengeluaran,
        saldo,
      };
    });
  }, [trx.data, currentYear]);

  const totalPendapatanBulanan = dataBulanan.reduce((a, b) => a + b.pendapatan, 0);
  const totalPengeluaranBulanan = dataBulanan.reduce((a, b) => a + b.pengeluaran, 0);
  const totalSaldoBulanan = totalPendapatanBulanan - totalPengeluaranBulanan;

  // Filter pencarian & filter realisasi > 100%
  const filterGroups = (groups: GroupRekap[]) => {
    const q = search.trim().toLowerCase();
    return groups
      .map((g) => {
        let filteredItems = g.items;
        if (filterOver100) {
          filteredItems = filteredItems.filter((i) => i.persen > 100);
        }
        if (q) {
          const matchGrup = g.grup.toLowerCase().includes(q);
          if (!matchGrup) {
            filteredItems = filteredItems.filter(
              (i) => i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q),
            );
          }
        }
        if (filteredItems.length > 0) {
          return { ...g, items: filteredItems };
        }
        return null;
      })
      .filter(Boolean) as GroupRekap[];
  };

  // Export Excel RAB PENDAPATAN
  function exportPendapatanExcel() {
    const rows: ExcelCell[][] = [
      ["ANGGARAN PENDAPATAN DAN BELANJA "],
      ["JEMAAT GMIM BUKIT MORIA TIKALA BARU"],
      [`TAHUN ${currentYear}`],
      [],
      ["I. PENDAPATAN"],
      ["Mata Anggaran", "Mata Anggaran / URAIAN", "Penetapan Anggaran", "Realisasi", "Persentase"],
    ];

    for (const g of filterGroups(dataPendapatan)) {
      rows.push([g.parentCode || "", g.grup, g.pagu, g.realisasi, `${g.persen.toFixed(1)}%`]);
      for (const item of g.items) {
        rows.push([
          item.code,
          item.name,
          item.pagu,
          item.realisasi,
          item.pagu > 0 ? `${item.persen.toFixed(1)}%` : "",
        ]);
      }
      rows.push([
        "",
        `Jumlah ${g.grup}`,
        g.pagu,
        g.realisasi,
        `${g.persen.toFixed(1)}%`,
      ]);
      rows.push([]);
    }

    rows.push(["TOTAL", "", totalPaguPendapatan, totalRealPendapatan, `${persenTotalPendapatan.toFixed(1)}%`]);

    exportAoa(
      rows,
      `RAB-PENDAPATAN-${currentYear}.xlsx`,
      "RAB PENDAPATAN",
      [18, 55, 24, 24, 18],
    );
  }

  // Export Excel RAB BELANJA
  function exportBelanjaExcel() {
    const rows: ExcelCell[][] = [
      ["ANGGARAN PENDAPATAN DAN BELANJA "],
      ["JEMAAT GMIM BUKIT MORIA TIKALA BARU"],
      [`TAHUN ${currentYear}`],
      [],
      ["I. BELANJA"],
      ["Mata Anggaran", "Mata Anggaran / URAIAN", "Penetapan Anggaran", "Realisasi", "Selisih"],
    ];

    for (const g of filterGroups(dataBelanja)) {
      rows.push([g.parentCode || "", g.grup, g.pagu, g.realisasi, g.selisih]);
      for (const item of g.items) {
        rows.push([
          item.code,
          item.name,
          item.pagu,
          item.realisasi,
          item.selisih,
        ]);
      }
      rows.push([
        "",
        `Jumlah ${g.grup}`,
        g.pagu,
        g.realisasi,
        g.selisih,
      ]);
      rows.push([]);
    }

    rows.push(["TOTAL", "", totalPaguBelanja, totalRealBelanja, totalSelisihBelanja]);

    exportAoa(
      rows,
      `RAB-BELANJA-${currentYear}.xlsx`,
      "RAB BELANJA",
      [18, 55, 24, 24, 20],
    );
  }

  // Export Excel REKAP PERBULAN
  function exportBulananExcel() {
    const rows: ExcelCell[][] = [
      ["REKAPITULASI KEUANGAN KAS PER BULAN"],
      ["JEMAAT GMIM BUKIT MORIA TIKALA BARU"],
      [`TAHUN ${currentYear}`],
      [],
      ["No ", "Tanggal Awal", "Tanggal Akhir", "Pendapatan", "Pengeluaran", "Saldo"],
      ...dataBulanan.map((b) => [
        b.no,
        b.tglAwal,
        b.tglAkhir,
        b.pendapatan,
        b.pengeluaran,
        b.saldo,
      ]),
      ["GRAND TOTAL", "", "", totalPendapatanBulanan, totalPengeluaranBulanan, totalSaldoBulanan],
    ];

    exportAoa(
      rows,
      `REKAP-PERBULAN-${currentYear}.xlsx`,
      "Rekap Perbulan",
      [8, 16, 16, 20, 20, 20],
    );
  }

  // Chart data for visual tab
  const monthlyChartData = useMemo(() => {
    return dataBulanan.map((b) => ({
      name: (b.bulan || "").slice(0, 3),
      Pendapatan: b.pendapatan,
      Pengeluaran: b.pengeluaran,
      Saldo: b.saldo,
    }));
  }, [dataBulanan]);

  return (
    <AppShell
      title="Rekapitulasi RAB & Bulanan"
      subtitle={`Tahun ${currentYear} · Pendapatan: ${rupiah(totalRealPendapatan)} (${persenTotalPendapatan.toFixed(1)}%) · Belanja: ${rupiah(totalRealBelanja)} (${persenTotalBelanja.toFixed(1)}%)`}
      actions={
        <div className="no-print flex flex-wrap gap-2">
          {tab === "pendapatan" && (
            <Button variant="outline" onClick={exportPendapatanExcel}>
              <FileDown className="mr-2 size-4" /> Export Excel (RAB PENDAPATAN)
            </Button>
          )}
          {tab === "belanja" && (
            <Button variant="outline" onClick={exportBelanjaExcel}>
              <FileDown className="mr-2 size-4" /> Export Excel (RAB BELANJA)
            </Button>
          )}
          {tab === "bulanan" && (
            <Button variant="outline" onClick={exportBulananExcel}>
              <FileDown className="mr-2 size-4" /> Export Excel (REKAP PERBULAN)
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 size-4" /> Cetak
          </Button>
        </div>
      }
    >
      <div className="panel no-print mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="year-select">Tahun Anggaran</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="year-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">Tahun 2025</SelectItem>
                <SelectItem value="2026">Tahun 2026</SelectItem>
                <SelectItem value="2027">Tahun 2027</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start">Dari Tanggal (Realisasi)</Label>
            <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">Sampai Tanggal (Realisasi)</Label>
            <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="search">Cari Uraian / Kode</Label>
            <Input
              id="search"
              placeholder="Cari kode atau nama pos…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Baris Tombol Filter Khusus: Realisasi > 100% */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={filterOver100 ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterOver100(!filterOver100)}
              className={filterOver100 ? "gap-1.5 bg-amber-600 hover:bg-amber-700 text-white" : "gap-1.5"}
            >
              <Zap className="size-3.5" />
              {filterOver100 ? "Filter Aktif: Realisasi > 100%" : "Filter Realisasi > 100%"}
              <Badge
                variant={filterOver100 ? "secondary" : "default"}
                className="ml-1 px-1.5 py-0 text-[10px]"
              >
                {tab === "pendapatan" ? countOver100Pendapatan : countOver100Belanja} Pos
              </Badge>
            </Button>

            {filterOver100 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterOver100(false)}
                className="h-8 gap-1 text-xs text-muted-foreground"
              >
                <X className="size-3.5" /> Tampilkan Semua Pos
              </Button>
            )}
          </div>

          {filterOver100 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Menampilkan hanya pos anggaran dengan realisasi melebihi 100% dari pagu yang ditetapkan.
            </p>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="no-print grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="pendapatan" className="gap-2">
            <TrendingUp className="size-4 text-success" /> RAB PENDAPATAN
          </TabsTrigger>
          <TabsTrigger value="belanja" className="gap-2">
            <TrendingDown className="size-4 text-destructive" /> RAB BELANJA
          </TabsTrigger>
          <TabsTrigger value="bulanan" className="gap-2">
            <Calendar className="size-4 text-primary" /> REKAP BULANAN
          </TabsTrigger>
          <TabsTrigger value="grafik" className="gap-2">
            <Layers className="size-4" /> Grafik &amp; Tren
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: RAB PENDAPATAN */}
        <TabsContent value="pendapatan" className="space-y-4">
          <div className="panel p-6 overflow-x-auto warta-area">
            <div className="text-center mb-5 leading-tight">
              <h2 className="text-base font-bold uppercase tracking-wider">
                ANGGARAN PENDAPATAN DAN BELANJA
              </h2>
              <p className="text-sm font-bold uppercase">JEMAAT GMIM BUKIT MORIA TIKALA BARU</p>
              <p className="text-xs font-semibold text-muted-foreground font-mono">TAHUN {currentYear}</p>
              <p className="text-sm font-bold uppercase mt-2 text-primary">I. PENDAPATAN</p>
            </div>

            <Table className="warta-table w-full">
              <TableHeader>
                <TableRow className="bg-muted/50 font-bold">
                  <TableHead className="w-36 font-bold">Mata Anggaran</TableHead>
                  <TableHead className="font-bold">Mata Anggaran / URAIAN</TableHead>
                  <TableHead className="w-48 text-right font-bold">Penetapan Anggaran</TableHead>
                  <TableHead className="w-48 text-right font-bold">Realisasi</TableHead>
                  <TableHead className="w-44 text-center font-bold">Persentase &amp; Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filterGroups(dataPendapatan).map((g) => (
                  <Fragment key={g.grup}>
                    <TableRow className="bg-muted/25 font-bold border-t">
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        {g.parentCode || ""}
                      </TableCell>
                      <TableCell className="font-bold uppercase tracking-wide text-foreground">
                        {g.grup}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold">
                        {rupiah(g.pagu)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-success">
                        {rupiah(g.realisasi)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          Capai {g.persen.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {g.items.map((item) => (
                      <TableRow
                        key={item.id}
                        className={item.persen > 100 ? "bg-amber-500/10 hover:bg-amber-500/15" : "hover:bg-muted/10"}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.code}
                        </TableCell>
                        <TableCell className="pl-6 text-sm font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs font-mono">
                          {rupiah(item.pagu)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs font-mono text-success">
                          {item.realisasi > 0 ? rupiah(item.realisasi) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Badge
                              variant={item.persen > 100 ? "default" : item.persen >= 100 ? "secondary" : "outline"}
                              className={item.persen > 100 ? "bg-amber-600 text-white text-[10px]" : "text-[10px]"}
                            >
                              {item.persen.toFixed(0)}%
                            </Badge>
                            <BudgetLineDialog budget={item.rawBudget} />
                            <HapusBudgetLineDialog budget={item.rawBudget} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    <TableRow className="bg-muted/40 font-bold border-b-2">
                      <TableCell></TableCell>
                      <TableCell className="font-semibold text-xs uppercase">
                        Jumlah {g.grup}
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs font-mono">
                        {rupiah(g.pagu)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs font-mono text-success">
                        {rupiah(g.realisasi)}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">
                        {g.pagu > 0 ? `${g.persen.toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))}

                {filterGroups(dataPendapatan).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      {filterOver100
                        ? "Tidak ada pos mata anggaran pendapatan dengan realisasi di atas 100%."
                        : "Tidak ada data anggaran yang sesuai."}
                    </TableCell>
                  </TableRow>
                )}

                <TableRow className="bg-primary/10 font-bold text-sm border-t-2">
                  <TableCell className="font-bold">TOTAL</TableCell>
                  <TableCell className="uppercase font-bold">TOTAL PENDAPATAN</TableCell>
                  <TableCell className="text-right font-bold font-mono">
                    {rupiah(totalPaguPendapatan)}
                  </TableCell>
                  <TableCell className="text-right font-bold font-mono text-success">
                    {rupiah(totalRealPendapatan)}
                  </TableCell>
                  <TableCell className="text-center font-bold">
                    {persenTotalPendapatan.toFixed(1)}%
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB 2: RAB BELANJA */}
        <TabsContent value="belanja" className="space-y-4">
          <div className="panel p-6 overflow-x-auto warta-area">
            <div className="text-center mb-5 leading-tight">
              <h2 className="text-base font-bold uppercase tracking-wider">
                ANGGARAN PENDAPATAN DAN BELANJA
              </h2>
              <p className="text-sm font-bold uppercase">JEMAAT GMIM BUKIT MORIA TIKALA BARU</p>
              <p className="text-xs font-semibold text-muted-foreground font-mono">TAHUN {currentYear}</p>
              <p className="text-sm font-bold uppercase mt-2 text-destructive">I. BELANJA</p>
            </div>

            <Table className="warta-table w-full">
              <TableHeader>
                <TableRow className="bg-muted/50 font-bold">
                  <TableHead className="w-36 font-bold">Mata Anggaran</TableHead>
                  <TableHead className="font-bold">Mata Anggaran / URAIAN</TableHead>
                  <TableHead className="w-48 text-right font-bold">Penetapan Anggaran</TableHead>
                  <TableHead className="w-48 text-right font-bold">Realisasi</TableHead>
                  <TableHead className="w-44 text-center font-bold">Selisih &amp; Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filterGroups(dataBelanja).map((g) => (
                  <Fragment key={g.grup}>
                    <TableRow className="bg-muted/25 font-bold border-t">
                      <TableCell className="font-mono text-xs font-bold text-destructive">
                        {g.parentCode || ""}
                      </TableCell>
                      <TableCell className="font-bold uppercase tracking-wide text-foreground">
                        {g.grup}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold">
                        {rupiah(g.pagu)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-destructive">
                        {rupiah(g.realisasi)}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs font-semibold">
                        Sisa: {rupiah(g.selisih)}
                      </TableCell>
                    </TableRow>

                    {g.items.map((item) => (
                      <TableRow
                        key={item.id}
                        className={item.persen > 100 ? "bg-amber-500/10 hover:bg-amber-500/15" : "hover:bg-muted/10"}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.code}
                        </TableCell>
                        <TableCell className="pl-6 text-sm font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs font-mono">
                          {rupiah(item.pagu)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs font-mono text-destructive">
                          {item.realisasi > 0 ? rupiah(item.realisasi) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={item.selisih < 0 ? "text-destructive font-bold text-xs font-mono" : "text-xs font-mono"}>
                              {rupiah(item.selisih)}
                            </span>
                            <BudgetLineDialog budget={item.rawBudget} />
                            <HapusBudgetLineDialog budget={item.rawBudget} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    <TableRow className="bg-muted/40 font-bold border-b-2">
                      <TableCell></TableCell>
                      <TableCell className="font-semibold text-xs uppercase">
                        Jumlah {g.grup}
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs font-mono">
                        {rupiah(g.pagu)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs font-mono text-destructive">
                        {rupiah(g.realisasi)}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs font-mono">
                        {rupiah(g.selisih)}
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))}

                {filterGroups(dataBelanja).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      {filterOver100
                        ? "Tidak ada pos mata anggaran belanja dengan realisasi di atas 100%."
                        : "Tidak ada data anggaran yang sesuai."}
                    </TableCell>
                  </TableRow>
                )}

                <TableRow className="bg-primary/10 font-bold text-sm border-t-2">
                  <TableCell className="font-bold">TOTAL</TableCell>
                  <TableCell className="uppercase font-bold">TOTAL BELANJA</TableCell>
                  <TableCell className="text-right font-bold font-mono">
                    {rupiah(totalPaguBelanja)}
                  </TableCell>
                  <TableCell className="text-right font-bold font-mono text-destructive">
                    {rupiah(totalRealBelanja)}
                  </TableCell>
                  <TableCell className="text-center font-bold font-mono text-primary">
                    {rupiah(totalSelisihBelanja)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB 3: REKAP BULANAN */}
        <TabsContent value="bulanan" className="space-y-4">
          <div className="panel p-6 overflow-x-auto warta-area">
            <div className="text-center mb-5 leading-tight">
              <h2 className="text-base font-bold uppercase tracking-wider">
                REKAPITULASI KEUANGAN KAS PER BULAN
              </h2>
              <p className="text-sm font-bold uppercase">JEMAAT GMIM BUKIT MORIA TIKALA BARU</p>
              <p className="text-xs font-semibold text-muted-foreground font-mono">TAHUN {currentYear}</p>
            </div>

            <Table className="warta-table w-full">
              <TableHeader>
                <TableRow className="bg-muted/50 font-bold">
                  <TableHead className="w-16 text-center font-bold">No </TableHead>
                  <TableHead className="w-36 font-bold">Tanggal Awal</TableHead>
                  <TableHead className="w-36 font-bold">Tanggal Akhir</TableHead>
                  <TableHead className="w-48 text-right font-bold">Pendapatan</TableHead>
                  <TableHead className="w-48 text-right font-bold">Pengeluaran</TableHead>
                  <TableHead className="w-48 text-right font-bold">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataBulanan.map((b) => (
                  <TableRow key={b.no} className="hover:bg-muted/10">
                    <TableCell className="text-center font-mono text-xs font-semibold">{b.no}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{b.tglAwal}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{b.tglAkhir}</TableCell>
                    <TableCell className="text-right font-medium text-xs font-mono text-success">
                      {b.pendapatan > 0 ? rupiah(b.pendapatan) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-xs font-mono text-destructive">
                      {b.pengeluaran > 0 ? rupiah(b.pengeluaran) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-xs font-mono">
                      <span className={b.saldo > 0 ? "text-success" : b.saldo < 0 ? "text-destructive" : ""}>
                        {rupiah(b.saldo)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}

                <TableRow className="bg-primary/10 font-bold text-sm border-t-2">
                  <TableCell colSpan={3} className="text-center font-bold">
                    GRAND TOTAL
                  </TableCell>
                  <TableCell className="text-right font-bold font-mono text-success">
                    {rupiah(totalPendapatanBulanan)}
                  </TableCell>
                  <TableCell className="text-right font-bold font-mono text-destructive">
                    {rupiah(totalPengeluaranBulanan)}
                  </TableCell>
                  <TableCell className="text-right font-bold font-mono text-primary">
                    {rupiah(totalSaldoBulanan)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB 4: RINGKASAN GRAFIK */}
        <TabsContent value="grafik" className="space-y-4">
          <div className="panel p-5">
            <h3 className="text-sm font-semibold mb-4">Tren Arus Kas Pendapatan vs Pengeluaran Per Bulan ({currentYear})</h3>
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)} Jt`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => rupiah(Number(v))} />
                  <Legend />
                  <Bar dataKey="Pendapatan" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pengeluaran" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}