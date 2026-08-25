import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  HeartHandshake,
  Newspaper,
  Lock,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useAppSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Import 3 tampilan laporan lengkap identik
import { LaporanKolomView } from "./_authenticated/laporan";
import { DanaDukaView } from "./_authenticated/dana-duka";
import { WartaKeuanganView } from "./_authenticated/warta";

export const Route = createFileRoute("/pelsus")({
  head: () => ({
    meta: [
      { title: "Portal Pelayan Khusus (Pelsus) — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Portal akses cepat khusus Pelayan Khusus (Pelsus) GMIM Bukit Moria Tikala Baru: Laporan Kolom, Dana Duka, dan Warta Keuangan.",
      },
    ],
  }),
  component: PelsusPortalPage,
});

const PELSUS_AUTH_KEY = "bumotik_pelsus_session_auth_v1";

function PelsusPortalPage() {
  const { settings } = useAppSettings();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("kolom");
  const [loading, setLoading] = useState<boolean>(true);

  // Periksa apakah sesi Pelsus sudah aktif di tab browser saat ini
  useEffect(() => {
    try {
      const savedAuth = sessionStorage.getItem(PELSUS_AUTH_KEY);
      if (savedAuth === "true") {
        setIsAuthenticated(true);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const handleVerifyPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const correctPin = (settings.pinPelsus || "777888").trim();

    if (pinInput.trim() === correctPin) {
      setIsAuthenticated(true);
      try {
        sessionStorage.setItem(PELSUS_AUTH_KEY, "true");
      } catch {
        // ignore
      }
      toast.success("Akses Diberikan. Selamat melayani!");
      setPinInput("");
    } else {
      toast.error("PIN yang Anda masukkan salah. Silakan hubungi BPMJ.");
    }
  };

  const handleLogoutPelsus = () => {
    setIsAuthenticated(false);
    try {
      sessionStorage.removeItem(PELSUS_AUTH_KEY);
    } catch {
      // ignore
    }
    toast.info("Sesi Portal Pelsus telah dikunci.");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-2 text-sm font-mono">
          <Sparkles className="size-4 animate-spin text-amber-400" />
          Memuat Portal Pelsus…
        </div>
      </div>
    );
  }

  // JIKA BELUM MEMASUKKAN PIN YANG BENAR -> LAYAR KUNCI PIN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between px-4 py-8 relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top bar */}
        <div className="flex items-center justify-between max-w-md mx-auto w-full relative z-10">
          <Button asChild variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white gap-1.5 -ml-2">
            <Link to="/">
              <ArrowLeft className="size-3.5" /> Kembali ke Beranda
            </Link>
          </Button>
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px] uppercase font-mono">
            PORTAL PELSUS
          </Badge>
        </div>

        {/* PIN Entry Card */}
        <div className="max-w-md mx-auto w-full relative z-10 my-auto">
          <Card className="border-slate-800 bg-slate-900/90 backdrop-blur-md shadow-2xl">
            <CardHeader className="text-center pb-4">
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
                    onChange={(e) => setPinInput(e.target.value.replace(/\\D/g, ""))}
                    className="h-12 text-center text-2xl font-mono tracking-[0.3em] font-black bg-slate-950 border-slate-700 text-amber-400 focus-visible:ring-amber-500"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md gap-2"
                >
                  <Lock className="size-4" /> Buka Akses Laporan
                </Button>
              </form>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-slate-500">
                  Lupa PIN? Silakan hubungi Sekretaris / Bendahara BPMJ.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 relative z-10">
          © {new Date().getFullYear()} {settings.namaAplikasi || "BUMOTIK FINANCIAL"} · Mode Akses Cepat Pelsus
        </div>
      </div>
    );
  }

  // JIKA SUDAH TERVERIFIKASI -> TAMPILAN DASHBOARD LAPORAN LENGKAP PELSUS
  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* Header Bar Khusus Pelsus */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <img
            src={settings.logoUrl || "/favicon.png"}
            alt="Logo"
            className="size-8 rounded-md object-contain bg-white/10 p-0.5 border"
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
            <LogOut className="size-3.5" /> Kunci Sesi
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Top 3 Menu Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-1.5 rounded-xl border">
            <TabsList className="grid grid-cols-3 w-full sm:w-auto h-10">
              <TabsTrigger value="kolom" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <LayoutDashboard className="size-3.5" /> Laporan Kolom
              </TabsTrigger>
              <TabsTrigger value="duka" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <HeartHandshake className="size-3.5" /> Dana Duka
              </TabsTrigger>
              <TabsTrigger value="warta" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Newspaper className="size-3.5" /> Warta Keuangan
              </TabsTrigger>
            </TabsList>

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
              <ShieldCheck className="size-3.5 text-emerald-600" /> Mode Pelayan Khusus (Read-Only)
            </div>
          </div>

          {/* TAB 1: LAPORAN KOLOM LENGKAP IDENTIK */}
          <TabsContent value="kolom" className="focus-visible:outline-hidden space-y-4">
            <LaporanKolomView isPelsusView={true} />
          </TabsContent>

          {/* TAB 2: DANA DUKA LENGKAP IDENTIK (TARIF DINAMIS & TUNGGAKAN LALU & DAFTAR NAMA DI-HIDE) */}
          <TabsContent value="duka" className="focus-visible:outline-hidden space-y-4">
            <DanaDukaView isPelsusView={true} />
          </TabsContent>

          {/* TAB 3: WARTA KEUANGAN LENGKAP IDENTIK (SALDO AWAL BANK & TTD BPMJ DI-HIDE) */}
          <TabsContent value="warta" className="focus-visible:outline-hidden space-y-4">
            <WartaKeuanganView isPelsusView={true} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/20 py-4 px-6 text-center text-xs text-muted-foreground">
        © ${new Date().getFullYear()} ${settings.namaJemaat || "GMIM Bukit Moria Tikala Baru"} · ${settings.namaAplikasi || "BUMOTIK FINANCIAL"}
      </footer>
    </div>
  );
}
