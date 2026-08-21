import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownCircle, ArrowUpCircle, Landmark, CalendarRange, Info, Calendar } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { budgetLinesQuery, transactionsQuery, isInternalCash, isCashPayment } from "@/lib/queries";
import { rupiah, rupiahShort, namaBulan, tanggal } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DateInput, normalizeDateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Keuangan — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content: "Pantau saldo kas minggu berjalan, kas masuk/keluar harian, dan realisasi anggaran gereja.",
      },
      { property: "og:title", content: "Dashboard Keuangan — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Ringkasan kas minggu berjalan dan realisasi anggaran gereja secara realtime.",
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
      {hint && <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{hint}</p>}
    </div>
  );
}

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const plusDays = (isoStr: string, n: number) => {
  if (!isoStr) return "";
  const d = new Date(`${isoStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};

const getDefaultWartaCutoff = () => {
  const saved = typeof window !== "undefined" ? localStorage.getItem("bumotik.tglTerakhirWarta") : null;
  if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved;
  // Default: 2026-08-14 (tanggal penutupan warta jemaat terakhir)
  return "2026-08-14";
};

function DashboardPage() {
  const trx = useQuery(transactionsQuery);
  const budgets = useQuery(budgetLinesQuery);

  const [tglTerakhirWarta, setTglTerakhirWarta] = useState(getDefaultWartaCutoff);

  useEffect(() => {
    if (tglTerakhirWarta) {
      localStorage.setItem("bumotik.tglTerakhirWarta", tglTerakhirWarta);
    }
  }, [tglTerakhirWarta]);

  const rows = (trx.data ?? []).filter((t) => t.status !== "rejected" && !isInternalCash(t));
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  // Tanggal mulai kas fisik minggu berjalan = 1 hari setelah penutupan warta terakhir (misal: 15 Agustus)
  const tglMulaiKasBerjalan = useMemo(
    () => plusDays(normalizeDateInput(tglTerakhirWarta), 1) || "2026-08-15",
    [tglTerakhirWarta],
  );

  const sum = (list: typeof rows) => list.reduce((a, t) => a + Number(t.amount), 0);
  const masuk = rows.filter((t) => t.kind === "penerimaan");
  const keluar = rows.filter((t) => t.kind === "pengeluaran" && t.status === "approved");

  // SALDO KAS FISIK MINGGU BERJALAN:
  // Hanya transaksi KAS FISIK (Tunai) — Pengeluaran Bank tidak mengurangi kas fisik
  const masukMingguBerjalan = sum(
    masuk.filter((t) => isCashPayment(t) && t.trx_date >= tglMulaiKasBerjalan && t.trx_date <= today),
  );
  const keluarMingguBerjalan = sum(
    keluar.filter((t) => isCashPayment(t) && t.trx_date >= tglMulaiKasBerjalan && t.trx_date <= today),
  );
  const saldoKasFisikBerjalan = masukMingguBerjalan - keluarMingguBerjalan;

  const masukHariIni = sum(masuk.filter((t) => isCashPayment(t) && t.trx_date === today));
  const keluarHariIni = sum(keluar.filter((t) => isCashPayment(t) && t.trx_date === today));

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

  const IBADAH = [
    { code: "1.3.50.01", label: "Ibadah Subuh", color: "var(--color-chart-1)" },
    { code: "1.3.50.02", label: "Ibadah Pagi", color: "var(--color-chart-3)" },
    { code: "1.3.50.04", label: "Ibadah Malam", color: "var(--color-chart-4)" },
  ];
  const idByCode = new Map(
    (budgets.data ?? []).map((b) => [b.code, b.id] as const),
  );
  const ibadahChart = Array.from({ length: 12 }, (_, i) => {
    const row: Record<string, string | number> = { bulan: namaBulan(i) };
    for (const item of IBADAH) {
      const id = idByCode.get(item.code);
      row[item.label] = sum(
        masuk.filter((t) => t.budget_line_id === id && new Date(t.trx_date).getMonth() === i),
      );
    }
    return row;
  });
  const ibadahTotal = IBADAH.map((item) => ({
    ...item,
    total: ibadahChart.reduce((a, r) => a + Number(r[item.label] ?? 0), 0),
  }));

  return (
    <AppShell
      title="Dashboard Keuangan"
      subtitle={`Posisi keuangan kas fisik minggu berjalan per ${tanggal(today)}`}
      actions={
        pending.length > 0 ? (
          <Badge variant="outline" className="border-warning text-warning-foreground">
            {pending.length} pengeluaran menunggu approval
          </Badge>
        ) : null
      }
    >
      {/* Pengaturan Tanggal Warta Terakhir */}
      <div className="panel mb-4 p-3 bg-muted/20 border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="size-4 text-primary shrink-0" />
          <div>
            <span className="font-semibold text-foreground">Penetapan Warta Jemaat Terakhir: </span>
            <span className="text-muted-foreground">
              Kas fisik dihitung dari <strong>{tanggal(tglMulaiKasBerjalan)}</strong> sampai hari ini ({tanggal(today)}).
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="tglWarta" className="text-xs text-muted-foreground whitespace-nowrap">
            Tgl Warta Terakhir:
          </Label>
          <div className="w-36">
            <DateInput
              id="tglWarta"
              value={tglTerakhirWarta}
              onChange={setTglTerakhirWarta}
              placeholder="YYYY-MM-DD"
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Saldo Kas Minggu Berjalan"
          value={rupiah(saldoKasFisikBerjalan)}
          icon={Landmark}
        />
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
                <Bar
                  dataKey="pengeluaran"
                  fill="var(--color-destructive)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-base font-semibold">Serapan Anggaran Tertinggi</h2>
          <p className="text-xs text-muted-foreground">Realisasi terhadap pagu anggaran</p>
          <div className="mt-4 space-y-4">
            {serapan.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate max-w-72">
                    {item.code} — {item.name}
                  </span>
                  <span className="font-mono font-semibold">{item.persen.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(item.persen, 100)} />
                <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                  <span>Realisasi: {rupiah(item.realisasi)}</span>
                  <span>Pagu: {rupiah(item.planned_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-base font-semibold">Persembahan Ibadah Utama</h2>
          <p className="text-xs text-muted-foreground">Subuh, Pagi, dan Malam per bulan</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ibadahChart}>
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
                <Legend />
                {IBADAH.map((item) => (
                  <Bar
                    key={item.code}
                    dataKey={item.label}
                    fill={item.color}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center">
            {ibadahTotal.map((item) => (
              <div key={item.code} className="space-y-0.5">
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="text-xs font-bold font-mono text-foreground">{rupiah(item.total)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}