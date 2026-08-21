import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ParsedBudget {
  code: string;
  name: string;
  kind: "penerimaan" | "pengeluaran";
  grup: string;
  planned_amount: number;
  fiscal_year: number;
}

export function ImportAnggaranDialog() {
  const { canManageFinance } = useSession();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedBudget[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const items: ParsedBudget[] = [];

        // 1. Cek apakah ada multi-sheet "RAB BELANJA" dan "RAB PENDAPATAN"
        if (workbook.SheetNames.includes("RAB BELANJA") || workbook.SheetNames.includes("RAB PENDAPATAN")) {
          if (workbook.Sheets["RAB BELANJA"]) {
            const rows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets["RAB BELANJA"], { header: 1 });
            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              if (!r || !r[0]) continue;
              items.push({
                code: String(r[0]).trim(),
                name: String(r[1] || "").trim(),
                planned_amount: Number(r[2]) || 0,
                grup: String(r[3] || "").trim(),
                kind: "pengeluaran",
                fiscal_year: new Date().getFullYear(),
              });
            }
          }

          if (workbook.Sheets["RAB PENDAPATAN"]) {
            const rows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets["RAB PENDAPATAN"], { header: 1 });
            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              if (!r || !r[0]) continue;
              items.push({
                code: String(r[0]).trim(),
                name: String(r[1] || "").trim(),
                planned_amount: Number(r[2]) || 0,
                grup: String(r[3] || "").trim(),
                kind: "penerimaan",
                fiscal_year: new Date().getFullYear(),
              });
            }
          }
        } else {
          // 2. Format single sheet generik: [Kode, Nama, Jenis, Grup, Pagu]
          const firstSheet = workbook.Sheets[workbook.SheetNames[0] || ""];
          if (!firstSheet) throw new Error("File Excel kosong.");
          const rows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[0]) continue;
            const rawKind = String(r[2] || "").toLowerCase();
            const kind: "penerimaan" | "pengeluaran" =
              rawKind.includes("keluar") || rawKind.includes("belanja") ? "pengeluaran" : "penerimaan";
            items.push({
              code: String(r[0]).trim(),
              name: String(r[1] || "").trim(),
              kind,
              grup: String(r[3] || "").trim(),
              planned_amount: Number(r[4]) || 0,
              fiscal_year: new Date().getFullYear(),
            });
          }
        }

        if (items.length === 0) {
          throw new Error("Tidak ada data mata anggaran yang valid di file Excel.");
        }

        setParsedItems(items);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Gagal membaca file Excel");
        setParsedItems([]);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (parsedItems.length === 0) throw new Error("Belum ada data mata anggaran.");

      for (let i = 0; i < parsedItems.length; i += 50) {
        const chunk = parsedItems.slice(i, i + 50);
        const { error } = await supabase.from("budget_lines").upsert(chunk, {
          onConflict: "code,kind,fiscal_year",
        });
        if (error) throw error;
      }
      return parsedItems.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} mata anggaran berhasil diimpor & disinkronkan.`);
      queryClient.invalidateQueries({ queryKey: ["budget_lines"] });
      setOpen(false);
      setParsedItems([]);
      setFileName(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal mengimpor mata anggaran"),
  });

  if (!canManageFinance) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="size-3.5" /> Import Excel Anggaran
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Mata Anggaran dari Excel</DialogTitle>
          <DialogDescription>
            Upload file Excel mata anggaran BUMOTIK (sheet RAB PENDAPATAN &amp; RAB BELANJA).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-6 text-center hover:bg-muted/40 cursor-pointer transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <FileSpreadsheet className="size-10 text-primary/70 mb-2" />
            <p className="text-sm font-medium">
              {fileName ? fileName : "Klik untuk memilih file Excel (.xlsx / .xls)"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Mendukung format multi-sheet RAB Belanja &amp; RAB Pendapatan
            </p>
          </div>

          {parseError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {parsedItems.length > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-success">
                  <CheckCircle2 className="size-4" /> {parsedItems.length} mata anggaran terdeteksi
                </span>
                <span className="text-muted-foreground">
                  {parsedItems.filter((x) => x.kind === "penerimaan").length} penerimaan ·{" "}
                  {parsedItems.filter((x) => x.kind === "pengeluaran").length} pengeluaran
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={mutation.isPending || parsedItems.length === 0}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Mengimpor…" : `Impor ${parsedItems.length} Mata Anggaran`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
