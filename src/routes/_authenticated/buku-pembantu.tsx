import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, X, FileDown, Printer, BookOpen } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { budgetLinesQuery, transactionsQuery, isInternalCash, isReklas } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { parseKolom, labelKolom } from "@/lib/kolom";
import { exportAoa, type Cell } from "@/lib/xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { cn } from "@/lib/utils";

import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/buku-pembantu")({
  head: () => ({
    meta: [
      { title: "Buku Pembantu & Laporan Transaksi — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Telusuri rincian transaksi kas gereja dengan format transaksi Debit/Kredit, mata anggaran, periode, dan kata kunci.",
      },
      { property: "og:title", content: "Buku Pembantu & Laporan Transaksi — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Rincian mutasi kas Debit (Pemasukan) dan Kredit (Pengeluaran) lengkap dengan saldo berjalan.",
      },
    ],
  }),
  component: BukuPembantuPage,
});

function BukuPembantuPage() {
  const trx = useQuery(transactionsQuery);
  const budgets = useQuery(budgetLinesQuery);
  const { isReadOnly } = useSession();

  const [budgetId, setBudgetId] = useState<string>("semua");
  const [kolom, setKolom] = useState<string>("semua");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [q, setQ] = useState("");
  const [openBudget, setOpenBudget] = useState(false);
  const [tampilkanSemua, setTampilkanSemua] = useState(false);

  const budgetOptions = useMemo(
    () => (budgets.data ?? []).slice().sort((a, b) => a.code.localeCompare(b.code)),
    [budgets.data],
  );
  const selectedBudget = budgetOptions.find((b) => b.id === budgetId);

  const kolomOptions = useMemo(() => {
    const set = new Set<number>();
    let adaTanpa = false;
    for (const t of trx.data ?? []) {
      const k = parseKolom(t.description);
      if (k === null) adaTanpa = true;
      else set.add(k);
    }
    return {
      list: [...set].sort((a, b) => a - b),
      adaTanpa,
    };
  }, [trx.data]);

  const adaFilter =
    budgetId !== "semua" ||
    kolom !== "semua" ||
    dari !== "" ||
    sampai !== "" ||
    q.trim() !== "";

  // Tampilkan rincian hanya jika ada filter atau pengguna meminta menampilkan
  const harusTampilkan = adaFilter || tampilkanSemua;

  const allFilteredRows = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return (trx.data ?? [])
      .filter((t) => t.status !== "rejected")
      .filter((t) => budgetId === "semua" || t.budget_line_id === budgetId)
      .filter((t) => {
        if (kolom === "semua") return true;
        const k = parseKolom(t.description);
        return kolom === "tanpa" ? k === null : k === Number(kolom);
      })
      .filter((t) => (dari ? t.trx_date >= dari : true))
      .filter((t) => (sampai ? t.trx_date <= sampai : true))
      .filter((t) =>
        keyword
          ? [
              t.voucher_no,
              t.description,
              t.category,
              t.payee ?? "",
              t.budget_lines?.code ?? "",
              t.budget_lines?.name ?? "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(keyword)
          : true,
      )
      .slice()
      .sort((a, b) =>
        a.trx_date === b.trx_date
          ? a.created_at.localeCompare(b.created_at)
          : a.trx_date.localeCompare(b.trx_date),
      );
  }, [trx.data, budgetId, kolom, dari, sampai, q]);

  const rows = harusTampilkan ? allFilteredRows : [];

  const totalMasuk = rows
    .filter((t) => t.kind === "penerimaan")
    .reduce((a, t) => a + Number(t.amount), 0);
  const totalKeluar = rows
    .filter((t) => t.kind === "pengeluaran")
    .reduce((a, t) => a + Number(t.amount), 0);

  let running = 0;
  const withSaldo = rows.map((t, i) => {
    const nilai = Number(t.amount);
    running += t.kind === "penerimaan" ? nilai : -nilai;
    return {
      t,
      no: i + 1,
      debit: t.kind === "penerimaan" ? nilai : 0,
      kredit: t.kind === "pengeluaran" ? nilai : 0,
      saldo: running,
    };
  });

  function reset() {
    setBudgetId("semua");
    setKolom("semua");
    setDari("");
    setSampai("");
    setQ("");
    setTampilkanSemua(false);
  }

  function exportExcel() {
    if (withSaldo.length === 0) return;
    const data: Cell[][] = [
      ["NO", "Tanggal", "Mata Anggaran", "Nama Mata Anggaran", "Keterangan ", "Debit", "Kredit"],
      ...withSaldo.map((b) => [
        b.no,
        b.t.trx_date,
        b.t.budget_lines?.code ?? (isReklas(b.t) ? "REKLAS" : isInternalCash(b.t) ? "KAS/BANK" : ""),
        b.t.budget_lines?.name ??
          (isReklas(b.t)
            ? "Pengembalian / Reklas"
            : isInternalCash(b.t)
              ? "Mutasi Kas Bank"
              : b.t.category || "Lain-lain"),
        b.t.koreksi_catatan
          ? `${b.t.description || b.t.payee || ""} [${b.t.koreksi_catatan}]`
          : b.t.description || b.t.payee || "",
        b.debit || "",
        b.kredit || "",
      ]),
      ["TOTAL", "", "", "", "", totalMasuk, totalKeluar],
    ];

    exportAoa(
      data,
      `Laporan-Transaksi-${dari || "awal"}-sd-${sampai || "akhir"}.xlsx`,
      "Transaksi",
      [8, 14, 18, 40, 48, 18, 18],
    );
  }

  const totalTransaksiTersedia = (trx.data ?? []).filter((t) => t.status !== "rejected").length;

  return (
    <AppShell
      title="Buku Pembantu / Laporan Transaksi"
      subtitle={
        harusTampilkan
          ? `${rows.length} transaksi ditampilkan · Debit ${rupiah(totalMasuk)} · Kredit ${rupiah(totalKeluar)}`
          : `Pilih filter untuk menampilkan rincian transaksi (Tersedia ${totalTransaksiTersedia} transaksi)`
      }
      actions={
        <div className="no-print flex flex-wrap gap-2">
          {!isReadOnly && harusTampilkan && rows.length > 0 && (
            <>
              <Button variant="outline" onClick={exportExcel}>
                <FileDown className="mr-2 size-4" /> Export Excel (Transaksi)
              </Button>
              <Button onClick={() => window.print()}>
                <Printer className="mr-2 size-4" /> Cetak
              </Button>
            </>
          )}
          {adaFilter && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="mr-1.5 size-4" /> Reset filter
            </Button>
          )}
        </div>
      }
    >
      <section className="panel p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Mata Anggaran</Label>
            <Popover open={openBudget} onOpenChange={setOpenBudget}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openBudget}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedBudget
                      ? `${selectedBudget.code} — ${selectedBudget.name}`
                      : "Semua Mata Anggaran"}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                  filter={(value, search) =>
                    value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                  }
                >
                  <CommandInput placeholder="Cari kode atau nama…" />
                  <CommandList>
                    <CommandEmpty>Mata anggaran tidak ditemukan.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="semua mata anggaran"
                        onSelect={() => {
                          setBudgetId("semua");
                          setOpenBudget(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "size-4",
                            budgetId === "semua" ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Semua Mata Anggaran
                      </CommandItem>
                      {budgetOptions.map((b) => (
                        <CommandItem
                          key={b.id}
                          value={`${b.code} ${b.name}`}
                          onSelect={() => {
                            setBudgetId(b.id);
                            setOpenBudget(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "size-4",
                              budgetId === b.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="font-mono text-xs text-muted-foreground">{b.code}</span>
                          <span className="truncate">{b.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Kolom</Label>
            <Select value={kolom} onValueChange={setKolom}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="semua">Semua Kolom</SelectItem>
                {kolomOptions.list.map((k) => (
                  <SelectItem key={k} value={String(k)}>
                    {labelKolom(k)}
                  </SelectItem>
                ))}
                {kolomOptions.adaTanpa && <SelectItem value="tanpa">Tanpa Kolom</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dari">Dari Tanggal</Label>
            <DateInput id="dari" value={dari} onChange={setDari} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sampai">Sampai Tanggal</Label>
            <DateInput id="sampai" value={sampai} onChange={setSampai} />
          </div>
          <div className="space-y-1.5 md:col-span-2 xl:col-span-4">
            <Label htmlFor="q">Kata Kunci Pencarian</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari no. bukti (KM/KK), kode pos, keterangan transaksi, penerima…"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {adaFilter ? (
              <Badge variant="default" className="text-[11px]">
                Filter Aktif ({rows.length} transaksi cocok)
              </Badge>
            ) : harusTampilkan ? (
              <Badge variant="secondary" className="text-[11px]">
                Menampilkan Semua Transaksi ({rows.length})
              </Badge>
            ) : (
              <span className="italic text-muted-foreground">
                Tampilan awal kosong. Pilih filter di atas atau klik tombol tampilkan.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!harusTampilkan ? (
              <Button
                size="sm"
                onClick={() => setTampilkanSemua(true)}
                className="gap-1.5"
              >
                <BookOpen className="size-4" /> Tampilkan Rincian Transaksi ({totalTransaksiTersedia})
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                className="gap-1.5"
              >
                <X className="size-4" /> Kosongkan / Sembunyikan Rincian
              </Button>
            )}
          </div>
        </div>
      </section>

      {selectedBudget && harusTampilkan && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pagu Anggaran</p>
            <p className="mt-1.5 text-lg font-semibold">{rupiah(selectedBudget.planned_amount)}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Realisasi</p>
            <p className="mt-1.5 text-lg font-semibold">{rupiah(totalMasuk + totalKeluar)}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Sisa Pagu</p>
            <p className="mt-1.5 text-lg font-semibold">
              {rupiah(Number(selectedBudget.planned_amount) - (totalMasuk + totalKeluar))}
            </p>
          </div>
        </div>
      )}

      <div className="panel mt-4 overflow-x-auto warta-area p-4">
        <Table className="warta-table w-full">
          <TableHeader>
            <TableRow className="bg-muted/40 font-bold">
              <TableHead className="w-12 text-center">NO</TableHead>
              <TableHead className="w-28">Tanggal</TableHead>
              <TableHead className="w-28">Mata Anggaran</TableHead>
              <TableHead>Nama Mata Anggaran</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="text-right w-36">Debit (Pemasukan)</TableHead>
              <TableHead className="text-right w-36">Kredit (Pengeluaran)</TableHead>
              <TableHead className="text-right w-36">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {harusTampilkan ? (
              <>
                {withSaldo.map(({ t, no, debit, kredit, saldo }) => (
                  <TableRow key={t.id} className="hover:bg-muted/10">
                    <TableCell className="text-center font-mono text-xs">{no}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{tanggal(t.trx_date)}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-primary">
                      {t.budget_lines?.code ??
                        (isReklas(t) ? "REKLAS" : isInternalCash(t) ? "KAS/BANK" : "-")}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {t.budget_lines?.name ??
                        (isReklas(t)
                          ? "Pengembalian / Reklas"
                          : isInternalCash(t)
                            ? "Mutasi Kas Bank"
                            : t.category || "-")}
                    </TableCell>
                    <TableCell className="text-xs max-w-72 truncate">
                      {t.description || t.payee || "-"}
                      {t.koreksi_catatan && (
                        <span className="ml-1 text-[11px] italic text-muted-foreground">
                          [{t.koreksi_catatan}]
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-xs font-mono text-success">
                      {debit ? rupiah(debit) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-xs font-mono text-destructive">
                      {kredit ? rupiah(kredit) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {rupiah(saldo)}
                    </TableCell>
                  </TableRow>
                ))}
                {withSaldo.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      {trx.isLoading ? "Memuat data…" : "Tidak ada transaksi yang sesuai dengan kriteria filter."}
                    </TableCell>
                  </TableRow>
                )}
                {withSaldo.length > 0 && (
                  <TableRow className="bg-muted/40 font-bold border-t-2">
                    <TableCell colSpan={5} className="text-center font-bold">
                      TOTAL
                    </TableCell>
                    <TableCell className="text-right text-success font-bold font-mono">
                      {rupiah(totalMasuk)}
                    </TableCell>
                    <TableCell className="text-right text-destructive font-bold font-mono">
                      {rupiah(totalKeluar)}
                    </TableCell>
                    <TableCell className="text-right text-primary font-bold font-mono">
                      {rupiah(running)}
                    </TableCell>
                  </TableRow>
                )}
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-14 text-center">
                  <div className="mx-auto flex max-w-md flex-col items-center justify-center text-center space-y-2">
                    <div className="rounded-full bg-primary/10 p-3 text-primary">
                      <Search className="size-6" />
                    </div>
                    <p className="font-semibold text-foreground text-sm">
                      Rincian Buku Pembantu Siap Ditampilkan
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Silakan pilih Mata Anggaran, Kolom, rentang Tanggal, masukkan Kata Kunci di atas, atau klik tombol di bawah untuk menampilkan rincian data transaksi.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setTampilkanSemua(true)}
                      className="mt-2 gap-1.5"
                    >
                      <BookOpen className="size-4" /> Tampilkan Semua Transaksi ({totalTransaksiTersedia})
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
