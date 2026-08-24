import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Download,
  FileDown,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Filter,
  Search,
  Users,
  Wallet,
  TrendingUp,
  Church,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpDown,
} from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
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
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/laporan")({
  head: () => ({
    meta: [
      { title: "Laporan Kolom & BIPRA — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Matriks penerimaan kas per kolom jemaat dan BIPRA berdasarkan bulan, filter pos anggaran, siap cetak dan ekspor CSV.",
      },
      { property: "og:title", content: "Laporan Kolom & BIPRA — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Laporan penerimaan kas kolom 1 sampai 29 dan BIPRA per bulan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
];

const QUICK_KATEGORI = [
  { id: "semua", label: "Semua Kategori", icon: "🌐" },
  { id: "1.3.53.01", label: "Ibadah Kolom", icon: "⛪" },
  { id: "1.3.53.02", label: "PKB", icon: "👨" },
  { id: "1.3.53.03", label: "WKI", icon: "👩" },
  { id: "1.3.53.04", label: "Pemuda", icon: "🏃" },
  { id: "1.3.53.05", label: "Remaja", icon: "🧒" },
  { id: "1.3.53.06", label: "ASM", icon: "👶" },
  { id: "1.3.53.11", label: "Pemuda & Remaja Gabungan", icon: "👥" },
  { id: "1.3.55.01", label: "Dana Duka", icon: "🕊️" },
  { id: "1.3.66.14", label: "Sampul PBTK", icon: "✉️" },
  { id: "1.3.66.12", label: "Sampul Syukur", icon: "🙏" },
  { id: "1.3.66.01", label: "Sampul HUT Pribadi", icon: "🎂" },
  { id: "1.3.66.02", label: "Sampul HUT Perkawinan", icon: "💍" },
  { id: "1.3.66.16", label: "Persembahan Perpuluhan", icon: "🪙" },
  { id: "2.3.50.08", label: "Persembahan TK Bumotik", icon: "🏫" },
  { id: "2.3.50.07", label: "Persembahan SD GMIM V", icon: "🎓" },
];

const KATEGORI_MONITORING = [
  { id: "semua", label: "Semua Pos Setoran Kolom" },
  { id: "1.3.53.01", label: "Ibadah Perkunjungan Rutin Kolom" },
  { id: "1.3.53.02", label: "Pria/Kaum Bapa (PKB) Kolom" },
  { id: "1.3.53.03", label: "Wanita/Kaum Ibu (WKI) Kolom" },
  { id: "1.3.53.04", label: "Pemuda Kolom" },
  { id: "1.3.53.05", label: "Remaja Kolom" },
  { id: "1.3.53.06", label: "Anak Sekolah Minggu (ASM) Kolom" },
  { id: "1.3.53.11", label: "Pemuda & Remaja Gabungan" },
  { id: "1.3.55.01", label: "Diakonia Dana Duka Kolom" },
  { id: "1.3.66.14", label: "Sampul PBTK" },
  { id: "1.3.66.12", label: "Sampul Syukur" },
  { id: "1.3.66.01", label: "Sampul HUT Pribadi" },
  { id: "1.3.66.02", label: "Sampul HUT Perkawinan" },
  { id: "1.3.66.16", label: "Persembahan Perpuluhan" },
  { id: "2.3.50.08", label: "Persembahan TK Bumotik" },
  { id: "2.3.50.07", label: "Persembahan SD GMIM V" },
];

const cocokKategori = (
  code: string | undefined,
  name: string | undefined,
  desc: string | undefined,
  targetId: string,
): boolean => {
  if (targetId === "semua") return true;
  const c = code || "";
  const n = (name || "").toLowerCase();
  const d = (desc || "").toLowerCase();

  if (targetId === "1.3.53.02") {
    // PKB
    return (
      c === "1.3.53.02" ||
      c === "1.3.01.01" ||
      n.includes("pria/kaum bapa") ||
      n.includes("pkb") ||
      d.startsWith("pkb") ||
      d.includes("ibadah pkb")
    );
  }
  if (targetId === "1.3.53.03") {
    // WKI
    return (
      c === "1.3.53.03" ||
      c === "1.3.01.02" ||
      n.includes("wanita/kaum ibu") ||
      n.includes("wki") ||
      d.startsWith("wki") ||
      d.includes("ibadah wki")
    );
  }
  if (targetId === "1.3.53.04") {
    // Pemuda
    return (
      c === "1.3.53.04" ||
      c === "1.3.01.03" ||
      ((n.includes("pemuda") || d.includes("pemuda")) &&
        !n.includes("remaja") &&
        !d.includes("remaja") &&
        !d.includes("p/r"))
    );
  }
  if (targetId === "1.3.53.05") {
    // Remaja
    return (
      c === "1.3.53.05" ||
      c === "1.3.01.04" ||
      ((n.includes("remaja") || d.includes("remaja")) &&
        !n.includes("pemuda") &&
        !d.includes("pemuda") &&
        !d.includes("p/r"))
    );
  }
  if (targetId === "1.3.53.06") {
    // ASM
    return (
      c === "1.3.53.06" ||
      c === "1.3.01.05" ||
      n.includes("sekolah minggu") ||
      n.includes("asm") ||
      d.includes("asm") ||
      d.includes("sekolah minggu")
    );
  }
  if (targetId === "1.3.53.11") {
    // Pemuda & Remaja Gabungan
    return (
      c === "1.3.53.11" ||
      c === "1.3.01.09" ||
      (n.includes("pemuda") && n.includes("remaja")) ||
      d.includes("p/r") ||
      (d.includes("pemuda") && d.includes("remaja"))
    );
  }
  if (targetId === "1.3.53.01") {
    // Ibadah Kolom Rutin
    return (
      c === "1.3.53.01" ||
      n.includes("rutin") ||
      (n.includes("perkunjungan") && !n.includes("pkb") && !n.includes("wki"))
    );
  }
  if (targetId === "1.3.55.01") {
    // Dana Duka
    return (
      c === "1.3.55.01" ||
      c === "3.3.03.01" ||
      n.includes("dana duka") ||
      d.includes("dana duka")
    );
  }
  if (targetId === "1.3.66.14") {
    // Sampul PBTK
    return c === "1.3.66.14" || n.includes("pbtk") || d.includes("pbtk");
  }
  if (targetId === "1.3.66.12") {
    // Sampul Syukur
    return (
      c === "1.3.66.12" ||
      c === "1.3.66.13" ||
      c === "1.3.66.15" ||
      c === "1.3.53.09" ||
      n.includes("syukur") ||
      d.includes("syukur")
    );
  }
  if (targetId === "1.3.66.01") {
    // HUT Pribadi
    return (
      c === "1.3.66.01" ||
      c === "1.3.53.07" ||
      n.includes("kelahiran") ||
      n.includes("hut pribadi") ||
      d.includes("kelahiran")
    );
  }
  if (targetId === "1.3.66.02") {
    // HUT Perkawinan
    return (
      c === "1.3.66.02" ||
      c === "1.3.66.03" ||
      c === "1.3.53.08" ||
      n.includes("pernikahan") ||
      n.includes("perkawinan") ||
      d.includes("pernikahan")
    );
  }
  if (targetId === "1.3.66.16") {
    // Persepuluhan
    return (
      c === "1.3.66.16" ||
      n.includes("persepuluhan") ||
      n.includes("perpuluhan") ||
      d.includes("persepuluhan") ||
      d.includes("perpuluhan")
    );
  }
  if (targetId === "2.3.50.08") {
    // TK Bumotik
    return c === "2.3.50.08" || n.includes("tk bumotik") || d.includes("tk bumotik");
  }
  if (targetId === "2.3.50.07") {
    // SD GMIM V
    return c === "2.3.50.07" || n.includes("sd gmim") || d.includes("sd gmim");
  }
  return c === targetId;
};

/** Nama kolom hasil ekstraksi keterangan hanya berlaku untuk grup ini */
const GRUP_NAMA_KOLOM = "Persembahan Ibd Kompelka BIPRA";

function LaporanPage() {
  const trx = useQuery(transactionsQuery);
  const budgets = useQuery(budgetLinesQuery);
  const { isReadOnly } = useSession();

  const [budgetId, setBudgetId] = useState("semua");
  const [kolomFilter, setKolomFilter] = useState("semua");
  const [bulanFilter, setBulanFilter] = useState("semua");
  const [quickKategori, setQuickKategori] = useState("semua");
  const [searchRincian, setSearchRincian] = useState("");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [openBudget, setOpenBudget] = useState(false);
  const [tab, setTab] = useState("matriks");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Filter khusus Monitoring Setoran
  const [monitoringBulan, setMonitoringBulan] = useState("semua");
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
        .filter((b) => b.kind === "penerimaan" && b.grup !== "Mutasi Kas Internal")
        .sort((a, b) => a.code.localeCompare(b.code)),
    [budgets.data],
  );

  function resetFilter() {
    setBudgetId("semua");
    setKolomFilter("semua");
    setBulanFilter("semua");
    setQuickKategori("semua");
    setMonitoringKat("semua");
    setMonitoringBulan("semua");
    setSearchRincian("");
    setDari("");
    setSampai("");
  }

  const handleSelectQuickKategori = (catId: string) => {
    setQuickKategori(catId);
    setMonitoringKat(catId);
    setBudgetId("semua");
    setKolomFilter("semua");
  };

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
        
        // Filter Pos Anggaran / Quick Kategori
        if (budgetId !== "semua" && t.budget_line_id !== budgetId) return false;
        if (quickKategori !== "semua") {
          if (!cocokKategori(b?.code, b?.name, t.description, quickKategori)) return false;
        }

        // Filter Kolom
        if (kolomFilter !== "semua") {
          if (kolomFilter === "tanpa") {
            if (t.kolom !== null || t.nama) return false;
          } else if (kolomFilter.startsWith("nama:")) {
            const reqNama = kolomFilter.slice(5).toLowerCase();
            if ((t.nama || "").toLowerCase() !== reqNama && !(t.description || "").toLowerCase().includes(reqNama)) {
              return false;
            }
          } else if (String(t.kolom) !== kolomFilter) {
            return false;
          }
        }

        // Filter Bulan
        if (bulanFilter !== "semua") {
          const tBulan = t.bulan !== null ? t.bulan : new Date(t.trx_date).getMonth();
          if (bulanFilter === "tanpa" ? t.bulan !== null : String(tBulan) !== bulanFilter)
            return false;
        }

        // Filter Tanggal
        if (dari && t.trx_date < dari) return false;
        if (sampai && t.trx_date > sampai) return false;

        // Filter Search di Rincian
        if (searchRincian.trim()) {
          const q = searchRincian.toLowerCase();
          const matchVoucher = t.voucher_no?.toLowerCase().includes(q);
          const matchDesc = t.description?.toLowerCase().includes(q);
          const matchBudget = t.budget_lines?.name?.toLowerCase().includes(q) || t.budget_lines?.code?.toLowerCase().includes(q);
          const matchKolom = t.kolom ? `kolom ${t.kolom}`.includes(q) : false;
          const matchNama = t.nama ? t.nama.toLowerCase().includes(q) : false;
          if (!matchVoucher && !matchDesc && !matchBudget && !matchKolom && !matchNama) return false;
        }

        return true;
      }),
    [parsed, budgets.data, budgetId, quickKategori, kolomFilter, bulanFilter, dari, sampai, searchRincian],
  );

  const kolomList = useMemo(() => {
    const set = new Set<number>();
    parsed.forEach((t) => {
      if (t.kolom !== null) set.add(t.kolom);
    });
    return [...set].sort((a, b) => a - b);
  }, [parsed]);

  /** Daftar nama kolom hasil ekstraksi keterangan */
  const namaList = useMemo(() => {
    const set = new Set<string>();
    parsed.forEach((t) => {
      if (t.nama) set.add(t.nama);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [parsed]);

  /** Matriks kolom/rayon × bulan */
  const matrix = useMemo(() => {
    const map = new Map<
      string,
      { label: string; kolom: number | null; cells: Map<string, number>; total: number }
    >();
    for (const t of rows) {
      let key: string;
      let label: string;
      if (t.kolom !== null) {
        key = `kolom:${t.kolom}`;
        label = labelKolom(t.kolom);
      } else if (t.nama) {
        key = `nama:${t.nama}`;
        label = `Rayon / Kolom ${t.nama}`;
      } else {
        key = "tanpa";
        label = "Tanpa Kolom / Umum";
      }

      if (!map.has(key)) map.set(key, { label, kolom: t.kolom, cells: new Map(), total: 0 });
      const entry = map.get(key)!;
      const mk = t.bulan === null ? String(new Date(t.trx_date).getMonth()) : String(t.bulan);
      entry.cells.set(mk, (entry.cells.get(mk) ?? 0) + Number(t.amount));
      entry.total += Number(t.amount);
    }
    return [...map.values()].sort((a, b) => {
      if (a.kolom !== null && b.kolom !== null) return a.kolom - b.kolom;
      if (a.kolom !== null) return -1;
      if (b.kolom !== null) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [rows]);

  const columnTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of rows) {
      const mk = t.bulan === null ? String(new Date(t.trx_date).getMonth()) : String(t.bulan);
      totals.set(mk, (totals.get(mk) ?? 0) + Number(t.amount));
    }
    return totals;
  }, [rows]);

  const grandTotal = rows.reduce((a, t) => a + Number(t.amount), 0);

  /** Statistik Ringkas untuk Tampilan Klien */
  const clientStats = useMemo(() => {
    const totalTrx = rows.length;
    const distinctUnits = new Set(
      rows.map((r) =>
        r.kolom !== null
          ? `Kolom ${r.kolom}`
          : r.nama
            ? `Rayon ${r.nama}`
            : "Umum",
      ),
    ).size;
    const avgPerUnit = distinctUnits > 0 ? grandTotal / distinctUnits : 0;

    let topUnit = "—";
    let topUnitNominal = 0;
    for (const m of matrix) {
      if (m.total > topUnitNominal) {
        topUnitNominal = m.total;
        topUnit = m.label;
      }
    }

    return {
      totalTrx,
      distinctUnits,
      avgPerUnit,
      topUnit,
      topUnitNominal,
    };
  }, [rows, grandTotal, matrix]);

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
    const targetBulanIdx = monitoringBulan === "semua" ? null : Number(monitoringBulan);
    const targetKatCode = monitoringKat;

    return DAFTAR_29_KOLOM.map((k) => {
      const matches = parsed.filter((t) => {
        if (t.kolom !== k) return false;

        if (targetBulanIdx !== null) {
          const trxMonth = t.bulan !== null ? t.bulan : new Date(t.trx_date).getMonth();
          const trxDateMonth = new Date(t.trx_date).getMonth();
          if (trxMonth !== targetBulanIdx && trxDateMonth !== targetBulanIdx) return false;
        }

        if (budgetId !== "semua") {
          if (t.budget_line_id !== budgetId) return false;
        } else if (targetKatCode !== "semua") {
          const b = (budgets.data ?? []).find((x) => x.id === t.budget_line_id);
          if (!cocokKategori(b?.code, b?.name, t.description, targetKatCode)) return false;
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
  }, [parsed, monitoringBulan, monitoringKat, budgetId, budgets.data]);

  const monitoringFiltered = useMemo(() => {
    if (monitoringStatusFilter === "belum") return monitoringData.filter((d) => !d.sudahSetor);
    if (monitoringStatusFilter === "sudah") return monitoringData.filter((d) => d.sudahSetor);
    return monitoringData;
  }, [monitoringData, monitoringStatusFilter]);

  const totalSudahSetor = monitoringData.filter((d) => d.sudahSetor).length;
  const totalBelumSetor = monitoringData.filter((d) => !d.sudahSetor).length;
  const totalNominalMonitoring = monitoringData.reduce((acc, d) => acc + d.totalSetoran, 0);

  function exportMonitoringExcel() {
    const bulanNama = monitoringBulan === "semua" ? "Sepanjang_Tahun" : BULAN_PANJANG[Number(monitoringBulan)];
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
      subtitle={`${rows.length} transaksi penerimaan · total ${rupiah(grandTotal)}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={resetFilter} className="h-8 gap-1 text-xs">
            <RotateCcw className="size-3.5" /> Reset filter
          </Button>
          {!isReadOnly && (
            <>
              <Button variant="outline" size="sm" onClick={exportCsv} className="h-8 gap-1 text-xs">
                <Download className="size-3.5" /> Ekspor CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadPdf}
                disabled={isGeneratingPdf}
                className="h-8 gap-1 text-xs bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
              >
                <FileDown className="size-3.5" />
                {isGeneratingPdf ? "Membuat PDF…" : "Download PDF"}
              </Button>
            </>
          )}
        </div>
      }
    >
      {/* 4 HIGHLIGHT CARDS RINGKASAN */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        <Card className="border-l-4 border-l-primary shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Total Penerimaan
              </span>
              <span className="text-xl font-black text-foreground font-mono">{rupiah(grandTotal)}</span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                {rows.length} transaksi terfilter
              </span>
            </div>
            <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Wallet className="size-4.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Kolom / Rayon Terdaftar
              </span>
              <span className="text-xl font-black text-emerald-700 font-mono">
                {clientStats.distinctUnits} Kolom / Rayon
              </span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                Aktif menyetor pada filter ini
              </span>
            </div>
            <div className="size-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Church className="size-4.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Rata-rata Setoran
              </span>
              <span className="text-xl font-black text-blue-700 font-mono">
                {rupiah(clientStats.avgPerUnit)}
              </span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                Distribusi rata-rata penerimaan
              </span>
            </div>
            <div className="size-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <TrendingUp className="size-4.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Setoran Terbesar
              </span>
              <span className="text-xl font-black text-amber-700 font-mono truncate max-w-[180px] block">
                {clientStats.topUnit}
              </span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                {clientStats.topUnitNominal > 0 ? rupiah(clientStats.topUnitNominal) : "Belum ada"}
              </span>
            </div>
            <div className="size-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <Sparkles className="size-4.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* QUICK FILTER CHIPS BIPRA & KOMPELKA */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="size-3.5 text-primary" /> Pos Ibadah & Kompelka BIPRA:
          </span>
          {quickKategori !== "semua" && (
            <button
              onClick={() => handleSelectQuickKategori("semua")}
              className="text-[11px] text-primary hover:underline font-semibold"
            >
              Lihat Semua Pos
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
          {QUICK_KATEGORI.map((cat) => {
            const isActive = quickKategori === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleSelectQuickKategori(cat.id)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 border",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground border-border",
                )}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* QUICK 29-KOLOM SELECTOR PILLS */}
      <div className="mb-5 space-y-2 bg-card p-3 rounded-lg border shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Users className="size-3.5 text-primary" /> Pilih Cepat Kolom (1 — 29):
          </span>
          <span className="text-[11px] text-muted-foreground">
            {kolomFilter === "semua" ? "Menampilkan Semua 29 Kolom" : `Terpilih: Kolom ${kolomFilter}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <Button
            variant={kolomFilter === "semua" ? "default" : "outline"}
            size="sm"
            onClick={() => setKolomFilter("semua")}
            className="h-7 px-2.5 text-xs font-semibold rounded-md shrink-0"
          >
            Semua Kolom
          </Button>
          {DAFTAR_29_KOLOM.map((k) => {
            const isSelected = kolomFilter === String(k);
            return (
              <Button
                key={k}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setKolomFilter(String(k));
                }}
                className={cn(
                  "h-7 min-w-8 px-2 text-xs font-semibold rounded-md shrink-0",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-primary/10 hover:text-primary",
                )}
              >
                {k}
              </Button>
            );
          })}
        </div>
      </div>

      {/* FILTER PANEL LANJUTAN */}
      <div className="panel no-print mb-5 grid gap-3 p-4 bg-muted/20 border md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1.5 xl:col-span-2">
          <Label className="text-xs font-semibold">Pilih Spesifik Mata Anggaran</Label>
          <Popover open={openBudget} onOpenChange={setOpenBudget}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-xs h-9 bg-background">
                <span className="truncate">
                  {selectedBudget
                    ? `${selectedBudget.code} — ${selectedBudget.name}`
                    : "Semua mata anggaran"}
                </span>
                <ChevronsUpDown className="size-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="start">
              <Command className="max-h-80">
                <CommandInput placeholder="Ketik kode, nama, atau grup anggaran…" />
                <CommandList className="max-h-72 overflow-y-auto">
                  <CommandEmpty>Mata anggaran tidak ditemukan.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="semua all Semua mata anggaran"
                      onSelect={() => {
                        setBudgetId("semua");
                        setQuickKategori("semua");
                        setMonitoringKat("semua");
                        setOpenBudget(false);
                      }}
                      className="cursor-pointer font-medium"
                    >
                      <Check
                        className={cn(
                          "mr-2 size-3.5",
                          budgetId === "semua" ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span>Semua mata anggaran</span>
                    </CommandItem>
                    {budgetOptions.map((b) => (
                      <CommandItem
                        key={b.id}
                        value={`${b.code} ${b.name} ${b.grup || ""}`}
                        onSelect={() => {
                          setBudgetId(b.id);
                          setQuickKategori("semua");
                          setOpenBudget(false);
                        }}
                        className="flex items-start py-2 cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 size-3.5 mt-0.5 shrink-0",
                            budgetId === b.id ? "opacity-100" : "opacity-0",
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

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Bulan (Keterangan)</Label>
          <Select value={bulanFilter} onValueChange={setBulanFilter}>
            <SelectTrigger className="h-9 text-xs bg-background">
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

        <div className="grid grid-cols-2 gap-2 xl:col-span-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Dari Tanggal</Label>
            <Input type="date" value={dari} onChange={(e) => setDari(e.target.value)} className="h-9 text-xs bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Sampai Tanggal</Label>
            <Input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} className="h-9 text-xs bg-background" />
          </div>
        </div>
      </div>

      <div ref={pdfRef}>
        <div className={cn("mb-4 border-b border-black pb-3", isGeneratingPdf ? "block" : "hidden")}>
          <h2 className="text-lg font-bold">Laporan Penerimaan per Kolom & BIPRA</h2>
          <p className="text-sm font-semibold">BUMOTIK FINANCIAL</p>
          <p className="text-sm">
            {rows.length} transaksi · total {rupiah(grandTotal)}
            {dari && sampai ? ` · periode ${tanggal(dari)} s.d. ${tanggal(sampai)}` : ""}
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="no-print mb-4 grid grid-cols-2 sm:grid-cols-4 h-auto p-1 gap-1">
            <TabsTrigger value="matriks" className="text-xs py-2">
              📊 Matriks Kolom × Bulan
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="text-xs py-2 font-semibold text-primary">
              🔍 Monitoring Setoran Kolom
            </TabsTrigger>
            <TabsTrigger value="anggaran" className="text-xs py-2">
              📂 Rekap Pos BIPRA
            </TabsTrigger>
            <TabsTrigger value="rincian" className="text-xs py-2">
              📋 Rincian Transaksi ({rows.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MATRIKS KOLOM X BULAN */}
          <TabsContent value="matriks">
            <div className="panel overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="sticky left-0 bg-card font-bold w-32">Kolom</TableHead>
                    {activeMonths.map((m) => (
                      <TableHead key={String(m)} className="text-right whitespace-nowrap font-bold">
                        {labelBulan(m)}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-black text-primary">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrix.map((r) => (
                    <TableRow
                      key={r.label}
                      className="cursor-pointer hover:bg-muted/20"
                      onClick={() => {
                        if (r.kolom !== null) {
                          setKolomFilter(String(r.kolom));
                        } else if (r.label.startsWith("Rayon / Kolom ")) {
                          setKolomFilter(`nama:${r.label.replace("Rayon / Kolom ", "")}`);
                        } else {
                          setKolomFilter("semua");
                        }
                        setTab("rincian");
                      }}
                    >
                      <TableCell className="sticky left-0 bg-card font-semibold text-xs whitespace-nowrap">
                        <Badge variant="outline" className="font-mono text-xs">
                          {r.label}
                        </Badge>
                      </TableCell>
                      {activeMonths.map((m) => {
                        const v = r.cells.get(m === null ? "tanpa" : String(m)) ?? 0;
                        return (
                          <TableCell
                            key={String(m)}
                            className={cn(
                              "text-right text-xs whitespace-nowrap font-mono",
                              v === 0 ? "text-muted-foreground/30" : "font-medium text-foreground",
                            )}
                          >
                            {v === 0 ? "—" : rupiah(v)}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-bold font-mono whitespace-nowrap text-emerald-700">
                        {rupiah(r.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {matrix.length > 0 && (
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell className="sticky left-0 bg-muted font-bold text-xs uppercase tracking-wider">
                        TOTAL SEMUA
                      </TableCell>
                      {activeMonths.map((m) => (
                        <TableCell
                          key={String(m)}
                          className="text-right font-bold font-mono whitespace-nowrap text-primary"
                        >
                          {rupiah(columnTotals.get(m === null ? "tanpa" : String(m)) ?? 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-black font-mono whitespace-nowrap text-emerald-700 text-sm">
                        {rupiah(grandTotal)}
                      </TableCell>
                    </TableRow>
                  )}
                  {matrix.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={activeMonths.length + 2} className="py-12 text-center text-muted-foreground">
                        {trx.isLoading ? "Memuat data penerimaan…" : "Tidak ada data penerimaan untuk filter ini."}
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
                    <Label className="text-xs font-semibold">Bulan Yang Dimonitor</Label>
                    <Select value={monitoringBulan} onValueChange={setMonitoringBulan}>
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="semua">Semua Bulan (Sepanjang Tahun)</SelectItem>
                        {BULAN_PANJANG.map((b, i) => (
                          <SelectItem key={b} value={String(i)}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Pos Setoran / Kompelka</Label>
                    <Select
                      value={monitoringKat}
                      onValueChange={(val) => {
                        setMonitoringKat(val);
                        setQuickKategori(val);
                        setBudgetId("semua");
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs bg-background">
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
                    <Label className="text-xs font-semibold">Status Setoran</Label>
                    <Select
                      value={monitoringStatusFilter}
                      onValueChange={(v: any) => setMonitoringStatusFilter(v)}
                    >
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semua">Semua Status (29 Kolom)</SelectItem>
                        <SelectItem value="belum">🔴 Hanya Yang Belum Setor ({totalBelumSetor})</SelectItem>
                        <SelectItem value="sudah">🟢 Hanya Yang Sudah Setor ({totalSudahSetor})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-end">
                      <Button variant="outline" onClick={exportMonitoringExcel} className="w-full gap-1.5 h-9 text-xs font-semibold bg-background">
                        <Download className="size-3.5" /> Ekspor Status Excel
                      </Button>
                    </div>
                  )}
                </div>

                {/* Stat Card Ringkasan Monitoring */}
                <div className="mt-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <div className="panel p-3 bg-background border">
                    <span className="text-[11px] text-muted-foreground block font-medium">Total Kolom</span>
                    <span className="text-lg font-bold font-mono">29 Kolom</span>
                  </div>
                  <div className="panel p-3 bg-emerald-50/70 border border-emerald-200">
                    <span className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" /> Sudah Menyetor
                    </span>
                    <span className="text-lg font-bold font-mono text-emerald-700">
                      {totalSudahSetor} Kolom ({((totalSudahSetor / 29) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="panel p-3 bg-rose-50/70 border border-rose-200">
                    <span className="text-[11px] text-rose-800 font-semibold flex items-center gap-1">
                      <AlertCircle className="size-3.5" /> Belum Menyetor
                    </span>
                    <span className="text-lg font-bold font-mono text-rose-700">
                      {totalBelumSetor} Kolom
                    </span>
                  </div>
                  <div className="panel p-3 bg-primary/10 border border-primary/20">
                    <span className="text-[11px] text-primary font-semibold block">Total Setoran Terkumpul</span>
                    <span className="text-lg font-bold font-mono text-primary">
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
                      <TableHead className="w-24 font-bold">Kolom</TableHead>
                      <TableHead className="w-40 font-bold">Status Setoran</TableHead>
                      <TableHead className="w-36 text-right font-bold">Total Setoran</TableHead>
                      <TableHead className="w-32 font-bold">Tgl Transaksi</TableHead>
                      <TableHead className="w-36 font-bold">No. Bukti</TableHead>
                      <TableHead className="font-bold">Keterangan Transaksi</TableHead>
                      <TableHead className="w-20 text-right font-bold">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monitoringFiltered.map((d) => (
                      <TableRow
                        key={d.kolom}
                        className={cn("hover:bg-muted/20", !d.sudahSetor && "bg-rose-50/30")}
                      >
                        <TableCell className="font-bold font-mono">Kolom {d.kolom}</TableCell>
                        <TableCell>
                          {d.sudahSetor ? (
                            <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-700 gap-1 text-[11px]">
                              <CheckCircle2 className="size-3" /> Sudah Setor ({d.transaksiCount}x)
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1 text-[11px]">
                              <AlertCircle className="size-3" /> BELUM SETOR
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs">
                          {d.sudahSetor ? (
                            <span className="text-emerald-700">{rupiah(d.totalSetoran)}</span>
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
                              className="h-7 text-xs font-semibold text-primary"
                              onClick={() => {
                                setKolomFilter(String(d.kolom));
                                setBulanFilter(monitoringBulan);
                                setTab("rincian");
                              }}
                            >
                              Rincian
                            </Button>
                          ) : (
                            <span className="text-[11px] text-rose-600 font-medium italic">Tunggakan</span>
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
                  <TableRow className="bg-muted/40">
                    <TableHead className="sticky left-0 bg-card font-bold min-w-64">Mata Anggaran</TableHead>
                    {activeMonths.map((m) => (
                      <TableHead key={String(m)} className="text-right whitespace-nowrap font-bold">
                        {labelBulan(m)}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-black text-primary">Total</TableHead>
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
                      <TableCell className="sticky left-0 bg-card min-w-64 text-xs font-medium">
                        {r.label}
                      </TableCell>
                      {activeMonths.map((m) => {
                        const v = r.cells.get(m === null ? "tanpa" : String(m)) ?? 0;
                        return (
                          <TableCell
                            key={String(m)}
                            className={cn(
                              "text-right text-xs whitespace-nowrap font-mono",
                              v === 0 ? "text-muted-foreground/30" : "font-medium text-foreground",
                            )}
                          >
                            {v === 0 ? "—" : rupiah(v)}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-bold font-mono whitespace-nowrap text-emerald-700">
                        {rupiah(r.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {perAnggaran.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={activeMonths.length + 2} className="py-12 text-center text-muted-foreground">
                        {trx.isLoading ? "Memuat data…" : "Tidak ada data untuk filter ini."}
                      </TableCell>
                    </TableRow>
                  )}
                  {perAnggaran.length > 0 && (
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell className="sticky left-0 bg-muted font-bold text-xs uppercase tracking-wider">
                        TOTAL SEMUA
                      </TableCell>
                      {activeMonths.map((m) => (
                        <TableCell
                          key={String(m)}
                          className="text-right font-bold font-mono whitespace-nowrap text-primary"
                        >
                          {rupiah(columnTotals.get(m === null ? "tanpa" : String(m)) ?? 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-black font-mono whitespace-nowrap text-emerald-700 text-sm">
                        {rupiah(grandTotal)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 4: RINCIAN TRANSAKSI DENGAN LIVE SEARCH */}
          <TabsContent value="rincian">
            <div className="panel space-y-3 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Cari voucher, kolom, keterangan…"
                      value={searchRincian}
                      onChange={(e) => setSearchRincian(e.target.value)}
                      className="pl-8 h-8 text-xs bg-background"
                    />
                  </div>
                  {searchRincian && (
                    <Button variant="ghost" size="sm" onClick={() => setSearchRincian("")} className="h-8 px-2 text-xs">
                      Reset cari
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Ditemukan <strong>{rows.length}</strong> transaksi</span>
                  {budgetId !== "semua" && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      {selectedBudget?.code}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-bold w-28">Tanggal</TableHead>
                      <TableHead className="font-bold w-32">No. Bukti</TableHead>
                      <TableHead className="font-bold w-24">Kolom</TableHead>
                      <TableHead className="font-bold w-24">Bulan</TableHead>
                      <TableHead className="font-bold w-60">Mata Anggaran</TableHead>
                      <TableHead className="font-bold">Keterangan Transaksi</TableHead>
                      <TableHead className="text-right font-bold w-32">Nominal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 500).map((t) => (
                      <TableRow key={t.id} className="hover:bg-muted/10 text-xs">
                        <TableCell className="whitespace-nowrap font-medium">{tanggal(t.trx_date)}</TableCell>
                        <TableCell className="font-mono font-semibold text-primary">{t.voucher_no}</TableCell>
                        <TableCell>
                          <Badge variant={t.kolom === null ? "outline" : "secondary"} className="font-mono text-[11px]">
                            {labelKolom(t.kolom)}
                          </Badge>
                        </TableCell>
                        <TableCell>{labelBulan(t.bulan)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.budget_line_id ? (
                            <button
                              className="text-left hover:text-foreground hover:underline font-medium"
                              onClick={() => setBudgetId(t.budget_line_id)}
                            >
                              {t.budget_lines ? `${t.budget_lines.code} — ${t.budget_lines.name}` : "-"}
                            </button>
                          ) : (
                            t.budget_lines ? `${t.budget_lines.code} — ${t.budget_lines.name}` : "-"
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">{t.description}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {rupiah(t.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length > 0 && (
                      <TableRow className="bg-muted/50 font-bold border-t-2">
                        <TableCell colSpan={6} className="text-right font-bold uppercase tracking-wider text-xs">
                          TOTAL TERFILTER ({rows.length} Transaksi)
                        </TableCell>
                        <TableCell className="text-right font-mono font-black text-emerald-700 text-sm whitespace-nowrap">
                          {rupiah(grandTotal)}
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                          {trx.isLoading ? "Memuat data…" : "Tidak ada transaksi yang cocok dengan filter atau pencarian."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {rows.length > 500 && (
                <p className="py-2 text-[11px] text-muted-foreground text-center">
                  Menampilkan 500 dari {rows.length} transaksi. Gunakan filter atau kotak pencarian untuk mempersempit data.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}