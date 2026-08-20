import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { budgetLinesQuery } from "@/lib/queries";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const CONTOH: Record<Kind, string> = {
  penerimaan: "2026-08-20; 1.3.01.01; 250000; Persembahan Ibadah Minggu",
  pengeluaran: "2026-08-20; 2.1.01.01; 150000; Beli ATK; Toko Sinar",
};

/** Ubah "20/08/2026" atau "2026-08-20" menjadi ISO date */
function parseTanggal(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

function parseNominal(raw: string): number {
  return Number(raw.replace(/[^\d]/g, ""));
}

export function ImportMassalDialog({ kind }: { kind: Kind }) {
  const { user, canManageFinance } = useSession();
  const budgets = useQuery(budgetLinesQuery);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [teks, setTeks] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const kodeMap = new Map(
        (budgets.data ?? []).filter((b) => b.kind === kind).map((b) => [b.code.trim(), b.id]),
      );
      const baris = teks
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (baris.length === 0) throw new Error("Belum ada data yang ditempel");
      if (baris.length > 1000) throw new Error("Maksimal 1.000 baris per impor");

      const rows = baris.map((line, i) => {
        const c = line.split(/[;\t]|,(?=\s*\d)/).map((x) => x.trim());
        const [tgl, kode, nominal, keterangan, penerima] = c;
        const trx_date = parseTanggal(tgl ?? "");
        if (!trx_date) throw new Error(`Baris ${i + 1}: tanggal tidak valid ("${tgl ?? ""}")`);
        const budget_line_id = kodeMap.get((kode ?? "").trim());
        if (!budget_line_id)
          throw new Error(`Baris ${i + 1}: kode mata anggaran "${kode ?? ""}" tidak ditemukan`);
        const amount = parseNominal(nominal ?? "");
        if (!amount || amount <= 0) throw new Error(`Baris ${i + 1}: nominal tidak valid`);
        return {
          trx_date,
          kind,
          category: "",
          budget_line_id,
          amount,
          description: (keterangan ?? "").slice(0, 500),
          payee: kind === "pengeluaran" ? ((penerima ?? "").trim() || null) : null,
          payment_method: null,
          attachment_url: null,
          status: (kind === "pengeluaran" ? "pending" : "approved") as "pending" | "approved",
          created_by: user!.id,
          voucher_no: "",
        };
      });

      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from("transactions").insert(rows.slice(i, i + 200));
        if (error) throw error;
      }
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} transaksi berhasil ditambahkan`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setTeks("");
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal mengimpor transaksi"),
  });

  if (!canManageFinance) return null;

  const jumlahBaris = teks.split("\n").filter((l) => l.trim() !== "").length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Upload className="size-3.5" />
          Tambah Massal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tambah Rincian Transaksi Massal</DialogTitle>
          <DialogDescription>
            Tempel data dari Excel — satu transaksi per baris, kolom dipisah titik koma atau tab:
            <br />
            <span className="font-mono text-xs">
              tanggal; kode mata anggaran; nominal; keterangan
              {kind === "pengeluaran" ? "; penerima" : ""}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="massal">Data transaksi</Label>
          <Textarea
            id="massal"
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            placeholder={CONTOH[kind]}
            className="min-h-56 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            {jumlahBaris} baris terdeteksi · nomor bukti dibuat otomatis.
          </p>
        </div>

        <DialogFooter>
          <Button
            disabled={mutation.isPending || jumlahBaris === 0}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Mengimpor…" : `Impor ${jumlahBaris} transaksi`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}