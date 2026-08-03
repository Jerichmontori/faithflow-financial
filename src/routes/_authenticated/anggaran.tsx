import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { budgetLinesQuery, transactionsQuery } from "@/lib/queries";
import { rupiah } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/anggaran")({
  head: () => ({
    meta: [
      { title: "Mata Anggaran — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content: "Daftar kode mata anggaran gereja beserta pagu, realisasi, dan persentase serapan.",
      },
      { property: "og:title", content: "Mata Anggaran — BUMOTIK FINANCIAL" },
      { property: "og:description", content: "Pagu dan realisasi setiap kode mata anggaran." },
    ],
  }),
  component: AnggaranPage,
});

function AnggaranPage() {
  const budgets = useQuery(budgetLinesQuery);
  const trx = useQuery(transactionsQuery);
  const rows = (trx.data ?? []).filter((t) => t.status !== "rejected" && t.status !== "draft");

  const list = (budgets.data ?? []).map((b) => {
    const realisasi = rows
      .filter((t) => t.budget_line_id === b.id)
      .reduce((a, t) => a + Number(t.amount), 0);
    const persen = Number(b.planned_amount) > 0 ? (realisasi / Number(b.planned_amount)) * 100 : 0;
    return { ...b, realisasi, persen };
  });

  const groups = [
    { kind: "penerimaan" as const, title: "Mata Anggaran Penerimaan" },
    { kind: "pengeluaran" as const, title: "Mata Anggaran Pengeluaran" },
  ];

  return (
    <AppShell
      title="Mata Anggaran"
      subtitle={`Tahun anggaran ${new Date().getFullYear()} · ${list.length} kode anggaran`}
    >
      <div className="grid gap-5 xl:grid-cols-2">
        {groups.map((g) => (
          <section key={g.kind} className="panel p-5">
            <h2 className="text-base font-semibold">{g.title}</h2>
            <div className="mt-5 space-y-5">
              {list
                .filter((b) => b.kind === g.kind)
                .map((b) => (
                  <div key={b.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{b.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{b.code}</p>
                      </div>
                      <Badge variant={b.persen > 100 ? "destructive" : "secondary"}>
                        {b.persen.toFixed(0)}% terpakai
                      </Badge>
                    </div>
                    <Progress value={Math.min(b.persen, 100)} className="mt-2.5 h-2" />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Realisasi {rupiah(b.realisasi)} dari pagu {rupiah(b.planned_amount)}
                    </p>
                  </div>
                ))}
              {list.filter((b) => b.kind === g.kind).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {budgets.isLoading ? "Memuat…" : "Belum ada mata anggaran."}
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}