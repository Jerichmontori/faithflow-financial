import { createFileRoute, Link } from "@tanstack/react-router";
import { Church, ShieldCheck, LineChart, Wallet, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BUMOTIK FINANCIAL — Manajemen Keuangan Gereja" },
      {
        name: "description",
        content:
          "Sistem manajemen keuangan dan administrasi gereja: kas realtime, mata anggaran, approval pengeluaran, dan laporan periodik.",
      },
      { property: "og:title", content: "BUMOTIK FINANCIAL — Manajemen Keuangan Gereja" },
      {
        property: "og:description",
        content:
          "Kelola penerimaan, pengeluaran, mata anggaran, dan approval keuangan jemaat dalam satu sistem.",
      },
    ],
  }),
  component: Index,
});

const FITUR = [
  {
    icon: LineChart,
    title: "Monitoring Realtime",
    desc: "Saldo kas, kas masuk & keluar hari ini, serta total bulan berjalan langsung terpantau.",
  },
  {
    icon: Wallet,
    title: "Mata Anggaran",
    desc: "Setiap transaksi wajib memilih kode mata anggaran dengan persentase serapan otomatis.",
  },
  {
    icon: ClipboardCheck,
    title: "Approval Pengeluaran",
    desc: "Pengeluaran diajukan Admin Keuangan dan disetujui Ketua BPMJ secara berjenjang.",
  },
  {
    icon: ShieldCheck,
    title: "Akses Berbasis Peran",
    desc: "Tujuh peran pengguna dengan hak akses berbeda, dari Super Administrator hingga Viewer.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-5 lg:px-12">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-gradient-navy text-primary-foreground">
            <Church className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">BUMOTIK FINANCIAL</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Keuangan Gereja
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Masuk</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-16 pb-20 text-center lg:pt-24">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Sistem Manajemen Keuangan &amp; Administrasi Jemaat
        </p>
        <h1 className="mt-5 text-4xl leading-tight font-semibold sm:text-5xl">
          Keuangan gereja yang tertib, transparan, dan mudah dipertanggungjawabkan.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground">
          Catat penerimaan dan pengeluaran, kendalikan mata anggaran, jalankan approval, dan pantau
          realisasi anggaran secara realtime.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg">
            <Link to="/auth">Mulai kelola keuangan</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-2">
        {FITUR.map(({ icon: Icon, title, desc }) => (
          <article key={title} className="panel p-6">
            <Icon className="size-5 text-accent" />
            <h2 className="mt-4 text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
          </article>
        ))}
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} BUMOTIK FINANCIAL
      </footer>
    </div>
  );
}
