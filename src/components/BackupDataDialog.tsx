import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Database, ShieldCheck, ArrowDownCircle, ArrowUpCircle, Layers } from "lucide-react";
import { toast } from "sonner";
import { transactionsQuery, budgetLinesQuery } from "@/lib/queries";
import { exportAoa, exportMultiSheet, type SheetData } from "@/lib/xlsx";
import { rupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Kind = "penerimaan" | "pengeluaran" | "semua";

export function BackupDataDialog({ kind = "semua" }: { kind?: Kind }) {
  const trx = useQuery(transactionsQuery);
  const budgets = useQuery(budgetLinesQuery);
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const penerimaanList = (trx.data ?? [])
    .filter((t) => t.kind === "penerimaan")
    .sort((a, b) => b.trx_date.localeCompare(a.trx_date));

  const pengeluaranList = (trx.data ?? [])
    .filter((t) => t.kind === "pengeluaran")
    .sort((a, b) => b.trx_date.localeCompare(a.trx_date));

  const budgetList = (budgets.data ?? []).sort((a, b) => (a.code || "").localeCompare(b.code || ""));

  const totalPenerimaan = penerimaanList.reduce((a, t) => a + Number(t.amount || 0), 0);
  const totalPengeluaran = pengeluaranList.reduce((a, t) => a + Number(t.amount || 0), 0);

  // 1. Ekspor Backup Lengkap Seluruh Database (Multi-Sheet)
  const downloadBackupLengkap = () => {
    try {
      setIsExporting(true);

      // Sheet 1: Penerimaan
      const penerimaanRows = [
        ["NO", "TANGGAL", "KODE ANGGARAN", "NAMA ANGGARAN", "KETERANGAN", "NOMINAL (RP)", "NO BUKTI"],
        ...penerimaanList.map((t, idx) => [
          idx + 1,
          t.trx_date,
          t.budget_lines?.code || "-",
          t.budget_lines?.name || "-",
          t.description || "-",
          Number(t.amount || 0),
          t.voucher_no || "-",
        ]),
      ];

      // Sheet 2: Pengeluaran
      const pengeluaranRows = [
        ["NO", "TANGGAL", "KODE ANGGARAN", "NAMA ANGGARAN", "KETERANGAN", "NOMINAL (RP)", "PENERIMA", "STATUS", "NO BUKTI"],
        ...pengeluaranList.map((t, idx) => [
          idx + 1,
          t.trx_date,
          t.budget_lines?.code || "-",
          t.budget_lines?.name || "-",
          t.description || "-",
          Number(t.amount || 0),
          t.payee || "-",
          t.status === "approved" ? "Disetujui" : t.status === "rejected" ? "Ditolak" : "Menunggu",
          t.voucher_no || "-",
        ]),
      ];

      // Sheet 3: Mata Anggaran
      const budgetRows = [
        ["NO", "KODE", "NAMA MATA ANGGARAN", "JENIS", "GRUP / KATEGORI", "TARGET PAGU (RP)"],
        ...budgetList.map((b, idx) => [
          idx + 1,
          b.code,
          b.name,
          b.kind === "penerimaan" ? "Penerimaan" : "Pengeluaran",
          b.grup || "-",
          Number(b.planned_amount || 0),
        ]),
      ];

      // Sheet 4: Ringkasan
      const summaryRows = [
        ["RINGKASAN BACKUP DATABASE KEUANGAN BUMOTIK"],
        ["Tanggal Backup", todayStr],
        ["Waktu Export", new Date().toLocaleTimeString("id-ID")],
        [],
        ["Kategori", "Jumlah Transaksi", "Total Nominal (Rp)"],
        ["Penerimaan Kas", penerimaanList.length, totalPenerimaan],
        ["Pengeluaran Kas", pengeluaranList.length, totalPengeluaran],
        ["Saldo Bersih", "-", totalPenerimaan - totalPengeluaran],
        ["Total Mata Anggaran Terdaftar", budgetList.length, "-"],
      ];

      const sheets: SheetData[] = [
        {
          name: "Penerimaan",
          rows: penerimaanRows,
          colWidths: [6, 12, 16, 36, 45, 18, 16],
        },
        {
          name: "Pengeluaran",
          rows: pengeluaranRows,
          colWidths: [6, 12, 16, 36, 45, 18, 20, 12, 16],
        },
        {
          name: "Mata Anggaran",
          rows: budgetRows,
          colWidths: [6, 16, 40, 15, 30, 20],
        },
        {
          name: "Ringkasan Database",
          rows: summaryRows,
          colWidths: [30, 20, 25],
        },
      ];

      const filename = `Backup_Lengkap_Keuangan_BUMOTIK_${todayStr}.xlsx`;
      exportMultiSheet(sheets, filename);
      toast.success(`Backup lengkap berhasil diunduh: ${filename}`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunduh backup");
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Ekspor Khusus Penerimaan (Siap Di-Import Kembali)
  const downloadBackupPenerimaan = () => {
    try {
      setIsExporting(true);
      const rows = [
        ["Tanggal", "Kode Anggaran", "Nominal", "Keterangan", "No Bukti"],
        ...penerimaanList.map((t) => [
          t.trx_date,
          t.budget_lines?.code || "",
          Number(t.amount || 0),
          t.description || "",
          t.voucher_no || "",
        ]),
      ];
      const filename = `Backup_Penerimaan_SiapImport_${todayStr}.xlsx`;
      exportAoa(rows, filename, "Penerimaan", [14, 16, 16, 45, 16]);
      toast.success(`Backup Penerimaan berhasil diunduh: ${filename}`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunduh backup");
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Ekspor Khusus Pengeluaran (Siap Di-Import Kembali)
  const downloadBackupPengeluaran = () => {
    try {
      setIsExporting(true);
      const rows = [
        ["Tanggal", "Kode Anggaran", "Nominal", "Keterangan", "Penerima", "No Bukti"],
        ...pengeluaranList.map((t) => [
          t.trx_date,
          t.budget_lines?.code || "",
          Number(t.amount || 0),
          t.description || "",
          t.payee || "",
          t.voucher_no || "",
        ]),
      ];
      const filename = `Backup_Pengeluaran_SiapImport_${todayStr}.xlsx`;
      exportAoa(rows, filename, "Pengeluaran", [14, 16, 16, 45, 20, 16]);
      toast.success(`Backup Pengeluaran berhasil diunduh: ${filename}`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunduh backup");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs font-medium">
          <Download className="size-3.5 text-primary" />
          Backup Data
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Database className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Backup Data Keuangan</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Unduh salinan data transaksi ke dalam format file Excel (.xlsx) untuk arsip aman.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Ringkasan Data Saat Ini */}
        <div className="grid grid-cols-2 gap-2.5 py-1">
          <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <ArrowDownCircle className="size-3.5 text-success" />
              Penerimaan Kas
            </div>
            <div className="text-base font-bold font-mono text-primary">
              {penerimaanList.length} <span className="text-xs font-normal text-muted-foreground">transaksi</span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Total: {rupiah(totalPenerimaan)}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <ArrowUpCircle className="size-3.5 text-destructive" />
              Pengeluaran Kas
            </div>
            <div className="text-base font-bold font-mono text-primary">
              {pengeluaranList.length} <span className="text-xs font-normal text-muted-foreground">transaksi</span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Total: {rupiah(totalPengeluaran)}
            </div>
          </div>
        </div>

        {/* Pilihan Download Backup */}
        <div className="space-y-2.5 pt-1">
          <Label className="text-xs font-semibold block text-foreground">
            Pilih Format Download Backup:
          </Label>

          {/* Opsi 1: Backup Lengkap Multi-Sheet */}
          <button
            type="button"
            onClick={downloadBackupLengkap}
            disabled={isExporting}
            className="w-full text-left rounded-lg border bg-card hover:bg-muted/40 p-3 transition-colors flex items-start gap-3 group"
          >
            <div className="rounded-md bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0 mt-0.5">
              <Layers className="size-4" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  Backup Lengkap Seluruh Database (.xlsx)
                </span>
                <span className="text-[11px] text-primary font-medium flex items-center gap-0.5">
                  <Download className="size-3" /> Unduh
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Berisi 4 Sheet lengkap: Penerimaan ({penerimaanList.length} baris), Pengeluaran ({pengeluaranList.length} baris), Mata Anggaran ({budgetList.length} pos), dan Ringkasan.
              </p>
            </div>
          </button>

          {/* Opsi 2: Backup Penerimaan Siap Import */}
          <button
            type="button"
            onClick={downloadBackupPenerimaan}
            disabled={isExporting || penerimaanList.length === 0}
            className="w-full text-left rounded-lg border bg-card hover:bg-muted/40 p-3 transition-colors flex items-start gap-3 group"
          >
            <div className="rounded-md bg-success/10 p-2 text-success group-hover:bg-success group-hover:text-success-foreground transition-colors shrink-0 mt-0.5">
              <FileSpreadsheet className="size-4" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  Backup Penerimaan — Format Siap Import (.xlsx)
                </span>
                <span className="text-[11px] text-success font-medium flex items-center gap-0.5">
                  <Download className="size-3" /> Unduh
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Format kolom standar yang kompatibel 100% dengan menu <strong>Import Data</strong> jika database di-reset.
              </p>
            </div>
          </button>

          {/* Opsi 3: Backup Pengeluaran Siap Import */}
          <button
            type="button"
            onClick={downloadBackupPengeluaran}
            disabled={isExporting || pengeluaranList.length === 0}
            className="w-full text-left rounded-lg border bg-card hover:bg-muted/40 p-3 transition-colors flex items-start gap-3 group"
          >
            <div className="rounded-md bg-destructive/10 p-2 text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors shrink-0 mt-0.5">
              <FileSpreadsheet className="size-4" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  Backup Pengeluaran — Format Siap Import (.xlsx)
                </span>
                <span className="text-[11px] text-destructive font-medium flex items-center gap-0.5">
                  <Download className="size-3" /> Unduh
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Format kolom standar pengeluaran kas yang siap di-import kembali kapan saja.
              </p>
            </div>
          </button>
        </div>

        <div className="rounded-md bg-muted/40 border p-2.5 text-[11px] text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary shrink-0" />
          <span>
            Disarankan untuk selalu mengunduh file backup sebelum melakukan <strong>Reset Data</strong>.
          </span>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
