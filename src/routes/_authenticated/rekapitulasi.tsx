import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { budgetLinesQuery, transactionsQuery, isInternalCash } from "@/lib/queries";
import { rupiah } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/rekapitulasi")({
  head: () => ({
    meta: [
      { title: "Rekapitulasi Grup Anggaran — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Rekapitulasi keuangan gereja per grup mata anggaran: pagu, realisasi, sisa, dan persentase serapan.",
      },
      { property: "og:title", content: "Rekapitulasi Grup Anggaran — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Ringkasan pagu vs realisasi setiap grup mata anggaran penerimaan dan pengeluaran.",
      },
    ],
  }),
  component: RekapitulasiPage,
});

type Row = {
  grup: string;
  pagu: number;
  realisasi: number;
  sisa: number;
  persen: number;
  kode: number;
  trx: number;
};

function RekapitulasiPage() {
  const budgets = useQuery(budgetLinesQuery);
  const trx = useQuery(transactionsQuery);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const data = useMemo(() => {
    const lines = budgets.data ?? [];
    const rows = (trx.data ?? []).filter(
      (t) =>
        t.status !== "rejected" &&
        t.status !== "draft" &&
        !isInternalCash(t) &&
        (!start || t.trx_date >= start) &&
        (!end || t.trx_date <= end),
    );

    const realByLine = new Map<string, { amount: number; count: number }>();
    for (const t of rows) {
      const cur = realByLine.get(t.budget_line_id) ?? { amount: 0, count: 0 };
      cur.amount += Number(t.amount);
      cur.count += 1;
      realByLine.set(t.budget_line_id, cur);
    }

    const build = (kind: "penerimaan" | "pengeluaran"): Row[] => {
      const map = new Map<string, Row>();
      for (const b of lines.filter((l) => l.kind === kind)) {
        const key = b.grup || "Tanpa Grup";
        const r =
          map.get(key) ??
          { grup: key, pagu: 0, realisasi: 0, sisa: 0, persen: 0, kode: 0, trx: 0 };
        const hit = realByLine.get(b.id);
        r.pagu += Number(b.planned_amount);
        r.realisasi += hit?.amount ?? 0;
        r.trx += hit?.count ?? 0;
        r.kode += 1;
        map.set(key, r);
      }
      return [...map.values()]
        .map((r) => ({
          ...r,
          sisa: r.pagu - r.realisasi,
          persen: r.pagu > 0 ? (r.realisasi / r.pagu) * 100 : 0,
        }))
        .sort((a, b) => b.realisasi - a.realisasi);
    };

    return { penerimaan: build("penerimaan"), pengeluaran: build("pengeluaran") };
  }, [budgets.data, trx.data, start, end]);

  return (
    <AppShell
      title="Rekapitulasi"
      subtitle="Ringkasan pagu dan realisasi berdasarkan grup mata anggaran"
    >
      <div className="panel mb-5 flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="start">Dari tanggal</Label>
          <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end">Sampai tanggal</Label>
          <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        {(start || end) && (
          <button
            type="button"
            className="text-sm text-muted-foreground underline"
            onClick={() => {
              setStart("");
              setEnd("");
            }}
          >
            Reset periode
          </button>
        )}
      </div>

      <Tabs defaultValue="pengeluaran">
        <TabsList>
          <TabsTrigger value="pengeluaran">Pengeluaran</TabsTrigger>
          <TabsTrigger value="penerimaan">Penerimaan</TabsTrigger>
        </TabsList>
        {(["pengeluaran", "penerimaan"] as const).map((kind) => (
          <TabsContent key={kind} value={kind} className="space-y-5">
            <GroupSection rows={data[kind]} kind={kind} />
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}

function GroupSection({ rows, kind }: { rows: Row[]; kind: "penerimaan" | "pengeluaran" }) {
  const pagu = rows.reduce((a, r) => a + r.pagu, 0);
  const real = rows.reduce((a, r) => a + r.realisasi, 0);
  const persen = pagu > 0 ? (real / pagu) * 100 : 0;
  const chart = rows.slice(0, 12).map((r) => ({
    name: r.grup.length > 24 ? `${r.grup.slice(0, 24)}…` : r.grup,
    realisasi: r.realisasi,
    pagu: r.pagu,
  }));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total Pagu" value={rupiah(pagu)} />
        <Stat
          label={kind === "penerimaan" ? "Total Realisasi Penerimaan" : "Total Realisasi Belanja"}
          value={rupiah(real)}
        />
        <Stat label="Serapan" value={`${persen.toFixed(1)}%`} hint={`Sisa ${rupiah(pagu - real)}`} />
      </div>

      <section className="panel p-5">
        <h2 className="text-base font-semibold">Realisasi per Grup (12 terbesar)</h2>
        <div className="mt-4 h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} layout="vertical" margin={{ left: 12, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
              <XAxis type="number" tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)}jt`} fontSize={11} />
              <YAxis type="category" dataKey="name" width={170} fontSize={11} />
              <Tooltip
                formatter={(v: number | string) => rupiah(Number(v))}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="realisasi" radius={[0, 4, 4, 0]}>
                {chart.map((_, i) => (
                  <Cell
                    key={i}
                    className={kind === "penerimaan" ? "fill-primary" : "fill-destructive"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-base font-semibold">Rincian Grup Mata Anggaran</h2>
        <div className="mt-4 space-y-5">
          {rows.map((r) => (
            <div key={r.grup}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide">{r.grup}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.kode} kode · {r.trx} transaksi
                  </p>
                </div>
                <Badge variant={r.persen > 100 ? "destructive" : "secondary"}>
                  {r.persen.toFixed(0)}%
                </Badge>
              </div>
              <Progress value={Math.min(r.persen, 100)} className="mt-2.5 h-2" />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Realisasi {rupiah(r.realisasi)} dari pagu {rupiah(r.pagu)} · sisa {rupiah(r.sisa)}
              </p>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada data pada periode ini.</p>
          )}
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}