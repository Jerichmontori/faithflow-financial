import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Church, ShieldCheck, LineChart, Wallet, ClipboardCheck, Sparkles, BookOpen, Clock, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BUMOTIK FINANCIAL — Sistem Manajemen Keuangan Gereja" },
      {
        name: "description",
        content:
          "Sistem manajemen keuangan dan administrasi jemaat GMIM Bukit Moria Tikala Baru: kas realtime, mata anggaran, warta keuangan, dan laporan terpadu.",
      },
      { property: "og:title", content: "BUMOTIK FINANCIAL — Sistem Keuangan Jemaat" },
      {
        property: "og:description",
        content:
          "Catat penerimaan dan pengeluaran, kendalikan mata anggaran, cetak bukti tanda terima, dan pantau keuangan jemaat secara transparan.",
      },
    ],
  }),
  component: Index,
});

const FITUR = [
  {
    icon: LineChart,
    title: "Monitoring Kas Realtime",
    desc: "Saldo kas fisik di kasir/brankas dan saldo bank terpantau otomatis setiap transaksi dicatat.",
  },
  {
    icon: Wallet,
    title: "Tata Kelola Pos Anggaran",
    desc: "Kendalikan pos penerimaan dan pengeluaran jemaat dengan persentase serapan anggaran otomatis.",
  },
  {
    icon: ClipboardCheck,
    title: "Cetak Kuitansi & Tanda Terima F4",
    desc: "Cetak bukti setoran 2-rangkap (Arsip Gereja & Penyetor) rapi dan siap cetak langsung ke printer.",
  },
  {
    icon: ShieldCheck,
    title: "Keamanan & Akses Bertingkat",
    desc: "Tujuh hak akses pengguna terstruktur, mulai dari Ketua BPMJ, Bendahara, Pendeta, hingga Auditor.",
  },
];

function Index() {
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        navigate({ to: "/dashboard", replace: true });
      }
    });
  }, [navigate]);

  const bgOpacity = ((settings.bannerOpacity ?? 45) / 100);
  const bgColor = settings.warnaBackgroundBeranda || "#0b192c";
  const bgPosition = settings.bannerPosition || "center";

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* Header Bar */}
      <header className="flex items-center justify-between border-b border-border/40 bg-background/95 backdrop-blur-sm px-6 py-4 lg:px-12 sticky top-0 z-30">
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
            <p className="font-display text-sm font-bold tracking-wide">
              {settings.namaAplikasi || "BUMOTIK FINANCIAL"}
            </p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-primary font-semibold truncate max-w-[200px] sm:max-w-none">
              {settings.namaJemaat || "GMIM Bukit Moria Tikala Baru"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="font-semibold shadow-sm gap-1.5">
            <Link to="/auth">
              Masuk ke Sistem <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero Section dengan Background Biru & Gambar Latar Kustom */}
      <main className="flex-1">
        <section
          className="relative overflow-hidden px-6 pt-16 pb-24 text-center text-white lg:pt-24 lg:pb-32 transition-colors duration-300"
          style={{ backgroundColor: bgColor }}
        >
          {/* Layer Gambar Background dengan Opacity & Posisi Custom */}
          {settings.bannerBerandaUrl && (
            <div
              className="absolute inset-0 z-0 bg-cover bg-no-repeat transition-all duration-300 pointer-events-none"
              style={{
                backgroundImage: `url("${settings.bannerBerandaUrl}")`,
                opacity: bgOpacity,
                backgroundPosition: bgPosition,
              }}
            />
          )}

          {/* Layer Gradient Overlay untuk Kontras Teks yang Elegan */}
          <div
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              background: settings.bannerBerandaUrl
                ? "linear-gradient(180deg, rgba(11, 25, 44, 0.70) 0%, rgba(11, 25, 44, 0.88) 100%)"
                : "radial-gradient(circle at center, rgba(30, 58, 138, 0.45) 0%, rgba(11, 25, 44, 0.95) 100%)",
            }}
          />

          {/* Konten Hero */}
          <div className="relative z-10 mx-auto max-w-5xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-md px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white mb-6 shadow-sm">
              <Sparkles className="size-3.5 text-amber-300" />
              {settings.subjudulBeranda || "SISTEM MANAJEMEN KEUANGAN & ADMINISTRASI JEMAAT"}
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white leading-[1.18] max-w-4xl mx-auto drop-shadow-sm">
              {settings.judulBeranda || "Keuangan gereja yang tertib, transparan, dan mudah dipertanggungjawabkan."}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-sm sm:text-base text-gray-200 leading-relaxed drop-shadow-xs font-normal">
              {settings.deskripsiBeranda ||
                "Catat penerimaan dan pengeluaran, kendalikan mata anggaran, jalankan approval, dan pantau realisasi anggaran jemaat secara realtime."}
            </p>

            {/* Motto / Firman Tuhan Callout */}
            {settings.mottoAyatBeranda && (
              <div className="mx-auto mt-8 max-w-xl rounded-xl border border-white/20 bg-white/10 backdrop-blur-md p-4 text-xs text-amber-100 font-medium flex items-center justify-center gap-2.5 shadow-md">
                <BookOpen className="size-4.5 text-amber-300 shrink-0" />
                <span className="italic leading-relaxed">"{settings.mottoAyatBeranda}"</span>
              </div>
            )}

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="font-bold px-7 py-6 text-sm sm:text-base shadow-xl gap-2 bg-primary hover:bg-primary/90 text-primary-foreground border-2 border-white/20">
                <Link to="/auth">
                  {settings.teksTombolBeranda || "Mulai Kelola Keuangan"}
                  <ArrowRight className="size-4.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="mx-auto grid max-w-5xl gap-5 px-6 -mt-10 mb-16 relative z-20 sm:grid-cols-2">
          {FITUR.map(({ icon: Icon, title, desc }) => (
            <article key={title} className="panel p-6 border rounded-xl bg-card shadow-md hover:border-primary/50 transition-all hover:shadow-lg">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                <Icon className="size-5" />
              </div>
              <h2 className="text-base font-bold text-foreground">{title}</h2>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </article>
          ))}
        </section>

        {/* Info & Jadwal Ibadah */}
        {(settings.jadwalIbadahSingkat || settings.kontakSekretariat) && (
          <section className="border-t bg-muted/30 py-8 px-6">
            <div className="mx-auto max-w-5xl grid gap-4 sm:grid-cols-2 text-xs">
              {settings.jadwalIbadahSingkat && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg border bg-background shadow-xs">
                  <Clock className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-foreground font-semibold">Jadwal Pelayanan & Ibadah</strong>
                    <span className="text-muted-foreground">{settings.jadwalIbadahSingkat}</span>
                  </div>
                </div>
              )}
              {settings.kontakSekretariat && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg border bg-background shadow-xs">
                  <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-foreground font-semibold">Sekretariat & Informasi</strong>
                    <span className="text-muted-foreground">{settings.kontakSekretariat}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground bg-background">
        <p>
          &copy; {new Date().getFullYear()} {settings.namaAplikasi || "BUMOTIK FINANCIAL"} — {settings.namaGereja || "GMIM"} {settings.namaJemaat || "Jemaat Bukit Moria Tikala Baru"}.
        </p>
      </footer>
    </div>
  );
}
