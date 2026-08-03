import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { transactionsQuery } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

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

function RincianUangPage() {
  const trx = useQuery(transactionsQuery);
  const [date, setDate] = useState(todayStr);
  const [counts, setCounts] = useState<number[]>(() => DENOMS.map(() => 0));
  const [note, setNote] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(date));
      const saved = raw ? JSON.parse(raw) : null;
      setCounts(
        Array.isArray(saved?.counts) && saved.counts.length === DENOMS.length
          ? saved.counts.map((n: unknown) => Number(n) || 0)
          : DENOMS.map(() => 0),
      );
      setNote(typeof saved?.note === "string" ? saved.note : "");
    } catch {
      setCounts(DENOMS.map(() => 0));
      setNote("");
    }
  }, [date]);

  const all = trx.data ?? [];

  const saldoKas = useMemo(
    () =>
      all
        .filter((t) => t.trx_date <= date)
        .reduce((a, t) => a + (t.kind === "penerimaan" ? Number(t.amount) : -Number(t.amount)), 0),
    [all, date],
  );

  const totalFisik = counts.reduce((a, c, i) => a + c * DENOMS[i]!.v, 0);
  const selisih = totalFisik - saldoKas;
  const cocok = selisih === 0;
  const totalLembar = counts.reduce((a, c) => a + c, 0);

  function setCount(i: number, val: string) {
    const n = Math.max(0, Math.floor(Number(val.replace(/\D/g, "")) || 0));
    setCounts((prev) => prev.map((c, idx) => (idx === i ? n : c)));
  }

  function simpan() {
    localStorage.setItem(storageKey(date), JSON.stringify({ counts, note }));
  }

  function reset() {
    setCounts(DENOMS.map(() => 0));
    setNote("");
    localStorage.removeItem(storageKey(date));
  }

  return (
    <AppShell
      title="Rincian Uang Kas"
      subtitle="Hitung fisik uang per pecahan dan cocokkan dengan saldo kas pada tanggal terpilih"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}>
            Reset
          </Button>
          <Button onClick={simpan}>Simpan</Button>
        </div>
      }
    >
      <div className="panel mb-5 flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">Tanggal</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="min-w-[260px] flex-1 space-y-1.5">
          <Label htmlFor="note">Keterangan Kasir</Label>
          <Input
            id="note"
            placeholder="Catatan penghitungan kas"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Saldo Kas Sistem" value={rupiah(saldoKas)} />
        <Stat label="Total Uang Fisik" value={rupiah(totalFisik)} />
        <Stat
          label="Selisih"
          value={rupiah(selisih)}
          tone={cocok ? "ok" : "bad"}
        />
        <Stat label="Jumlah Lembar / Keping" value={String(totalLembar)} />
      </div>

      <div
        className={
          "panel mt-5 flex items-start gap-3 p-4 " +
          (cocok ? "border-emerald-500/40" : "border-destructive/50")
        }
      >
        {cocok ? (
          <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
        ) : (
          <AlertTriangle className="mt-0.5 size-5 text-destructive" />
        )}
        <div>
          <p className={"font-semibold " + (cocok ? "text-emerald-600" : "text-destructive")}>
            {cocok
              ? "Rincian uang SESUAI dengan saldo kas"
              : selisih > 0
                ? "Uang fisik LEBIH dari saldo kas"
                : "Uang fisik KURANG dari saldo kas"}
          </p>
          <p className="text-sm text-muted-foreground">
            Saldo kas {tanggal(date)} sebesar {rupiah(saldoKas)}, uang fisik terhitung{" "}
            {rupiah(totalFisik)}
            {cocok ? "." : ` — selisih ${rupiah(Math.abs(selisih))}. Mohon periksa kembali perhitungan atau pencatatan transaksi.`}
          </p>
        </div>
      </div>

      <section className="panel mt-5 overflow-x-auto p-5">
        <h2 className="text-base font-semibold">Rincian Pecahan</h2>
        <table className="mt-4 w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Pecahan</th>
              <th className="py-2 pr-3">Jenis</th>
              <th className="py-2 pr-3 w-40">Jumlah</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {DENOMS.map((d, i) => (
              <tr key={d.label} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium">{d.label}</td>
                <td className="py-2 pr-3 text-muted-foreground">{d.type}</td>
                <td className="py-2 pr-3">
                  <Input
                    inputMode="numeric"
                    value={counts[i] === 0 ? "" : String(counts[i])}
                    placeholder="0"
                    onChange={(e) => setCount(i, e.target.value)}
                    className="h-9"
                  />
                </td>
                <td className="py-2 text-right font-medium">{rupiah(counts[i]! * d.v)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40">
              <td className="py-2 pr-3 font-semibold" colSpan={2}>
                Total Uang Fisik
              </td>
              <td className="py-2 pr-3 text-right font-semibold">{totalLembar}</td>
              <td className="py-2 text-right font-semibold">{rupiah(totalFisik)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          "mt-1 text-xl font-semibold " +
          (tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-destructive" : "")
        }
      >
        {value}
      </p>
    </div>
  );
}
