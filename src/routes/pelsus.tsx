import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Church,
  Lock,
  Unlock,
  KeyRound,
  FileSpreadsheet,
  HeartHandshake,
  Newspaper,
  Share2,
  Copy,
  Check,
  Search,
  ArrowLeft,
  HelpCircle,
} from "lucide-react";
import { transactionsQuery, budgetLinesQuery } from "@/lib/queries";
import { useAppSettings } from "@/lib/settings";
import { rupiah, tanggal } from "@/lib/format";
import { parseKolom } from "@/lib/kolom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/pelsus")({
  head: () => ({
    meta: [
      { title: "Portal Pelayan Khusus (Pelsus) — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Portal transparansi keuangan khusus Pelayan Khusus (Diaken, Penatua, BPMJ) GMIM Bukit Moria Tikala Baru: Laporan Kolom, Dana Duka, dan Warta.",
      },
    ],
  }),
  component: PelsusPortalPage,
});

const BULAN_OPTIONS = [
  { value: "all", label: "Semua Bulan (Jan – Des)" },
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

const BULAN_NAMES: Record<string, string> = {
  "01": "Januari",
  "02": "Februari",
  "03": "Maret",
  "04": "April",
  "05": "Mei",
  "06": "Juni",
  "07": "Juli",
  "08": "Agustus",
  "09": "September",
  "10": "Oktober",
  "11": "November",
  "12": "Desember",
};

function PelsusPortalPage() {
  const { settings } = useAppSettings();
  const [pinInput, setPinInput] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Filter States
  const [activeTab, setActiveTab] = useState("kolom");
  const [filterBulan, setFilterBulan] = useState<string>("all");
  const [filterKolom, setFilterKolom] = useState<string>("all");
  const [filterCari, setFilterCari] = useState<string>("");

  const PIN_CORRECT = (settings.pinPelsus || "777888").trim();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedAuth = sessionStorage.getItem("pelsus_session_auth");
      if (savedAuth === "true") {
        setIsUnlocked(true);
      }
    }
  }, []);

  const handleVerifyPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput.trim() === PIN_CORRECT) {
      setIsUnlocked(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pelsus_session_auth", "true");
      }
      toast.success("PIN Terverifikasi", {
        description: "Selamat datang di Portal Pelayan Khusus GMIM BUMOTIK.",
      });
    } else {
      toast.error("PIN Salah", {
        description: "Silakan masukkan PIN 6-digit Pelayan Khusus yang benar.",
      });
      setPinInput("");
    }
  };

  const handleLogoutPelsus = () => {
    setIsUnlocked(false);
    setPinInput("");
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pelsus_session_auth");
    }
    toast.info("Anda telah keluar dari Portal Pelsus.");
  };

  // Queries with 5-minute cache (Zero-load)
  const trx = useQuery({
    ...transactionsQuery,
    staleTime: 5 * 60 * 1000,
  });

  const budgets = useQuery({
    ...budgetLinesQuery,
    staleTime: 10 * 60 * 1000,
  });

  const rawRows = useMemo(() => trx.data ?? [], [trx.data]);

  // 1. DATA TAB LAPORAN KOLOM
  const matrixKolom = useMemo(() => {
    const map = new Map<
      number,
      { total: number; count: number; lastDate: string | null; lastDesc: string | null }
    >();
    for (let k = 1; k <= 29; k++) {
      map.set(k, { total: 0, count: 0, lastDate: null, lastDesc: null });
    }

    const allPenerimaan = rawRows.filter((t) => t.kind === "penerimaan");
    for (const t of allPenerimaan) {
      const trxMonth = t.trx_date ? t.trx_date.slice(5, 7) : "";
      if (filterBulan !== "all" && trxMonth !== filterBulan) continue;
      const k = parseKolom(t.description) ?? parseKolom(t.category);
      if (k && k >= 1 && k <= 29) {
        const cur = map.get(k)!;
        cur.total += Number(t.amount || 0);
        cur.count += 1;
        if (!cur.lastDate || t.trx_date > cur.lastDate) {
          cur.lastDate = t.trx_date;
          cur.lastDesc = t.description;
        }
      }
    }

    return Array.from(map.entries()).map(([k, d]) => ({
      kolom: k,
      ...d,
    }));
  }, [rawRows, filterBulan]);

  const totalPenerimaanKolom = useMemo(() => {
    return matrixKolom.reduce((acc, m) => acc + m.total, 0);
  }, [matrixKolom]);

  const kolomSudahSetorCount = useMemo(() => {
    return matrixKolom.filter((m) => m.total > 0).length;
  }, [matrixKolom]);

  // 2. DATA TAB DANA DUKA
  const dukaTransactions = useMemo(() => {
    return rawRows.filter((t) => {
      const code = t.budget_lines?.code || "";
      const desc = (t.description || "").toLowerCase();
      const cat = (t.category || "").toLowerCase();
      const isDuka =
        code.includes("1.3.54") ||
        code.includes("duka") ||
        desc.includes("duka") ||
        cat.includes("duka");
      if (!isDuka) return false;
      const trxMonth = t.trx_date ? t.trx_date.slice(5, 7) : "";
      if (filterBulan !== "all" && trxMonth !== filterBulan) return false;
      if (filterKolom !== "all") {
        const k = parseKolom(t.description) ?? parseKolom(t.category);
        if (filterKolom === "none" && k !== null) return false;
        if (filterKolom !== "none" && k !== Number(filterKolom)) return false;
      }
      return true;
    });
  }, [rawRows, filterBulan, filterKolom]);

  const totalDukaMasuk = useMemo(() => {
    return dukaTransactions
      .filter((t) => t.kind === "penerimaan")
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);
  }, [dukaTransactions]);

  const totalDukaKeluar = useMemo(() => {
    return dukaTransactions
      .filter((t) => t.kind === "pengeluaran")
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);
  }, [dukaTransactions]);

  // 3. DATA TAB WARTA KEUANGAN
  const wartaSummary = useMemo(() => {
    const penerimaan = rawRows
      .filter((t) => t.kind === "penerimaan")
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const pengeluaran = rawRows
      .filter((t) => t.kind === "pengeluaran" && t.status === "approved")
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const saldoKas = penerimaan - pengeluaran;
    return { penerimaan, pengeluaran, saldoKas };
  }, [rawRows]);

  // OPSI C: GENERATE TEKS FORMAT WHATSAPP
  const generateWhatsAppKolomText = () => {
    const bulanStr = filterBulan === "all" ? "Tahun 2026 (Semua Bulan)" : ("Bulan " + (BULAN_NAMES[filterBulan] || filterBulan));
    let text = "*📊 REKAPITULASI PENERIMAAN SETORAN KOLOM*\n";
    text += "*" + (settings.namaGereja || "GMIM") + " — " + (settings.namaJemaat || "Bukit Moria Tikala Baru") + "*\n";
    text += "Periode: " + bulanStr + "\n";
    text += "------------------------------------\n";
    text += "*Total Penerimaan Kolom:* " + rupiah(totalPenerimaanKolom) + "\n";
    text += "*Kolom Aktif Menyetor:* " + kolomSudahSetorCount + " dari 29 Kolom\n";
    text += "------------------------------------\n\n";
    text += "*DAFTAR SETORAN PER KOLOM:*\n";
    for (const m of matrixKolom) {
      const statusIcon = m.total > 0 ? "✅" : "⏳";
      text += statusIcon + " *Kolom " + m.kolom + ":* " + (m.total > 0 ? rupiah(m.total) : "Belum ada setoran");
      if (m.total > 0 && m.lastDate) {
        text += " _(Trx Terakhir: " + tanggal(m.lastDate) + ")_";
      }
      text += "\n";
    }
    text += "\n------------------------------------\n";
    text += "_Dibuat otomatis oleh Sistem BUMOTIK FINANCIAL_\n";
    text += "_Akses portal lengkap: https://keuanganbumotik.my.id/pelsus_";
    return text;
  };

  const generateWhatsAppDukaText = () => {
    const bulanStr = filterBulan === "all" ? "Semua Periode" : ("Bulan " + (BULAN_NAMES[filterBulan] || filterBulan));
    let text = "*🕊️ REKAPITULASI DANA DUKA JEMAAT*\n";
    text += "*" + (settings.namaJemaat || "GMIM Bukit Moria Tikala Baru") + "*\n";
    text += "Periode: " + bulanStr + "\n";
    text += "------------------------------------\n";
    text += "*Total Iuran Duka Masuk:* " + rupiah(totalDukaMasuk) + "\n";
    text += "*Total Santunan Duka Disalurkan:* " + rupiah(totalDukaKeluar) + "\n";
    text += "*Saldo Kas Duka:* " + rupiah(totalDukaMasuk - totalDukaKeluar) + "\n";
    text += "------------------------------------\n\n";
    text += "*RINCIAN TRANSAKSI DUKA TERBARU:*\n";
    dukaTransactions.slice(0, 15).forEach((t, i) => {
      const tanda = t.kind === "penerimaan" ? "➕ Masuk" : "➖ Santunan";
      text += (i + 1) + ". [" + tanggal(t.trx_date) + "] *" + tanda + "* " + rupiah(t.amount) + "\n";
      text += "   Ket: " + t.description + "\n";
    });
    text += "\n------------------------------------\n";
    text += "_Portal Pelayan Khusus: https://keuanganbumotik.my.id/pelsus_";
    return text;
  };

  const copyToClipboard = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    toast.success("Teks Berhasil Disalin!", {
      description: "Format rapi siap ditempel (Paste) ke WhatsApp Grup Kolom / Pelsus.",
    });
    setTimeout(() => setCopiedSection(null), 3000);
  };

  const shareViaWhatsApp = (text: string) => {
    const encoded = encodeURI(text);
    window.open("https://api.whatsapp.com/send?text=" + encoded, "_blank");
  };

  // SCREEN 1: LOCK SCREEN (PIN 6-DIGIT)
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#0b192c] text-white flex flex-col justify-between p-4 sm:p-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors">
            <ArrowLeft className="size-4" /> Kembali ke Beranda
          </Link>
          <Badge variant="outline" className="border-amber-400/40 text-amber-300 font-mono text-xs">
            PORTAL PELSUS
          </Badge>
        </div>

        <div className="max-w-md w-full mx-auto my-auto py-8">
          <Card className="border-slate-800 bg-slate-900/90 backdrop-blur-md shadow-2xl text-slate-100">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto size-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
                <KeyRound className="size-7" />
              </div>
              <CardTitle className="text-xl font-bold font-display text-white tracking-wide">
                Portal Pelayan Khusus
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                {settings.namaJemaat || "GMIM Bukit Moria Tikala Baru"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-center text-slate-300 leading-relaxed">
                Silakan masukkan <strong>PIN Akses 6-Digit</strong> yang telah diberikan oleh BPMJ untuk melihat Laporan Kolom, Dana Duka, dan Warta Keuangan.
              </p>

              <form onSubmit={handleVerifyPin} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    autoFocus
                    placeholder="Masukkan 6-Digit PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                    className="h-12 text-center text-2xl font-mono tracking-[0.3em] font-black bg-slate-950 border-slate-700 text-amber-400 focus-visible:ring-amber-500"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-lg shadow-amber-600/20 gap-2 h-11"
                >
                  <Unlock className="size-4" /> Buka Laporan Pelsus
                </Button>
              </form>

              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                  <HelpCircle className="size-3.5 text-amber-400/80" /> Belum tahu PIN? Hubungi Bendahara / BPMJ.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-[11px] text-slate-300 pb-2">
          &copy; 2026 {settings.namaAplikasi || "BUMOTIK FINANCIAL"} · Transparansi Kas Jemaat
        </div>
      </div>
    );
  }

  // SCREEN 2: UNLOCKED PORTAL (MOBILE-FIRST DASHBOARD)
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 py-3 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={settings.logoUrl || "/favicon.png"}
              alt="Logo"
              className="size-9 rounded-md object-contain bg-white/10 p-0.5 shadow-xs border"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/favicon.png";
              }}
            />
            <div className="leading-tight">
              <h1 className="font-display text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                Portal Pelayan Khusus <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">PELSUS</Badge>
              </h1>
              <p className="text-[11px] text-muted-foreground truncate max-w-[200px] sm:max-w-none">
                {settings.namaJemaat || "GMIM Bukit Moria Tikala Baru"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogoutPelsus}
              className="h-8 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Lock className="size-3.5" /> Kunci Sesi
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
        {/* Global Filter Bar */}
        <Card className="shadow-xs border-primary/20 bg-primary/5">
          <CardContent className="p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Filter Periode Bulan</label>
                <Select value={filterBulan} onValueChange={setFilterBulan}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {BULAN_OPTIONS.map((b) => (
                      <SelectItem key={b.value} value={b.value} className="text-xs">
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Pilih Kolom Anda</label>
                <Select value={filterKolom} onValueChange={setFilterKolom}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Semua Kolom" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all" className="text-xs font-bold">Semua Kolom (1–29)</SelectItem>
                    {Array.from({ length: 29 }, (_, i) => i + 1).map((k) => (
                      <SelectItem key={k} value={String(k)} className="text-xs">
                        Kolom {k}
                      </SelectItem>
                    ))}
                    <SelectItem value="none" className="text-xs">Tanpa Kolom (Ibadah/Pundi)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Cari Keterangan / No. Bukti</label>
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    value={filterCari}
                    onChange={(e) => setFilterCari(e.target.value)}
                    placeholder="Ketik keterangan, no bukti KM-2026-…, pos ibadah…"
                    className="h-9 text-xs pl-8 bg-background"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto sm:max-w-lg h-10">
            <TabsTrigger value="kolom" className="text-xs font-bold gap-1.5">
              <FileSpreadsheet className="size-3.5" /> Laporan Kolom
            </TabsTrigger>
            <TabsTrigger value="duka" className="text-xs font-bold gap-1.5">
              <HeartHandshake className="size-3.5" /> Dana Duka
            </TabsTrigger>
            <TabsTrigger value="warta" className="text-xs font-bold gap-1.5">
              <Newspaper className="size-3.5" /> Warta Kas
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: LAPORAN SETORAN KOLOM & BIPRA */}
          <TabsContent value="kolom" className="space-y-4">
            {/* Action Bar WhatsApp Opsi C */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-lg">
              <div>
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Share2 className="size-3.5" /> Bagikan Rekapitulasi Kolom ke Grup WhatsApp
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  Kirim rekap penerimaan kolom langsung ke grup WA Pelsus atau grup Kolom Anda.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(generateWhatsAppKolomText(), "kolom")}
                  className="h-8 text-xs font-semibold gap-1.5 border-emerald-600/40 text-emerald-700 hover:bg-emerald-100"
                >
                  {copiedSection === "kolom" ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  Salin Teks WA
                </Button>
                <Button
                  size="sm"
                  onClick={() => shareViaWhatsApp(generateWhatsAppKolomText())}
                  className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <Share2 className="size-3.5" /> Kirim ke WhatsApp
                </Button>
              </div>
            </div>

            {/* Stat Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="border-l-4 border-l-primary shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Total Penerimaan Kolom</span>
                  <span className="text-xl font-black text-primary font-mono block mt-0.5">
                    {rupiah(totalPenerimaanKolom)}
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    {filterBulan === "all" ? "Seluruh Bulan 2026" : ("Bulan " + (BULAN_NAMES[filterBulan] || filterBulan))}
                  </span>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-emerald-500 shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Kolom Aktif Menyetor</span>
                  <span className="text-xl font-black text-emerald-600 font-mono block mt-0.5">
                    {kolomSudahSetorCount} <span className="text-sm font-normal text-muted-foreground">/ 29 Kolom</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    {29 - kolomSudahSetorCount} Kolom belum ada setoran
                  </span>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-amber-500 shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Rata-Rata per Kolom</span>
                  <span className="text-xl font-black text-amber-700 font-mono block mt-0.5">
                    {rupiah(kolomSudahSetorCount > 0 ? totalPenerimaanKolom / kolomSudahSetorCount : 0)}
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    Dihitung dari kolom yang aktif menyetor
                  </span>
                </CardContent>
              </Card>
            </div>

            {/* Matrix Table */}
            <Card className="shadow-xs overflow-hidden">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Matriks Setoran Kolom 1 s.d. 29</span>
                  <Badge variant="outline" className="font-mono text-xs">29 Kolom</Badge>
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16">Kolom</TableHead>
                      <TableHead>Status Setoran</TableHead>
                      <TableHead className="text-right">Total Setoran</TableHead>
                      <TableHead className="text-center">Jml Trx</TableHead>
                      <TableHead>Transaksi Terakhir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrixKolom
                      .filter((m) => (filterKolom === "all" ? true : m.kolom === Number(filterKolom)))
                      .map((m) => (
                        <TableRow key={m.kolom} className={m.total === 0 ? "bg-amber-50/20" : ""}>
                          <TableCell className="font-mono font-bold text-sm text-primary">
                            Kolom {m.kolom}
                          </TableCell>
                          <TableCell>
                            {m.total > 0 ? (
                              <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[10px]">
                                Sudah Menyetor
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                                Belum Ada Setoran
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400">
                            {m.total > 0 ? rupiah(m.total) : "Rp 0"}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {m.count > 0 ? (m.count + "x") : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground break-words max-w-xs">
                            {m.lastDate ? (
                              <div>
                                <span className="font-semibold text-foreground">{tanggal(m.lastDate)}</span>
                                <span className="block text-[11px] truncate">{m.lastDesc}</span>
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 2: DANA DUKA */}
          <TabsContent value="duka" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-500/30 p-3 rounded-lg">
              <div>
                <p className="text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                  <Share2 className="size-3.5" /> Bagikan Laporan Dana Duka ke WhatsApp
                </p>
                <p className="text-[11px] text-purple-600 dark:text-purple-400">
                  Kirim rekap iuran dan santunan duka jemaat secara transparan ke jemaat.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(generateWhatsAppDukaText(), "duka")}
                  className="h-8 text-xs font-semibold gap-1.5 border-purple-600/40 text-purple-700 hover:bg-purple-100"
                >
                  {copiedSection === "duka" ? <Check className="size-3.5 text-purple-600" /> : <Copy className="size-3.5" />}
                  Salin Teks WA
                </Button>
                <Button
                  size="sm"
                  onClick={() => shareViaWhatsApp(generateWhatsAppDukaText())}
                  className="h-8 text-xs font-semibold gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                >
                  <Share2 className="size-3.5" /> Kirim ke WhatsApp
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="border-l-4 border-l-emerald-500 shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Iuran Duka Masuk</span>
                  <span className="text-xl font-black text-emerald-600 font-mono block mt-0.5">
                    {rupiah(totalDukaMasuk)}
                  </span>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-rose-500 shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Santunan Disalurkan</span>
                  <span className="text-xl font-black text-rose-600 font-mono block mt-0.5">
                    {rupiah(totalDukaKeluar)}
                  </span>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500 shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Saldo Kas Duka</span>
                  <span className="text-xl font-black text-purple-700 font-mono block mt-0.5">
                    {rupiah(totalDukaMasuk - totalDukaKeluar)}
                  </span>
                </CardContent>
              </Card>
            </div>

            {/* Rincian Transaksi Duka */}
            <Card className="shadow-xs overflow-hidden">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold">Rincian Transaksi Dana Duka</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-28">Tanggal</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Keterangan Transaksi</TableHead>
                      <TableHead className="text-right">Nominal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dukaTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                          Tidak ada data transaksi dana duka pada filter yang dipilih.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dukaTransactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {tanggal(t.trx_date)}
                          </TableCell>
                          <TableCell>
                            {t.kind === "penerimaan" ? (
                              <Badge className="bg-emerald-600 text-white text-[10px]">Iuran Masuk</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">Santunan Duka</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground break-words min-w-[200px]">
                            {t.description}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs">
                            {t.kind === "penerimaan" ? (
                              <span className="text-emerald-700">{rupiah(t.amount)}</span>
                            ) : (
                              <span className="text-rose-700">-{rupiah(t.amount)}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 3: WARTA KEUANGAN MINGGUAN */}
          <TabsContent value="warta" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="border-l-4 border-l-emerald-500 shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Total Penerimaan Kas</span>
                  <span className="text-xl font-black text-emerald-600 font-mono block mt-0.5">
                    {rupiah(wartaSummary.penerimaan)}
                  </span>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-rose-500 shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Total Pengeluaran Kas</span>
                  <span className="text-xl font-black text-rose-600 font-mono block mt-0.5">
                    {rupiah(wartaSummary.pengeluaran)}
                  </span>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-primary shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Saldo Akhir Kas</span>
                  <span className="text-xl font-black text-primary font-mono block mt-0.5">
                    {rupiah(wartaSummary.saldoKas)}
                  </span>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Church className="size-4 text-primary" /> Transparansi Warta Jemaat
                </CardTitle>
                <CardDescription className="text-xs">
                  Seluruh data penerimaan dan pengeluaran dicatat secara realtime dan dipublikasikan pada Warta Keuangan Jemaat.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 bg-muted/40 rounded-lg border flex items-center justify-between">
                  <span>Nama Jemaat:</span>
                  <strong className="font-semibold text-foreground">{settings.namaJemaat || "GMIM Bukit Moria Tikala Baru"}</strong>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg border flex items-center justify-between">
                  <span>Ketua BPMJ:</span>
                  <strong className="font-semibold text-foreground">{settings.namaKetuaBpmj || "Pdt. Handry Mecky Dengah, M.Th"}</strong>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg border flex items-center justify-between">
                  <span>Bendahara Jemaat:</span>
                  <strong className="font-semibold text-foreground">{settings.namaBendahara || "Dkn. Jerich Montori"}</strong>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background py-4 px-4 sm:px-8 text-center text-xs text-muted-foreground">
        <p>
          &copy; 2026 {settings.namaAplikasi || "BUMOTIK FINANCIAL"} · Sistem Keuangan {settings.namaJemaat || "GMIM Bukit Moria Tikala Baru"}
        </p>
      </footer>
    </div>
  );
}