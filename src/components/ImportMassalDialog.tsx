import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { budgetLinesQuery } from "@/lib/queries";
import { useSession } from "@/hooks/use-session";
import { rupiah } from "@/lib/format";
import { exportAoa } from "@/lib/xlsx";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Kind = "penerimaan" | "pengeluaran";

interface ParsedRow {
  trx_date: string;
  kode: string;
  amount: number;
  description: string;
  payee?: string | undefined;
  rawLineIndex: number;
}

const CONTOH: Record<Kind, string> = {
  penerimaan: "2026-08-20; 4.1.01; 250000; Persembahan Ibadah Minggu",
  pengeluaran: "2026-08-20; 5.1.02; 150000; Beli ATK; Toko Sinar Jaya",
};

/** Ubah nilai tanggal Excel, "20/08/2026", atau "2026-08-20" menjadi ISO YYYY-MM-DD */
function parseTanggal(raw: any): string | null {
  if (raw === null || raw === undefined) return null;

  // Jika number (Excel date serial number)
  if (typeof raw === "number") {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  // Jika Date object
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }

  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Format DD/MM/YYYY atau DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  }

  // Format YYYY/MM/DD
  const m2 = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m2) {
    return `${m2[1]}-${m2[2]!.padStart(2, "0")}-${m2[3]!.padStart(2, "0")}`;
  }

  return null;
}

function parseNominal(raw: any): number {
  if (typeof raw === "number") return isNaN(raw) ? 0 : Math.round(raw);
  const s = String(raw ?? "").replace(/[^\d.-]/g, "");
  return Number(s) || 0;
}

export function ImportMassalDialog({ kind }: { kind: Kind }) {
  const { user, canManageFinance } = useSession();
  const budgets = useQuery(budgetLinesQuery);
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"excel" | "paste">("excel");
  const [fileName, setFileName] = useState<string | null>(null);
  const [teks, setTeks] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const kodeMap = new Map(
    (budgets.data ?? []).filter((b) => b.kind === kind).map((b) => [b.code.trim().toLowerCase(), b.id]),
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error("File Excel tidak memiliki lembar kerja (sheet).");

        const sheet = workbook.Sheets[firstSheetName];
        if (!sheet) throw new Error("Lembar kerja kosong.");

        const jsonRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: true,
          defval: "",
        });

        if (jsonRows.length === 0) {
          throw new Error("File Excel kosong.");
        }

        // Deteksi format header
        let startIndex = 0;
        const firstRow = jsonRows[0] || [];
        const firstRowStr = firstRow.join(" ").toLowerCase();
        const isHeader =
          firstRowStr.includes("tanggal") ||
          firstRowStr.includes("tgl") ||
          firstRowStr.includes("kode") ||
          firstRowStr.includes("nominal") ||
          firstRowStr.includes("debit") ||
          firstRowStr.includes("kredit");

        if (isHeader) {
          startIndex = 1;
        }

        // Cek apakah format transaksi.xlsx (memiliki kolom Debit / Kredit di kolom 5 & 6)
        const isDebitKreditFormat =
          firstRowStr.includes("debit") || firstRowStr.includes("kredit") || (firstRow.length >= 6 && firstRow[0] === "NO");

        const validRows: ParsedRow[] = [];
        for (let i = startIndex; i < jsonRows.length; i++) {
          const row = jsonRows[i];
          if (!row || row.length === 0) continue;

          // Cek jika seluruh kolom kosong
          const isAllEmpty = row.every((c) => c === "" || c === null || c === undefined);
          if (isAllEmpty) continue;

          let rawTgl: any;
          let rawKode: any;
          let rawNominal: any;
          let rawKet: any;
          let rawPenerima: any;

          if (isDebitKreditFormat) {
            // [NO (0), Tanggal (1), Mata Anggaran (2), Nama Mata Anggaran (3), Keterangan (4), Debit (5), Kredit (6)]
            rawTgl = row[1];
            rawKode = row[2];
            rawKet = row[4] || row[3];
            rawNominal = kind === "penerimaan" ? row[5] : row[6];
            rawPenerima = undefined;

            // Jika nominal pada jenis ini kosong / 0, skip baris ini (karena transaksi milik jenis lawan)
            const nominalVal = parseNominal(rawNominal);
            if (!nominalVal || nominalVal <= 0) continue;
          } else {
            // Format standar: [Tanggal (0), Kode (1), Nominal (2), Keterangan (3), Penerima (4)]
            [rawTgl, rawKode, rawNominal, rawKet, rawPenerima] = row;
          }

          const tgl = parseTanggal(rawTgl);
          if (!tgl) {
            continue; // Skip baris tanpa tanggal yang valid
          }

          const kode = String(rawKode ?? "").trim();
          if (!kode) {
            continue;
          }

          const nominal = parseNominal(rawNominal);
          if (!nominal || nominal <= 0) {
            continue;
          }

          const description = String(rawKet ?? "").trim();
          const payee = kind === "pengeluaran" ? String(rawPenerima ?? "").trim() || undefined : undefined;

          validRows.push({
            trx_date: tgl,
            kode,
            amount: nominal,
            description,
            payee,
            rawLineIndex: i + 1,
          });
        }

        if (validRows.length === 0) {
          throw new Error("Tidak ditemukan data transaksi yang valid dalam file Excel.");
        }

        setParsedRows(validRows);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal membaca file Excel";
        setParseError(msg);
        setParsedRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handlePasteParse() {
    setParseError(null);
    try {
      const baris = teks
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (baris.length === 0) {
        setParsedRows([]);
        return;
      }

      const validRows: ParsedRow[] = baris.map((line, i) => {
        const c = line.split(/[;\t]|,(?=\s*\d)/).map((x) => x.trim());
        const [tglStr, kodeStr, nominalStr, keterangan, penerima] = c;

        const trx_date = parseTanggal(tglStr ?? "");
        if (!trx_date) throw new Error(`Baris ${i + 1}: tanggal tidak valid ("${tglStr ?? ""}")`);

        const kode = (kodeStr ?? "").trim();
        if (!kode) throw new Error(`Baris ${i + 1}: kode mata anggaran kosong`);

        const amount = parseNominal(nominalStr ?? "");
        if (!amount || amount <= 0) throw new Error(`Baris ${i + 1}: nominal tidak valid`);

        return {
          trx_date,
          kode,
          amount,
          description: (keterangan ?? "").slice(0, 500),
          payee: kind === "pengeluaran" ? (penerima ?? "").trim() || undefined : undefined,
          rawLineIndex: i + 1,
        };
      });

      setParsedRows(validRows);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Gagal memproses data teks");
      setParsedRows([]);
    }
  }

  function downloadTemplate() {
    const headers =
      kind === "penerimaan"
        ? [["Tanggal", "Kode Mata Anggaran", "Nominal", "Keterangan"]]
        : [["Tanggal", "Kode Mata Anggaran", "Nominal", "Keterangan", "Penerima"]];

    const sampleRow =
      kind === "penerimaan"
        ? [["2026-08-20", "4.1.01", 250000, "Persembahan Ibadah Minggu"]]
        : [["2026-08-20", "5.1.02", 150000, "Pembelian ATK Kantor", "Toko Sinar Jaya"]];

    exportAoa(
      [...headers, ...sampleRow],
      `Template_Import_${kind === "penerimaan" ? "Penerimaan" : "Pengeluaran"}.xlsx`,
      "Template",
      [15, 22, 18, 40, 25],
    );
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (parsedRows.length === 0) throw new Error("Belum ada data transaksi yang siap diimpor.");
      if (parsedRows.length > 1500) throw new Error("Maksimal 1.500 baris per impor.");

      const rowsToInsert = parsedRows.map((r) => {
        const budget_line_id = kodeMap.get(r.kode.toLowerCase());
        if (!budget_line_id) {
          throw new Error(
            `Baris ${r.rawLineIndex}: Kode mata anggaran "${r.kode}" tidak ditemukan di daftar anggaran ${kind}.`,
          );
        }

        return {
          trx_date: r.trx_date,
          kind,
          category: "",
          budget_line_id,
          amount: r.amount,
          description: r.description.slice(0, 500),
          payee: kind === "pengeluaran" ? (r.payee ?? null) : null,
          payment_method: null,
          attachment_url: null,
          status: "approved" as const,
          created_by: user!.id,
          voucher_no: "",
        };
      });

      for (let i = 0; i < rowsToInsert.length; i += 200) {
        const chunk = rowsToInsert.slice(i, i + 200);
        const { error } = await supabase.from("transactions").insert(chunk);
        if (error) throw error;
      }
      return rowsToInsert.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} transaksi ${kind} berhasil diimpor dan disimpan.`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setTeks("");
      setFileName(null);
      setParsedRows([]);
      setParseError(null);
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal mengimpor transaksi"),
  });

  if (!canManageFinance) return null;

  const totalAmount = parsedRows.reduce((a, b) => a + b.amount, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Upload className="size-3.5" />
          Tambah Massal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Tambah Transaksi Massal ({kind === "penerimaan" ? "Penerimaan" : "Pengeluaran"})</DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-normal"
              onClick={downloadTemplate}
            >
              <Download className="size-3.5" /> Unduh Template Excel
            </Button>
          </div>
          <DialogDescription>
            Upload file Excel (.xlsx, .xls) atau tempel data transaksi. Nomor bukti dibuat otomatis.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "excel" | "paste")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="excel" className="gap-1.5">
              <FileSpreadsheet className="size-4" /> Upload File Excel
            </TabsTrigger>
            <TabsTrigger value="paste" className="gap-1.5">
              <FileText className="size-4" /> Tempel Teks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="excel" className="space-y-4 pt-3">
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-6 text-center hover:bg-muted/40 cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <FileSpreadsheet className="size-10 text-primary/70 mb-2" />
              <p className="text-sm font-medium">
                {fileName ? fileName : "Klik untuk memilih file Excel (.xlsx / .xls)"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Format kolom: Tanggal, Kode Anggaran, Nominal, Keterangan {kind === "pengeluaran" ? ", Penerima" : ""}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="paste" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Label htmlFor="massal-teks">Tempel data transaksi</Label>
              <Textarea
                id="massal-teks"
                value={teks}
                onChange={(e) => {
                  setTeks(e.target.value);
                }}
                onBlur={handlePasteParse}
                placeholder={CONTOH[kind]}
                className="min-h-40 font-mono text-xs"
              />
              <Button type="button" size="sm" variant="secondary" onClick={handlePasteParse}>
                Proses Data Tempel
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {parseError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-success">
                <CheckCircle2 className="size-4" /> {parsedRows.length} transaksi siap diimpor
              </span>
              <span className="font-semibold text-foreground">
                Total: {rupiah(totalAmount)}
              </span>
            </div>

            <div className="max-h-40 overflow-y-auto rounded border bg-background text-xs">
              <table className="w-full text-left">
                <thead className="border-b bg-muted/50 text-[10px] uppercase text-muted-foreground sticky top-0">
                  <tr>
                    <th className="p-1.5">Tgl</th>
                    <th className="p-1.5">Kode</th>
                    <th className="p-1.5">Keterangan</th>
                    <th className="p-1.5 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 10).map((r, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-1.5 font-mono">{r.trx_date}</td>
                      <td className="p-1.5 font-mono font-medium">{r.kode}</td>
                      <td className="p-1.5 truncate max-w-[200px]">{r.description || "-"}</td>
                      <td className="p-1.5 text-right font-medium">{rupiah(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 10 && (
                <p className="p-1.5 text-center text-[10px] text-muted-foreground bg-muted/20">
                  ... dan {parsedRows.length - 10} transaksi lainnya.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            disabled={mutation.isPending || parsedRows.length === 0}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Mengimpor…" : `Impor ${parsedRows.length} Transaksi`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}