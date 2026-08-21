import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { transactionsQuery, isInternalCash } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { normalizeDateInput } from "@/components/ui/date-input";
import { exportAoa } from "@/lib/xlsx";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle2,
  Save,
  RotateCcw,
  Download,
  History,
  Info,
} from "lucide-react";

const plusDays = (isoDate: string, days: number) => {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const Route = createFileRoute("/_authenticated/rincian-uang")({
  head: () => ({
    meta: [
      { title: "Rincian Uang Kas — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Hitung rincian fisik uang kas per pecahan dan cocokkan dengan saldo kas harian gereja.",
      },
      { property: "og:title", content: "Rincian Uang Kas — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Perhitungan kepingan uang kasir dan pencocokan dengan saldo kas hari itu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RincianUangPage,
});

const DENOMS = [
  { v: 100000, label: "Rp 100.000", type: "Kertas" },
  { v: 75000, label: "Rp 75.000", type: "Kertas" },
  { v: 50000, label: "Rp 50.000", type: "Kertas" },
  { v: 20000, label: "Rp 20.000", type: "Kertas" },
  { v: 10000, label: "Rp 10.000", type: "Kertas" },
  { v: 5000, label: "Rp 5.000", type: "Kertas" },
  { v: 2000, label: "Rp 2.000", type: "Kertas" },
  { v: 1000, label: "Rp 1.000", type: "Kertas" },
  { v: 1000, label: "Rp 1.000 (logam)", type: "Logam" },
  { v: 500, label: "Rp 500", type: "Logam" },
  { v: 200, label: "Rp 200", type: "Logam" },
  { v: 100, label: "Rp 100", type: "Logam" },
] as const;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const storageKey = (date: string) => `bumotik.rincian-uang.${date}`;
const indexKey = "bumotik.rincian-uang.index";

function getSavedIndex(): string[] {
  try {
    const raw = localStorage.getItem(indexKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function updateSavedIndex(date: string) {
  try {
    const prev = getSavedIndex();
    if (!prev.includes(date)) {
      const next = [date, ...prev].sort().reverse();
      localStorage.setItem(indexKey, JSON.stringify(next));
    }
  } catch {
    // ignore
  }
}

function removeFromIndex(date: string) {
  try {
    const prev = getSavedIndex();
    const next = prev.filter((d) => d !== date);
    localStorage.setItem(indexKey, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function RincianUangPage() {
  const trx = useQuery(transactionsQuery);
  const [date, setDate] = useState(todayStr);
  const [counts, setCounts] = useState<number[]>(() => DENOMS.map(() => 0));
  const [note, setNote] = useState("");
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [modeSaldo, setModeSaldo] = useState<"minggu" | "kumulatif" | "harian">("minggu");

  // Cut-off warta terakhir (default 14 Agustus 2026)
  const savedWartaCutoff = typeof window !== "undefined" ? localStorage.getItem("bumotik.tglTerakhirWarta") || "2026-08-14" : "2026-08-14";
  const tglMulaiKasMinggu = useMemo(
    () => plusDays(normalizeDateInput(savedWartaCutoff), 1) || "2026-08-15",
    [savedWartaCutoff],
  );

  // Muat data saat tanggal berubah
  useEffect(() => {
    try {
      setSavedDates(getSavedIndex());
      const raw = localStorage.getItem(storageKey(date));
      if (raw) {
        const saved = JSON.parse(raw);
        setCounts(
          Array.isArray(saved?.counts) && saved.counts.length === DENOMS.length
            ? saved.counts.map((n: unknown) => Number(n) || 0)
            : DENOMS.map(() => 0),
        );
        setNote(typeof saved?.note === "string" ? saved.note : "");
        setLastSavedTime(saved?.savedAt ? new Date(saved.savedAt).toLocaleTimeString("id-ID") : "Tersimpan");
        if (saved?.modeSaldo) setModeSaldo(saved.modeSaldo);
      } else {
        setCounts(DENOMS.map(() => 0));
        setNote("");
        setLastSavedTime(null);
      }
    } catch {
      setCounts(DENOMS.map(() => 0));
      setNote("");
      setLastSavedTime(null);
    }
  }, [date]);

  const all = useMemo(
    () => (trx.data ?? []).filter((t) => t.status !== "rejected" && !isInternalCash(t)),
    [trx.data],
  );

  // 1. Saldo Kas Minggu Berjalan (15 Ags s/d date) -> Rp 8.446.000
  const saldoKasMingguBerjalan = useMemo(() => {
    const masuk = all
      .filter((t) => t.kind === "penerimaan" && t.trx_date >= tglMulaiKasMinggu && t.trx_date <= date)
      .reduce((a, t) => a + Number(t.amount || 0), 0);
    const keluar = all
      .filter((t) => t.kind === "pengeluaran" && t.status === "approved" && t.trx_date >= tglMulaiKasMinggu && t.trx_date <= date)
      .reduce((a, t) => a + Number(t.amount || 0), 0);
    return masuk - keluar;
  }, [all, tglMulaiKasMinggu, date]);

  // 2. Saldo Kas Kumulatif (Awal tahun s/d date) -> Rp 4.878.000
  const saldoKasKumulatif = useMemo(() => {
    const masuk = all
      .filter((t) => t.kind === "penerimaan" && t.trx_date <= date)
      .reduce((a, t) => a + Number(t.amount || 0), 0);
    const keluar = all
      .filter((t) => t.kind === "pengeluaran" && t.status === "approved" && t.trx_date <= date)
      .reduce((a, t) => a + Number(t.amount || 0), 0);
    return masuk - keluar;
  }, [all, date]);

  // 3. Saldo Kas Hari Ini (Khusus tanggal terpilih)
  const saldoKasHarian = useMemo(() => {
    const masuk = all
      .filter((t) => t.kind === "penerimaan" && t.trx_date === date)
      .reduce((a, t) => a + Number(t.amount || 0), 0);
    const keluar = all
      .filter((t) => t.kind === "pengeluaran" && t.status === "approved" && t.trx_date === date)
      .reduce((a, t) => a + Number(t.amount || 0), 0);
    return masuk - keluar;
  }, [all, date]);

  // Saldo acuan sistem yang dipilih
  const saldoKasTarget =
    modeSaldo === "minggu"
      ? saldoKasMingguBerjalan
      : modeSaldo === "kumulatif"
        ? saldoKasKumulatif
        : saldoKasHarian;

  const totalFisik = counts.reduce((a, c, i) => a + c * DENOMS[i]!.v, 0);
  const selisih = totalFisik - saldoKasTarget;
  const cocok = selisih === 0;
  const totalLembar = counts.reduce((a, c) => a + c, 0);

  function setCount(i: number, val: string) {
    const n = Math.max(0, Math.floor(Number(val.replace(/\D/g, "")) || 0));
    setCounts((prev) => prev.map((c, idx) => (idx === i ? n : c)));
  }

  function simpan() {
    try {
      const now = new Date().toISOString();
      const payload = { counts, note, savedAt: now, date, totalFisik, saldoKas: saldoKasTarget, modeSaldo };
      localStorage.setItem(storageKey(date), JSON.stringify(payload));
      updateSavedIndex(date);
      setSavedDates(getSavedIndex());
      setLastSavedTime(new Date(now).toLocaleTimeString("id-ID"));
      toast.success(`Rincian uang kas tanggal ${tanggal(date)} berhasil disimpan!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan rincian uang kas");
    }
  }

  function reset() {
    setCounts(DENOMS.map(() => 0));
    setNote("");
    setLastSavedTime(null);
    localStorage.removeItem(storageKey(date));
    removeFromIndex(date);
    setSavedDates(getSavedIndex());
    toast.info(`Rincian uang kas tanggal ${tanggal(date)} telah direset.`);
  }

  function downloadExcel() {
    const labelMode =
      modeSaldo === "minggu"
        ? `Kas Minggu Berjalan (${tglMulaiKasMinggu} s/d ${date})`
        : modeSaldo === "kumulatif"
          ? `Kas Kumulatif Buku Kas Umum (s/d ${date})`
          : `Kas Harian (${date})`;

    const rows = [
      ["BERITA ACARA RINCIAN FISIK UANG KAS"],
      ["BUMOTIK FINANCIAL - GMIM BUKIT MORIA TIKALA BARU"],
      [],
      ["Tanggal Perhitungan", tanggal(date)],
      ["Basis Saldo Sistem", labelMode],
      ["Keterangan / Kasir", note || "-"],
      ["Waktu Export", new Date().toLocaleString("id-ID")],
      [],
      ["NO", "PECAHAN", "JENIS", "JUMLAH (LEMBAR/KEPING)", "SUBTOTAL (RP)"],
      ...DENOMS.map((d, i) => [
        i + 1,
        d.label,
        d.type,
        counts[i] || 0,
        (counts[i] || 0) * d.v,
      ]),
      [],
      ["TOTAL UANG FISIK", "", "", totalLembar, totalFisik],
      ["SALDO KAS SISTEM", "", "", "", saldoKasTarget],
      ["SELISIH", "", "", "", selisih],
      ["STATUS PENCATATAN", "", "", "", cocok ? "SESUAI (SEIMBANG)" : selisih > 0 ? "LEBIH" : "KURANG"],
    ];

    const filename = `Rincian_Uang_Kas_${date}.xlsx`;
    exportAoa(rows, filename, "Rincian Kas", [6, 20, 15, 25, 20]);
    toast.success(`Rincian uang berhasil diekspor ke Excel: ${filename}`);
  }

  return (
    <AppShell
      title="Rincian Uang Kas"
      subtitle="Hitung fisik uang per pecahan dan cocokkan dengan saldo kas pada tanggal terpilih"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadExcel} className="gap-1.5 text-xs">
            <Download className="size-3.5 text-success" />
            Download Excel
          </Button>
          <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-xs text-destructive hover:text-destructive">
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
          <Button size="sm" onClick={simpan} className="gap-1.5 text-xs font-semibold">
            <Save className="size-3.5" />
            Simpan Rincian
          </Button>
        </div>
      }
    >
      {/* Pilihan Basis Saldo Kas yang Dicocokkan */}
      <div className="panel mb-4 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Info className="size-4 text-primary" />
              Pilih Acuan Saldo Kas Sistem yang Dicocokkan:
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pilih apakah uang fisik dicocokkan dengan saldo kas minggu berjalan atau saldo kas kumulatif.
            </p>
          </div>

          <Tabs value={modeSaldo} onValueChange={(v) => setModeSaldo(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="minggu" className="text-xs font-semibold px-3">
                Kas Minggu Berjalan ({rupiah(saldoKasMingguBerjalan)})
              </TabsTrigger>
              <TabsTrigger value="kumulatif" className="text-xs font-semibold px-3">
                Kas Kumulatif ({rupiah(saldoKasKumulatif)})
              </TabsTrigger>
              <TabsTrigger value="harian" className="text-xs font-semibold px-3">
                Harian ({rupiah(saldoKasHarian)})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Baris Filter Tanggal & Keterangan */}
      <div className="panel mb-5 p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="date" className="text-xs font-semibold">
              Tanggal Perhitungan
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="min-w-[260px] flex-1 space-y-1.5">
            <Label htmlFor="note" className="text-xs font-semibold">
              Keterangan / Nama Petugas Kasir
            </Label>
            <Input
              id="note"
              placeholder="Contoh: Penghitungan kas fisik oleh Bendahara Jemaat"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            {lastSavedTime ? (
              <Badge variant="outline" className="h-8 gap-1 font-medium bg-emerald-50 text-emerald-700 border-emerald-300">
                <CheckCircle2 className="size-3.5 text-emerald-600" /> Tersimpan ({lastSavedTime})
              </Badge>
            ) : (
              <Badge variant="outline" className="h-8 text-muted-foreground">
                Belum Disimpan
              </Badge>
            )}
          </div>
        </div>

        {/* Daftar Arsip Tanggal yang Pernah Disimpan */}
        {savedDates.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t text-xs text-muted-foreground">
            <History className="size-3.5 text-primary" />
            <span className="font-medium">Arsip Tersimpan:</span>
            {savedDates.slice(0, 8).map((d) => (
              <Button
                key={d}
                type="button"
                variant={date === d ? "secondary" : "ghost"}
                size="sm"
                className="h-6 text-[11px] px-2"
                onClick={() => setDate(d)}
              >
                {tanggal(d)}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Kartu Ringkasan Saldo & Uang Fisik */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={
            modeSaldo === "minggu"
              ? "Saldo Kas Minggu Berjalan"
              : modeSaldo === "kumulatif"
                ? "Saldo Kas Kumulatif"
                : "Saldo Kas Hari Ini"
          }
          value={rupiah(saldoKasTarget)}
        />
        <Stat label="Total Uang Fisik" value={rupiah(totalFisik)} />
        <Stat
          label="Selisih"
          value={rupiah(selisih)}
          tone={cocok ? "ok" : "bad"}
        />
        <Stat label="Jumlah Lembar / Keping" value={`${totalLembar} keping/lembar`} />
      </div>

      {/* Banner Notifikasi Status Kecocokan Kas */}
      <div
        className={
          "panel mt-5 flex items-start gap-3 p-4 " +
          (cocok ? "border-emerald-500/40 bg-emerald-50/20" : "border-destructive/50 bg-destructive/5")
        }
      >
        {cocok ? (
          <CheckCircle2 className="mt-0.5 size-5 text-emerald-600 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 size-5 text-destructive shrink-0" />
        )}
        <div className="space-y-0.5">
          <p className={"font-semibold text-sm " + (cocok ? "text-emerald-700" : "text-destructive")}>
            {cocok
              ? "✓ Rincian uang kas SESUAI & COCOK dengan saldo sistem"
              : selisih > 0
                ? "⚠ Uang fisik LEBIH dari saldo kas sistem"
                : "⚠ Uang fisik KURANG dari saldo kas sistem"}
          </p>
          <p className="text-xs text-muted-foreground">
            Saldo kas acuan sistem ({modeSaldo === "minggu" ? "Minggu Berjalan" : modeSaldo === "kumulatif" ? "Kumulatif Buku Kas" : "Harian"}) per {tanggal(date)} sebesar <strong>{rupiah(saldoKasTarget)}</strong>, total uang fisik terhitung{" "}
            <strong>{rupiah(totalFisik)}</strong>
            {cocok
              ? ". Data fisik dan kas telah seimbang sempurna."
              : ` — terdapat selisih ${rupiah(Math.abs(selisih))}. Mohon periksa kembali kepingan uang atau transaksi yang belum tercatat.`}
          </p>
        </div>
      </div>

      {/* Tabel Rincian Pecahan Uang */}
      <section className="panel mt-5 overflow-x-auto p-5">
        <div className="flex items-center justify-between border-b pb-3 mb-3">
          <div>
            <h2 className="text-base font-bold text-foreground">Rincian Lembaran & Kepingan Pecahan</h2>
            <p className="text-xs text-muted-foreground">Ketik jumlah lembar atau keping pada setiap kolom pecahan</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground block">Total Fisik:</span>
            <span className="text-lg font-bold font-mono text-primary">{rupiah(totalFisik)}</span>
          </div>
        </div>

        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/20">
              <th className="py-2.5 px-3">Pecahan</th>
              <th className="py-2.5 px-3">Jenis</th>
              <th className="py-2.5 px-3 w-48 text-center">Jumlah Lembar / Keping</th>
              <th className="py-2.5 px-3 text-right">Subtotal (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {DENOMS.map((d, i) => (
              <tr key={d.label} className="border-b last:border-0 hover:bg-muted/10">
                <td className="py-2.5 px-3 font-semibold text-foreground">{d.label}</td>
                <td className="py-2.5 px-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px] py-0">
                    {d.type}
                  </Badge>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <Input
                    inputMode="numeric"
                    value={counts[i] === 0 ? "" : String(counts[i])}
                    placeholder="0"
                    onChange={(e) => setCount(i, e.target.value)}
                    className="h-9 text-center font-mono font-bold max-w-[140px] mx-auto"
                  />
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-semibold text-primary">
                  {rupiah(counts[i]! * d.v)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40 font-bold">
              <td className="py-3 px-3" colSpan={2}>
                Total Uang Fisik Kas
              </td>
              <td className="py-3 px-3 text-center font-mono text-sm">{totalLembar} lembar/keping</td>
              <td className="py-3 px-3 text-right font-mono text-base text-primary">{rupiah(totalFisik)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="flex items-center justify-between pt-4 mt-2 border-t">
          <div className="text-xs text-muted-foreground">
            Klik tombol <strong>Simpan Rincian</strong> untuk menyimpan rekapan kas tanggal ini.
          </div>
          <Button size="sm" onClick={simpan} className="gap-1.5 font-semibold text-xs">
            <Save className="size-3.5" /> Simpan Rincian Uang Kas
          </Button>
        </div>
      </section>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className="panel p-4 space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          "text-xl font-bold font-mono " +
          (tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-destructive" : "text-foreground")
        }
      >
        {value}
      </p>
    </div>
  );
}
