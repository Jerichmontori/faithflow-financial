import { createFileRoute, Link } from "@tanstack/react-router";
import { Church, ShieldCheck, LineChart, Wallet, ClipboardCheck, Sparkles, BookOpen, Clock, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/lib/settings";

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
  const { settings } = useAppSettings();

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

      {/* Hero Section */}
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 pt-12 pb-16 text-center lg:pt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary mb-6">
            <Sparkles className="size-3.5" />
            {settings.subjudulBeranda || "SISTEM MANAJEMEN KEUANGAN & ADMINISTRASI JEMAAT"}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-foreground leading-[1.15] max-w-4xl mx-auto">
            {settings.judulBeranda || "Keuangan gereja yang tertib, transparan, dan mudah dipertanggungjawabkan."}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
            {settings.deskripsiBeranda ||
              "Catat penerimaan dan pengeluaran, kendalikan mata anggaran, jalankan approval, dan pantau realisasi anggaran jemaat secara realtime."}
          </p>

          {/* Motto / Firman Tuhan Callout */}
          {settings.mottoAyatBeranda && (
            <div className="mx-auto mt-8 max-w-xl rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-primary font-medium flex items-center justify-center gap-2 shadow-xs">
              <BookOpen className="size-4 shrink-0" />
              <span className="italic leading-snug">"{settings.mottoAyatBeranda}"</span>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="font-semibold px-6 shadow-md gap-2">
              <Link to="/auth">
                {settings.teksTombolBeranda || "Mulai Kelola Keuangan"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-20 sm:grid-cols-2">
          {FITUR.map(({ icon: Icon, title, desc }) => (
            <article key={title} className="panel p-6 border rounded-xl bg-card shadow-xs hover:border-primary/40 transition-colors">
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
                <div className="flex items-start gap-2.5 p-3 rounded-lg border bg-background">
                  <Clock className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-foreground font-semibold">Jadwal Pelayanan & Ibadah</strong>
                    <span className="text-muted-foreground">{settings.jadwalIbadahSingkat}</span>
                  </div>
                </div>
              )}
              {settings.kontakSekretariat && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border bg-background">
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
