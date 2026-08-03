import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownCircle, ArrowUpCircle, Landmark, CalendarRange } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { budgetLinesQuery, transactionsQuery } from "@/lib/queries";
import { rupiah, rupiahShort, namaBulan, tanggal } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Keuangan — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content: "Pantau saldo kas, kas masuk/keluar harian, dan realisasi anggaran gereja.",
      },
      { property: "og:title", content: "Dashboard Keuangan — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Ringkasan kas dan realisasi anggaran gereja secara realtime.",
      },
    ],
  }),
  component: DashboardPage,
});

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  tone?: "default" | "in" | "out";
}) {
  const toneClass =
    tone === "in" ? "text-success" : tone === "out" ? "text-destructive" : "text-accent";
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <Icon className={`size-4 ${toneClass}`} />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DashboardPage() {
  const trx = useQuery(transactionsQuery);
  const budgets = useQuery(budgetLinesQuery);

  const rows = (trx.data ?? []).filter((t) => t.status !== "rejected");
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const sum = (list: typeof rows) => list.reduce((a, t) => a + Number(t.amount), 0);
  const masuk = rows.filter((t) => t.kind === "penerimaan");
  const keluar = rows.filter((t) => t.kind === "pengeluaran" && t.status === "approved");
  const saldo = sum(masuk) - sum(keluar);
  const masukHariIni = sum(masuk.filter((t) => t.trx_date === today));
  const keluarHariIni = sum(keluar.filter((t) => t.trx_date === today));
  const bulanIni = (t: (typeof rows)[number]) => {
    const d = new Date(t.trx_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };
  const totalBulan = sum(masuk.filter(bulanIni)) - sum(keluar.filter(bulanIni));
  const pending = (trx.data ?? []).filter((t) => t.status === "pending");

  const chart = Array.from({ length: 12 }, (_, i) => ({
    bulan: namaBulan(i),
    pendapatan: sum(masuk.filter((t) => new Date(t.trx_date).getMonth() === i)),
    pengeluaran: sum(keluar.filter((t) => new Date(t.trx_date).getMonth() === i)),
  }));

  const serapan = (budgets.data ?? [])
    .map((b) => {
      const realisasi = sum(rows.filter((t) => t.budget_line_id === b.id && t.status !== "draft"));
      const persen = b.planned_amount > 0 ? (realisasi / Number(b.planned_amount)) * 100 : 0;
      return { ...b, realisasi, persen };
    })
    .sort((a, b) => b.persen - a.persen)
    .slice(0, 6);

  return (
    <AppShell
      title="Dashboard"
      subtitle={`Ringkasan keuangan per ${tanggal(today)}`}
      actions={
        pending.length > 0 ? (
          <Badge variant="outline" className="border-warning text-warning-foreground">
            {pending.length} pengeluaran menunggu approval
          </Badge>
        ) : null
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Saldo Kas" value={rupiah(saldo)} icon={Landmark} />
        <StatCard
          label="Kas Masuk Hari Ini"
          value={rupiah(masukHariIni)}
          icon={ArrowDownCircle}
          tone="in"
        />
        <StatCard
          label="Kas Keluar Hari Ini"
          value={rupiah(keluarHariIni)}
          icon={ArrowUpCircle}
          tone="out"
        />
        <StatCard
          label="Total Kas Bulan Ini"
          value={rupiah(totalBulan)}
          hint="Penerimaan dikurangi pengeluaran disetujui"
          icon={CalendarRange}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-base font-semibold">Grafik Pendapatan</h2>
          <p className="text-xs text-muted-foreground">Penerimaan per bulan tahun berjalan</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="grad-in" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="bulan" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickFormatter={(v) => rupiahShort(Number(v))}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={70}
                />
                <Tooltip formatter={(v) => rupiah(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="pendapatan"
                  stroke="var(--color-chart-3)"
                  fill="url(#grad-in)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-base font-semibold">Grafik Pengeluaran</h2>
          <p className="text-xs text-muted-foreground">Pengeluaran disetujui per bulan</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="bulan" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickFormatter={(v) => rupiahShort(Number(v))}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={70}
                />
                <Tooltip formatter={(v) => rupiah(Number(v))} />
                <Bar dataKey="pengeluaran" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="panel mt-5 p-5">
        <h2 className="text-base font-semibold">Anggaran vs Realisasi</h2>
        <p className="text-xs text-muted-foreground">Enam mata anggaran dengan serapan tertinggi</p>
        <div className="mt-5 space-y-4">
          {serapan.map((b) => (
            <div key={b.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">
                  <span className="text-muted-foreground">{b.code}</span> · {b.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {rupiah(b.realisasi)} dari {rupiah(b.planned_amount)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Progress value={Math.min(b.persen, 100)} className="h-2" />
                <span className="w-12 text-right text-xs font-medium">{b.persen.toFixed(0)}%</span>
              </div>
            </div>
          ))}
          {serapan.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada mata anggaran.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}