import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, LayoutGrid, Table as TableIcon, FileDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BudgetLineDialog } from "@/components/BudgetLineDialog";
import { HapusBudgetLineDialog } from "@/components/HapusBudgetLineDialog";
import { ImportAnggaranDialog } from "@/components/ImportAnggaranDialog";
import { budgetLinesQuery, transactionsQuery, isInternalCash } from "@/lib/queries";
import { rupiah } from "@/lib/format";
import { exportAoa, type Cell } from "@/lib/xlsx";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/anggaran")({
  head: () => ({
    meta: [
      { title: "Mata Anggaran — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content: "Daftar kode mata anggaran gereja 5 kolom beserta pagu, realisasi, dan persentase serapan.",
      },
      { property: "og:title", content: "Mata Anggaran — BUMOTIK FINANCIAL" },
      { property: "og:description", content: "Pagu dan realisasi setiap kode mata anggaran format 5 kolom." },
    ],
  }),
  component: AnggaranPage,
});

function AnggaranPage() {
  const budgets = useQuery(budgetLinesQuery);
  const trx = useQuery(transactionsQuery);
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const rows = (trx.data ?? []).filter(
    (t) => t.status !== "rejected" && t.status !== "draft" && !isInternalCash(t),
  );

  const list = useMemo(() => {
    return (budgets.data ?? []).map((b) => {
      const realisasi = rows
        .filter((t) => t.budget_line_id === b.id)
        .reduce((a, t) => a + Number(t.amount), 0);
      const persen = Number(b.planned_amount) > 0 ? (realisasi / Number(b.planned_amount)) * 100 : 0;
      return { ...b, realisasi, persen };
    });
  }, [budgets.data, rows]);

  const filteredList = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return list;
    return list.filter(
      (b) =>
        b.code.toLowerCase().includes(keyword) ||
        b.name.toLowerCase().includes(keyword) ||
        (b.grup || "").toLowerCase().includes(keyword) ||
        b.kind.toLowerCase().includes(keyword),
    );
  }, [list, q]);

  const kinds = [
    { kind: "penerimaan" as const, title: "Mata Anggaran Penerimaan (Pendapatan)" },
    { kind: "pengeluaran" as const, title: "Mata Anggaran Pengeluaran (Belanja)" },
  ];

  const grupsOf = (kind: "penerimaan" | "pengeluaran") => {
    const map = new Map<string, typeof list>();
    for (const b of filteredList.filter((x) => x.kind === kind)) {
      const key = b.grup || "Tanpa Grup";
      map.set(key, [...(map.get(key) ?? []), b]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };

  const totalPenerimaan = list
    .filter((b) => b.kind === "penerimaan")
    .reduce((a, b) => a + Number(b.planned_amount), 0);
  const totalPengeluaran = list
    .filter((b) => b.kind === "pengeluaran")
    .reduce((a, b) => a + Number(b.planned_amount), 0);

  function exportExcelMataAnggaran() {
    const dataBelanja: Cell[][] = [
      ["Mata Anggaran", "Nama Mata Anggaran", "Target 2026", "Kategori", "Jenis Mata Anggaran"],
      ...list
        .filter((b) => b.kind === "pengeluaran")
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((b) => [b.code, b.name, Number(b.planned_amount), b.grup || "", "Pengeluaran"]),
    ];

    exportAoa(dataBelanja, "Mata-Anggaran-BUMOTIK.xlsx", "RAB BELANJA", [16, 50, 20, 40, 20]);
  }

  return (
    <AppShell
      title="Mata Anggaran"
      subtitle={`Tahun anggaran ${new Date().getFullYear()} · ${list.length} kode anggaran · Pagu Penerimaan: ${rupiah(totalPenerimaan)} · Pagu Pengeluaran: ${rupiah(totalPengeluaran)}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportExcelMataAnggaran}>
            <FileDown className="mr-1.5 size-4" /> Export Excel
          </Button>
          <BudgetLineDialog />
          <ImportAnggaranDialog />
        </div>
      }
    >
      <div className="panel mb-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari kode, nama mata anggaran, atau kategori grup…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/20">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs"
              onClick={() => setViewMode("table")}
            >
              <TableIcon className="size-3.5" /> Tabel 5 Kolom
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="size-3.5" /> Kartu Progress
            </Button>
          </div>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="space-y-6">
          {kinds.map((g) => {
            const items = filteredList
              .filter((b) => b.kind === g.kind)
              .sort((a, b) => a.code.localeCompare(b.code));
            const totalPagu = items.reduce((a, b) => a + Number(b.planned_amount), 0);
            const totalReal = items.reduce((a, b) => a + b.realisasi, 0);

            return (
              <div key={g.kind} className="panel p-5 overflow-x-auto warta-area">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-4">
                  <div>
                    <h2 className="text-base font-bold uppercase tracking-wide">{g.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {items.length} kode mata anggaran terdaftar
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs font-semibold">
                      Total Pagu: {rupiah(totalPagu)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs font-semibold">
                      Total Realisasi: {rupiah(totalReal)}
                    </Badge>
                  </div>
                </div>

                <Table className="warta-table w-full">
                  <TableHeader>
                    <TableRow className="bg-muted/50 font-bold">
                      <TableHead className="w-36 font-bold">Mata Anggaran</TableHead>
                      <TableHead className="font-bold">Mata Anggaran / URAIAN</TableHead>
                      <TableHead className="w-48 text-right font-bold">Penetapan Anggaran</TableHead>
                      <TableHead className="w-56 font-bold">Kategori / Grup</TableHead>
                      <TableHead className="w-44 text-center font-bold">Jenis &amp; Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((b) => (
                      <TableRow key={b.id} className="hover:bg-muted/10">
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          {b.code}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {b.name}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">
                          {rupiah(b.planned_amount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">
                          {b.grup || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Badge
                              variant={b.kind === "penerimaan" ? "default" : "secondary"}
                              className="text-[10px] capitalize"
                            >
                              {b.kind === "penerimaan" ? "Pendapatan" : "Belanja"}
                            </Badge>
                            <BudgetLineDialog budget={b} />
                            <HapusBudgetLineDialog budget={b} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          Tidak ada kode mata anggaran yang sesuai.
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow className="bg-muted/40 font-bold border-t-2">
                      <TableCell colSpan={2} className="text-center font-bold">
                        TOTAL {g.title.toUpperCase()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold">
                        {rupiah(totalPagu)}
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {kinds.map((g) => {
            const grups = grupsOf(g.kind);
            const totalKind = filteredList
              .filter((b) => b.kind === g.kind)
              .reduce((a, b) => a + Number(b.planned_amount), 0);
            const realKind = filteredList
              .filter((b) => b.kind === g.kind)
              .reduce((a, b) => a + b.realisasi, 0);

            return (
              <section key={g.kind} className="panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h2 className="text-base font-semibold">{g.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {filteredList.filter((b) => b.kind === g.kind).length} kode terdaftar
                    </p>
                  </div>
                  <Badge variant="outline" className="font-normal text-xs">
                    Realisasi {rupiah(realKind)} / {rupiah(totalKind)}
                  </Badge>
                </div>

                <div className="mt-5 space-y-7 max-h-[1200px] overflow-y-auto pr-1">
                  {grups.map(([grup, items]) => {
                    const pagu = items.reduce((a, b) => a + Number(b.planned_amount), 0);
                    const real = items.reduce((a, b) => a + b.realisasi, 0);
                    return (
                      <div key={grup} className="space-y-3 rounded-lg border bg-muted/15 p-3.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                            {grup}
                          </h3>
                          <p className="text-[11px] text-muted-foreground">
                            {rupiah(real)} / {rupiah(pagu)} · {items.length} kode
                          </p>
                        </div>

                        <div className="space-y-3 pt-1">
                          {items.map((b) => (
                            <div
                              key={b.id}
                              className="rounded-md border bg-card p-3 shadow-xs transition-colors hover:border-primary/40"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-primary">
                                      {b.code}
                                    </span>
                                    <p className="text-sm font-medium leading-tight text-foreground truncate">
                                      {b.name}
                                    </p>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Realisasi {rupiah(b.realisasi)} dari pagu {rupiah(b.planned_amount)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge
                                    variant={b.persen >= 100 ? "default" : "secondary"}
                                    className="shrink-0 text-[10px]"
                                  >
                                    {b.persen.toFixed(0)}%
                                  </Badge>
                                  <BudgetLineDialog budget={b} />
                                  <HapusBudgetLineDialog budget={b} />
                                </div>
                              </div>
                              <Progress value={Math.min(b.persen, 100)} className="mt-2.5 h-1.5" />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}