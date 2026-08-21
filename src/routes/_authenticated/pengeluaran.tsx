import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useDeferredValue } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TransactionDialog } from "@/components/TransactionDialog";
import { KoreksiDialog } from "@/components/KoreksiDialog";
import { HapusTransaksiDialog } from "@/components/HapusTransaksiDialog";
import { ImportMassalDialog } from "@/components/ImportMassalDialog";
import { BackupDataDialog } from "@/components/BackupDataDialog";
import { ResetTransaksiDialog } from "@/components/ResetTransaksiDialog";
import { transactionsQuery, budgetLinesQuery, isBankPayment } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput, normalizeDateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
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
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/pengeluaran")({
  head: () => ({
    meta: [
      { title: "Transaksi Pengeluaran — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content: "Ajukan, pantau, dan setujui pengeluaran kas gereja sesuai mata anggaran.",
      },
      { property: "og:title", content: "Transaksi Pengeluaran — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Pengeluaran kas gereja lengkap dengan status approval.",
      },
    ],
  }),
  component: PengeluaranPage,
});

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending: "Menunggu Approval",
  approved: "Disetujui",
  rejected: "Ditolak",
};

const BULAN_OPTIONS = [
  { value: "all", label: "Semua Bulan" },
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

function isValidDate(d: string): boolean {
  if (!d) return false;
  const n = normalizeDateInput(d);
  return /^\d{4}-\d{2}-\d{2}$/.test(n) && !isNaN(Date.parse(n));
}

function PengeluaranPage() {
  const trx = useQuery(transactionsQuery);
  const budgets = useQuery(budgetLinesQuery);
  const { user, canApprove } = useSession();
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [tahun, setTahun] = useState("all");
  const [bulan, setBulan] = useState("all");
  const [budget, setBudget] = useState("all");
  const [openBudget, setOpenBudget] = useState(false);
  const [status, setStatus] = useState("all");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [showAll, setShowAll] = useState(false);
  const DEFAULT_LIMIT = 50;

  // Defer filter inputs to avoid blocking UI during keystrokes
  const deferredQ = useDeferredValue(q);
  const deferredTahun = useDeferredValue(tahun);
  const deferredBulan = useDeferredValue(bulan);
  const deferredBudget = useDeferredValue(budget);
  const deferredStatus = useDeferredValue(status);
  const deferredDari = useDeferredValue(dari);
  const deferredSampai = useDeferredValue(sampai);

  const budgetOptions = useMemo(
    () => (budgets.data ?? []).filter((b) => b.kind === "pengeluaran").sort((a, b) => a.code.localeCompare(b.code)),
    [budgets.data],
  );

  const selectedBudget = useMemo(
    () => budgetOptions.find((b) => b.id === budget),
    [budgetOptions, budget],
  );

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ status, approved_by: user!.id, approved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "approved" ? "Pengeluaran disetujui" : "Pengeluaran ditolak");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal memperbarui status"),
  });

  // Pre-sort transactions once
  const sortedPengeluaran = useMemo(() => {
    const list = (trx.data ?? []).filter((t) => t.kind === "pengeluaran");
    return list.sort((a, b) => {
      const cmpDate = b.trx_date.localeCompare(a.trx_date);
      if (cmpDate !== 0) return cmpDate;
      return (b.voucher_no || "").localeCompare(a.voucher_no || "");
    });
  }, [trx.data]);

  const allFilteredRows = useMemo(() => {
    const term = deferredQ.trim().toLowerCase();
    const validDari = isValidDate(deferredDari) ? normalizeDateInput(deferredDari) : "";
    const validSampai = isValidDate(deferredSampai) ? normalizeDateInput(deferredSampai) : "";

    return sortedPengeluaran.filter((t) => {
      if (deferredTahun !== "all") {
        if (!t.trx_date.startsWith(deferredTahun)) return false;
      }
      if (deferredBulan !== "all") {
        const monthPart = t.trx_date.slice(5, 7);
        if (monthPart !== deferredBulan) return false;
      }
      if (deferredBudget !== "all" && t.budget_line_id !== deferredBudget) return false;
      if (deferredStatus !== "all" && t.status !== deferredStatus) return false;
      if (validDari && t.trx_date < validDari) return false;
      if (validSampai && t.trx_date > validSampai) return false;
      if (
        term &&
        !`${t.description} ${t.payee ?? ""} ${t.voucher_no} ${t.budget_lines?.name ?? ""}`
          .toLowerCase()
          .includes(term)
      )
        return false;
      return true;
    });
  }, [
    sortedPengeluaran,
    deferredQ,
    deferredTahun,
    deferredBulan,
    deferredBudget,
    deferredStatus,
    deferredDari,
    deferredSampai,
  ]);

  const aktif =
    q !== "" ||
    tahun !== "all" ||
    bulan !== "all" ||
    budget !== "all" ||
    status !== "all" ||
    (dari !== "" && isValidDate(dari)) ||
    (sampai !== "" && isValidDate(sampai));

  const reset = () => {
    setQ("");
    setTahun("all");
    setBulan("all");
    setBudget("all");
    setStatus("all");
    setDari("");
    setSampai("");
    setShowAll(false);
  };

  // Hanya tampilkan transaksi terbaru secara default (50 transaksi), kecuali filter aktif atau memilih tampilkan semua
  const rows = useMemo(() => {
    if (aktif || showAll) return allFilteredRows;
    return allFilteredRows.slice(0, DEFAULT_LIMIT);
  }, [allFilteredRows, aktif, showAll]);

  const disetujui = allFilteredRows
    .filter((t) => t.status === "approved")
    .reduce((a, t) => a + Number(t.amount), 0);
  const menunggu = allFilteredRows.filter((t) => t.status === "pending").length;

  return (
    <AppShell
      title="Transaksi Pengeluaran"
      subtitle={`${allFilteredRows.length} transaksi · Total ${rupiah(disetujui)}${menunggu > 0 ? ` · ${menunggu} menunggu approval` : ""}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <TransactionDialog kind="pengeluaran" />
          <ImportMassalDialog kind="pengeluaran" />
          <BackupDataDialog kind="pengeluaran" />
          <ResetTransaksiDialog kind="pengeluaran" jumlah={allFilteredRows.length} />
        </div>
      }
    >
      <div className="panel mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1.5 xl:col-span-2">
            <Label htmlFor="cari">Filter Keterangan / Penerima</Label>
            <Input
              id="cari"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Keterangan, penerima, no bukti KK-2026-…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tahun</Label>
            <Select value={tahun} onValueChange={setTahun}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tahun</SelectItem>
                <SelectItem value="2026">Tahun 2026</SelectItem>
                <SelectItem value="2025">Tahun 2025</SelectItem>
                <SelectItem value="2024">Tahun 2024</SelectItem>
                <SelectItem value="2027">Tahun 2027</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Bulan</Label>
            <Select value={bulan} onValueChange={setBulan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {BULAN_OPTIONS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Status Approval</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="approved">Disetujui</SelectItem>
                <SelectItem value="pending">Menunggu</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Mata Anggaran (Ketik / Cari)</Label>
            <Popover open={openBudget} onOpenChange={setOpenBudget}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openBudget}
                  className="w-full justify-between font-normal h-9 text-xs"
                >
                  <span className="truncate">
                    {selectedBudget
                      ? `${selectedBudget.code} — ${selectedBudget.name}`
                      : "Semua mata anggaran"}
                  </span>
                  <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[340px] sm:w-[460px] p-0" align="start">
                <Command
                  filter={(value, search) =>
                    value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                  }
                >
                  <CommandInput placeholder="Ketik kode, nama, atau pos pengeluaran…" />
                  <CommandList className="max-h-72 overflow-y-auto">
                    <CommandEmpty>Mata anggaran tidak ditemukan.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="semua all"
                        onSelect={() => {
                          setBudget("all");
                          setOpenBudget(false);
                        }}
                        className="cursor-pointer font-medium"
                      >
                        <Check
                          className={cn(
                            "mr-2 size-3.5",
                            budget === "all" ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span>Semua mata anggaran</span>
                      </CommandItem>
                      {budgetOptions.map((b) => (
                        <CommandItem
                          key={b.id}
                          value={`${b.code} ${b.name} ${b.grup || ""}`}
                          onSelect={() => {
                            setBudget(b.id);
                            setOpenBudget(false);
                          }}
                          className="flex items-start py-2 cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 size-3.5 mt-0.5 shrink-0",
                              budget === b.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-primary">{b.code}</span>
                              <span className="text-xs font-medium text-foreground">{b.name}</span>
                            </div>
                            {b.grup && (
                              <span className="text-[11px] text-muted-foreground">
                                {b.grup}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Baris Rentang Tanggal Khusus */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="dari">Dari Tanggal (Opsional)</Label>
            <DateInput id="dari" value={dari} onChange={setDari} placeholder="YYYY-MM-DD" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sampai">Sampai Tanggal (Opsional)</Label>
            <DateInput id="sampai" value={sampai} onChange={setSampai} placeholder="YYYY-MM-DD" />
          </div>
          <div className="flex items-end gap-2 lg:col-span-2 justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {aktif ? (
                <Badge variant="default" className="text-[11px]">
                  Filter Aktif ({allFilteredRows.length} hasil)
                </Badge>
              ) : (
                <span className="italic">
                  Mode Standar: Menampilkan {rows.length} transaksi terbaru
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={reset} disabled={!aktif && !showAll}>
              Reset filter
            </Button>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground border-b">
          <div>
            {aktif ? (
              <span>
                Menampilkan <strong>{rows.length}</strong> transaksi hasil filter (dari total {sortedPengeluaran.length} transaksi pengeluaran)
              </span>
            ) : showAll ? (
              <span>
                Menampilkan seluruh <strong>{rows.length}</strong> transaksi pengeluaran
              </span>
            ) : (
              <span>
                Menampilkan <strong>{rows.length} transaksi terbaru</strong> dari total <strong>{allFilteredRows.length}</strong> transaksi.
              </span>
            )}
          </div>
          {!aktif && allFilteredRows.length > DEFAULT_LIMIT && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? `Tampilkan ${DEFAULT_LIMIT} Terbaru Saja` : `Tampilkan Semua (${allFilteredRows.length})`}
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-28 font-bold">Tanggal</TableHead>
                <TableHead className="w-36 font-bold">No. Bukti</TableHead>
                <TableHead className="w-40 font-bold">Penerima / Payee</TableHead>
                <TableHead className="font-bold">Mata Anggaran</TableHead>
                <TableHead className="font-bold">Keterangan</TableHead>
                <TableHead className="w-36 text-right font-bold">Nominal</TableHead>
                <TableHead className="w-28 text-right font-bold">Koreksi</TableHead>
                {canApprove && <TableHead className="w-32 text-right font-bold">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/10">
                  <TableCell className="whitespace-nowrap font-medium">{tanggal(t.trx_date)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs font-semibold text-destructive">{t.voucher_no}</span>
                      {isBankPayment(t) ? (
                        <span className="inline-flex items-center text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded w-fit">
                          🏦 Bank
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded w-fit">
                          💵 Tunai
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{t.payee ?? "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.budget_lines ? `${t.budget_lines.code} — ${t.budget_lines.name}` : "-"}
                  </TableCell>
                  <TableCell className="max-w-72 truncate text-sm font-medium">{t.description}</TableCell>
                  <TableCell className="text-right font-medium font-mono text-xs text-destructive">
                    {rupiah(t.amount)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <KoreksiDialog trx={t} />
                      <HapusTransaksiDialog trx={t} />
                    </div>
                  </TableCell>
                  {canApprove && (
                    <TableCell className="text-right whitespace-nowrap">
                      {t.status === "pending" ? (
                        <span className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => decide.mutate({ id: t.id, status: "approved" })}
                          >
                            <Check className="size-3.5" /> Setujui
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => decide.mutate({ id: t.id, status: "rejected" })}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          {STATUS_LABEL[t.status] || t.status}
                        </Badge>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canApprove ? 8 : 7} className="py-12 text-center text-muted-foreground">
                    {trx.isLoading
                      ? "Memuat data transaksi…"
                      : aktif
                        ? "Tidak ada transaksi yang cocok dengan filter."
                        : "Belum ada transaksi pengeluaran."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
