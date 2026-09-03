import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase, anonInsforge } from "@/integrations/supabase/client";
import { budgetLinesQuery, transactionsQuery, type Transaction } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { useSession } from "@/hooks/use-session";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/koreksi")({
  head: () => ({
    meta: [
      { title: "Koreksi Transaksi — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Perbaiki keterangan dan mata anggaran transaksi yang salah input, lengkap dengan alasan dan riwayat koreksi.",
      },
      { property: "og:title", content: "Koreksi Transaksi — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Menu koreksi keterangan dan mata anggaran transaksi beserta riwayat perubahannya.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KoreksiPage,
});

type Riwayat = {
  id: string;
  voucher_no: string;
  field: string;
  old_value: string;
  new_value: string;
  reason: string;
  created_at: string;
};

const FIELD_LABEL: Record<string, string> = {
  description: "Keterangan",
  budget_line_id: "Mata Anggaran",
  amount: "Nominal",
  trx_date: "Tanggal",
  payment_method: "Metode Pembayaran",
};

function KoreksiPage() {
  const { user, canManageFinance } = useSession();
  const trx = useQuery(transactionsQuery);
  const lines = useQuery(budgetLinesQuery);
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [pilih, setPilih] = useState<Transaction | null>(null);
  const [keterangan, setKeterangan] = useState("");
  const [lineId, setLineId] = useState("");
  const [amount, setAmount] = useState("");
  const [trxDate, setTrxDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cariLine, setCariLine] = useState("");
  const [alasan, setAlasan] = useState("");

  const riwayat = useQuery({
    queryKey: ["transaction_corrections"],
    queryFn: async (): Promise<Riwayat[]> => {
      const { data, error } = await supabase
        .from("transaction_corrections")
        .select("id, voucher_no, field, old_value, new_value, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Riwayat[];
    },
  });

  const hasil = useMemo(() => {
    const key = q.trim().toLowerCase();
    const all = trx.data ?? [];
    if (!key) return all.slice(0, 15);
    return all
      .filter((t) =>
        `${t.voucher_no} ${t.trx_date} ${t.description} ${t.payee ?? ""} ${t.budget_lines?.code ?? ""} ${t.budget_lines?.name ?? ""}`
          .toLowerCase()
          .includes(key),
      )
      .slice(0, 30);
  }, [trx.data, q]);

  const opsiLine = useMemo(() => {
    const key = cariLine.trim().toLowerCase();
    const list = (lines.data ?? []).filter((l) => !pilih || l.kind === pilih.kind);
    return (key ? list.filter((l) => `${l.code} ${l.name}`.toLowerCase().includes(key)) : list).slice(
      0,
      200,
    );
  }, [lines.data, cariLine, pilih]);

  function mulai(t: Transaction) {
    setPilih(t);
    setKeterangan(t.description ?? "");
    setLineId(t.budget_line_id);
    setAmount(String(t.amount));
    setTrxDate(t.trx_date);
    setPaymentMethod(t.payment_method || "cash");
    setCariLine("");
    setAlasan("");
  }

  const simpan = useMutation({
    mutationFn: async () => {
      if (!pilih) throw new Error("Pilih transaksi terlebih dahulu");
      const alasanClean = alasan.trim() || "Penyesuaian data transaksi";
      const cleanNominal = Number(String(amount).replace(/[^0-9.-]+/g, ""));
      if (!Number.isFinite(cleanNominal) || cleanNominal <= 0) {
        throw new Error("Nominal harus berupa angka lebih dari 0");
      }

      const perubahan: { field: string; old_value: string; new_value: string }[] = [];
      if (keterangan !== (pilih.description ?? "")) {
        perubahan.push({
          field: "description",
          old_value: pilih.description ?? "",
          new_value: keterangan,
        });
      }
      if (cleanNominal !== Number(pilih.amount)) {
        perubahan.push({
          field: "amount",
          old_value: rupiah(pilih.amount),
          new_value: rupiah(cleanNominal),
        });
      }
      if (trxDate && trxDate !== pilih.trx_date) {
        perubahan.push({
          field: "trx_date",
          old_value: tanggal(pilih.trx_date),
          new_value: tanggal(trxDate),
        });
      }
      if (lineId !== pilih.budget_line_id) {
        const lama = (lines.data ?? []).find((l) => l.id === pilih.budget_line_id);
        const baru = (lines.data ?? []).find((l) => l.id === lineId);
        perubahan.push({
          field: "budget_line_id",
          old_value: lama ? `${lama.code} ${lama.name}` : pilih.budget_line_id,
          new_value: baru ? `${baru.code} ${baru.name}` : lineId,
        });
      }
      if (paymentMethod !== (pilih.payment_method || "cash")) {
        perubahan.push({
          field: "payment_method",
          old_value: pilih.payment_method || "cash",
          new_value: paymentMethod,
        });
      }

      if (perubahan.length === 0) {
        throw new Error("Tidak ada perubahan data. Silakan ubah tanggal, nominal, keterangan, atau mata anggaran.");
      }

      const catatan = `Koreksi ${perubahan.map((p) => FIELD_LABEL[p.field] ?? p.field).join(" & ")}: ${alasanClean}`;
      const { error } = await supabase
        .from("transactions")
        .update({
          amount: cleanNominal,
          trx_date: trxDate || pilih.trx_date,
          description: keterangan,
          budget_line_id: lineId,
          payment_method: paymentMethod,
          koreksi_dari: pilih.voucher_no,
          koreksi_catatan: catatan,
        })
        .eq("id", pilih.id);
      if (error) {
        const fb = await anonInsforge.database
          .from("transactions")
          .update({
            amount: cleanNominal,
            trx_date: trxDate || pilih.trx_date,
            description: keterangan,
            budget_line_id: lineId,
            payment_method: paymentMethod,
            koreksi_dari: pilih.voucher_no,
            koreksi_catatan: catatan,
          })
          .eq("id", pilih.id);
        if (fb.error) throw fb.error;
      }

      // Safe UUID verification for corrected_by
      const validUserId =
        user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)
          ? user.id
          : null;

      try {
        const payload = perubahan.map((p) => ({
          transaction_id: pilih.id,
          voucher_no: pilih.voucher_no,
          field: p.field,
          old_value: p.old_value,
          new_value: p.new_value,
          reason: alasanClean,
          corrected_by: validUserId,
        }));
        const insRes = await supabase.from("transaction_corrections").insert(payload);
        if (insRes?.error) {
          await anonInsforge.database.from("transaction_corrections").insert(payload);
        }
      } catch (logErr) {
        console.warn("Gagal menyimpan log riwayat koreksi:", logErr);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["transactions"] });
      const previousTrx = queryClient.getQueryData<Transaction[]>(["transactions"]);

      const cleanNominal = Number(String(amount).replace(/[^0-9.-]+/g, "")) || (pilih ? pilih.amount : 0);
      const targetBudgetLine = (lines.data ?? []).find((l) => l.id === lineId);

      // Instant optimistic update in cache
      if (pilih) {
        queryClient.setQueryData<Transaction[]>(["transactions"], (old) =>
          old
            ? old.map((t) =>
                t.id === pilih.id
                  ? {
                      ...t,
                      amount: cleanNominal,
                      trx_date: trxDate || pilih.trx_date,
                      description: keterangan,
                      budget_line_id: lineId,
                      payment_method: paymentMethod,
                      budget_lines: targetBudgetLine
                        ? { code: targetBudgetLine.code, name: targetBudgetLine.name }
                        : (t.budget_lines ?? null),
                    }
                  : t,
              )
            : [],
        );
      }

      setPilih(null);
      return { previousTrx };
    },
    onSuccess: () => {
      toast.success("Koreksi berhasil disimpan");
      if (typeof window !== "undefined") {
        try {
          const bc = new BroadcastChannel("bumotik_realtime_sync");
          bc.postMessage({ type: "SYNC_TRANSACTIONS", timestamp: Date.now() });
          bc.close();
        } catch {}
      }
    },
    onError: (e: unknown, _, context) => {
      if (context?.previousTrx) {
        queryClient.setQueryData(["transactions"], context.previousTrx);
      }
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan koreksi");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction_corrections"] });
    },
  });

  if (!canManageFinance) {
    return (
      <AppShell title="Koreksi Transaksi" subtitle="Akses terbatas">
        <div className="panel p-6 text-sm text-muted-foreground">
          Menu ini hanya dapat diakses oleh Admin Keuangan dan Super Administrator.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Koreksi Transaksi"
      subtitle="Perbaiki tanggal, nominal, keterangan, atau mata anggaran yang salah input, lengkap dengan alasan dan riwayat"
    >
      <div className="panel p-5">
        <Label htmlFor="cari">Cari transaksi</Label>
        <Input
          id="cari"
          className="mt-1.5"
          placeholder="No. bukti, tanggal, keterangan, atau mata anggaran"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="mt-4 space-y-2">
          {!q && <p className="text-xs text-muted-foreground font-medium mb-1">Transaksi Terbaru (Klik untuk mengoreksi):</p>}
          {hasil.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => mulai(t)}
              className={`flex w-full flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-all ${
                pilih?.id === t.id
                  ? "border-primary bg-primary/10 ring-2 ring-primary font-semibold shadow-xs"
                  : "border-border hover:bg-muted"
              }`}
            >
              <span className="font-mono text-xs">{t.voucher_no}</span>
              <span className="text-xs text-muted-foreground">{tanggal(t.trx_date)}</span>
              <Badge variant={pilih?.id === t.id ? "default" : "outline"}>
                {t.budget_lines?.code} — {t.budget_lines?.name}
              </Badge>
              <span className="flex-1 truncate">{t.description}</span>
              <span className="font-medium">{rupiah(t.amount)}</span>
              {pilih?.id === t.id && (
                <Badge variant="secondary" className="bg-primary text-primary-foreground text-[10px]">
                  Dipilih
                </Badge>
              )}
            </button>
          ))}
          {q && hasil.length === 0 && (
            <p className="text-sm text-muted-foreground">Transaksi tidak ditemukan.</p>
          )}
        </div>
      </div>

      {pilih && (
        <div className="panel mt-5 space-y-4 p-5">
          <h2 className="text-base font-semibold">
            Koreksi Transaksi {pilih.voucher_no}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tgl">Tanggal Transaksi</Label>
              <Input
                id="tgl"
                type="date"
                value={trxDate}
                onChange={(e) => setTrxDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nom">Nominal (Rp)</Label>
              <Input
                id="nom"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ket">Keterangan</Label>
            <Textarea
              id="ket"
              rows={3}
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cariline">Mata Anggaran</Label>
            <Input
              id="cariline"
              placeholder="Cari kode atau nama mata anggaran"
              value={cariLine}
              onChange={(e) => setCariLine(e.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
            >
              {opsiLine.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alasan">Alasan Koreksi</Label>
            <Textarea
              id="alasan"
              rows={2}
              placeholder="Misal: salah input nominal / salah mata anggaran"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => simpan.mutate()} disabled={simpan.isPending}>
              {simpan.isPending ? "Menyimpan…" : "Simpan Koreksi"}
            </Button>
            <Button variant="outline" onClick={() => setPilih(null)}>
              Batal
            </Button>
          </div>
        </div>
      )}

      <div className="panel mt-5 overflow-x-auto p-5">
        <h2 className="text-base font-semibold">Riwayat Koreksi</h2>
        <table className="mt-4 w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Waktu</th>
              <th className="py-2 pr-3">No. Bukti</th>
              <th className="py-2 pr-3">Bagian</th>
              <th className="py-2 pr-3">Nilai Lama</th>
              <th className="py-2 pr-3">Nilai Baru</th>
              <th className="py-2">Alasan</th>
            </tr>
          </thead>
          <tbody>
            {(riwayat.data ?? []).map((r) => (
              <tr key={r.id} className="border-b last:border-0 align-top">
                <td className="py-2 pr-3 text-xs">{new Date(r.created_at).toLocaleString("id-ID")}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.voucher_no}</td>
                <td className="py-2 pr-3">{FIELD_LABEL[r.field] ?? r.field}</td>
                <td className="py-2 pr-3 text-muted-foreground">{r.old_value}</td>
                <td className="py-2 pr-3">{r.new_value}</td>
                <td className="py-2">{r.reason}</td>
              </tr>
            ))}
            {(riwayat.data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  Belum ada koreksi tercatat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
