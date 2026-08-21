import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { budgetLinesQuery } from "@/lib/queries";
import { useSession } from "@/hooks/use-session";
import { rupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, ChevronsUpDown, Sparkles, X, HeartHandshake, Mail, Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BULAN_PANJANG } from "@/lib/kolom";

const schema = z.object({
  trx_date: z.string().min(1, "Tanggal wajib diisi"),
  category: z.string().max(150),
  budget_line_id: z.string().uuid("Mata anggaran wajib dipilih"),
  amount: z.number().positive("Nominal harus lebih dari 0").max(1_000_000_000_000),
  description: z.string().trim().max(500),
  payee: z.string().trim().max(150).optional(),
});

const DAFTAR_KOLOM = Array.from({ length: 29 }, (_, i) => i + 1);

const PRESET_KOLOM = [
  { code: "1.3.53.01", nama: "Ibadah Perkunjungan Keluarga (Rutin Kolom)", prefix: "Persembahan Ibadah Kolom" },
  { code: "1.3.53.02", nama: "Pria/Kaum Bapa (PKB) Kolom", prefix: "PKB Kolom" },
  { code: "1.3.53.03", nama: "Wanita/Kaum Ibu (WKI) Kolom", prefix: "WKI Kolom" },
  { code: "1.3.53.04", nama: "Pemuda Kolom", prefix: "Pemuda Kolom" },
  { code: "1.3.53.05", nama: "Remaja Kolom", prefix: "Remaja Kolom" },
  { code: "1.3.53.06", nama: "Anak Sekolah Minggu (ASM) Kolom", prefix: "ASM Kolom" },
  { code: "1.3.53.07", nama: "Syukur HUT / Khusus Kolom", prefix: "Syukur HUT Kolom" },
  { code: "1.3.57.01", nama: "Pembangunan dari Kolom", prefix: "Pembangunan Kolom" },
  { code: "1.3.01.01", nama: "BIPRA Aras: Pria/Kaum Bapa (PKB)", prefix: "PKB ARAS" },
  { code: "1.3.01.02", nama: "BIPRA Aras: Wanita/Kaum Ibu (WKI)", prefix: "WKI ARAS" },
  { code: "1.3.01.03", nama: "BIPRA Aras: Pemuda", prefix: "Pemuda ARAS" },
  { code: "1.3.01.04", nama: "BIPRA Aras: Remaja", prefix: "Remaja ARAS" },
  { code: "1.3.01.05", nama: "BIPRA Aras: Anak Sekolah Minggu (ASM)", prefix: "ASM ARAS" },
  { code: "1.3.01.08", nama: "BIPRA Aras: Lansia", prefix: "Lansia ARAS" },
];

const PRESET_SAMPUL = [
  { code: "1.3.66.14", nama: "Sampul PBTK (Keluarga, Kolom & Bulan)", label: "Sampul PBTK" },
  { code: "1.3.66.01", nama: "Sampul HUT Kelahiran", label: "Sampul HUT Kelahiran" },
  { code: "1.3.66.02", nama: "Sampul HUT Pernikahan", label: "Sampul HUT Pernikahan" },
  { code: "1.3.66.03", nama: "Sampul Pemberkatan/Pernikahan", label: "Sampul Pemberkatan Nikah" },
  { code: "1.3.66.04", nama: "Sampul Baptisan Kudus", label: "Sampul Baptisan Kudus" },
  { code: "1.3.66.05", nama: "Sampul Perjamuan Kudus", label: "Sampul Perjamuan Kudus" },
  { code: "1.3.66.06", nama: "Sampul Peneguhan Sidi", label: "Sampul Peneguhan Sidi" },
  { code: "1.3.66.07", nama: "Sampul Tahun Baru", label: "Sampul Tahun Baru" },
  { code: "1.3.66.08", nama: "Sampul Paskah", label: "Sampul Paskah" },
  { code: "1.3.66.11", nama: "Sampul Natal", label: "Sampul Natal" },
  { code: "1.3.66.12", nama: "Sampul Pengucapan Syukur", label: "Sampul Pengucapan Syukur" },
  { code: "1.3.66.13", nama: "Sampul Syukur Lainnya / Keluarga", label: "Sampul Syukur" },
  { code: "1.3.66.15", nama: "Sampul Syukur Pelantikan", label: "Sampul Pelantikan" },
  { code: "4.3.64.00", nama: "Sampul Pembangunan", label: "Sampul Pembangunan" },
  { code: "1.3.50.06", nama: "Sampul Persembahan Persepuluhan", label: "Sampul Persepuluhan" },
];

export function TransactionDialog({ kind }: { kind: "penerimaan" | "pengeluaran" }) {
  const { user, canManageFinance } = useSession();
  const budgets = useQuery(budgetLinesQuery);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [items, setItems] = useState([{ description: "", amount: "" }]);

  // Asisten Pintar
  const [asistenAktif, setAsistenAktif] = useState(false);
  const [asistenTab, setAsistenTab] = useState("sampul");

  // State Asisten Kolom & BIPRA
  const [pilihPresetKolom, setPilihPresetKolom] = useState("1.3.53.01");
  const [pilihKolom, setPilihKolom] = useState("1");
  const [pilihBulan, setPilihBulan] = useState(() => String(new Date().getMonth()));
  const [rincianTanggal, setRincianTanggal] = useState("");

  // State Asisten Dana Duka
  const [pilihKolomDuka, setPilihKolomDuka] = useState("1");
  const [jumlahDuka, setJumlahDuka] = useState("1 Duka");
  const [ketDuka, setKetDuka] = useState("");

  // State Asisten Sampul
  const [pilihPresetSampul, setPilihPresetSampul] = useState("1.3.66.14");
  const [jumlahSampul, setJumlahSampul] = useState("");
  const [pemberiSampul, setPemberiSampul] = useState("");

  // State Khusus Sampul PBTK
  const [pbtkKeluarga, setPbtkKeluarga] = useState("");
  const [pbtkKolom, setPbtkKolom] = useState("1");
  const [pbtkBulan, setPbtkBulan] = useState(() => String(new Date().getMonth()));
  const [pbtkPeriodeTeks, setPbtkPeriodeTeks] = useState("");

  const [form, setForm] = useState({
    trx_date: new Date().toISOString().slice(0, 10),
    category: "",
    budget_line_id: "",
    amount: "",
    description: "",
    payee: "",
  });

  const options = useMemo(() => (budgets.data ?? []).filter((b) => b.kind === kind), [budgets.data, kind]);
  const selected = options.find((b) => b.id === form.budget_line_id);

  // Fungsi helper untuk menerapkan format ke baris keterangan yang kosong tanpa mengganti yang sudah ada
  const applyDescriptionToEmpty = (ket: string, targetBudgetId?: string) => {
    if (targetBudgetId) {
      setForm((f) => ({ ...f, budget_line_id: targetBudgetId }));
    }

    setItems((prev) => {
      // Cari baris pertama yang keterangannya masih kosong
      const emptyIndex = prev.findIndex((it) => it.description.trim() === "");

      if (emptyIndex !== -1) {
        // Isi baris kosong tersebut, pertahankan nominal jika ada
        const targetRow = prev[emptyIndex]!;
        const updated = [...prev];
        updated[emptyIndex] = {
          description: ket,
          amount: targetRow.amount,
        };
        return updated;
      }

      // Jika semua baris yang ada sudah terisi dan masih kurang dari 5 baris, tambahkan baris baru
      if (prev.length < 5) {
        return [...prev, { description: ket, amount: "" }];
      }

      // Jika sudah mencapai 5 baris dan semuanya penuh
      toast.warning("Maksimal 5 baris tercapai. Kosongkan salah satu baris untuk menerapkan keterangan baru.");
      return prev;
    });

    toast.success(`Keterangan diterapkan: "${ket}"`);
  };

  // Terapkan Asisten Kolom & BIPRA
  const terapkanKolom = () => {
    const preset = PRESET_KOLOM.find((p) => p.code === pilihPresetKolom);
    const targetBudget = options.find((b) => b.code === pilihPresetKolom);
    const bulanNama = BULAN_PANJANG[Number(pilihBulan)] ?? "Januari";
    const tglPart = rincianTanggal.trim() ? ` (${rincianTanggal.trim()})` : "";
    
    let ket = "";
    if (preset?.code.startsWith("1.3.01")) {
      ket = `${preset.prefix}${tglPart} Bulan ${bulanNama}`;
    } else {
      ket = `${preset?.prefix || "Setoran"} ${pilihKolom}${tglPart} Bulan ${bulanNama}`;
    }

    applyDescriptionToEmpty(ket, targetBudget?.id);
  };

  // Terapkan Asisten Dana Duka
  const terapkanDuka = () => {
    const targetBudget =
      options.find((b) => b.code === "3.3.03.01" || b.code === "1.3.55.01") ||
      options.find((b) => /dana duka/i.test(b.name));
    const dukaCount = jumlahDuka.trim() ? ` (${jumlahDuka.trim()})` : "";
    const extra = ketDuka.trim() ? ` - ${ketDuka.trim()}` : "";
    const ket = `Dana Duka Kolom ${pilihKolomDuka}${dukaCount}${extra}`;

    applyDescriptionToEmpty(ket, targetBudget?.id);
  };

  // Terapkan Asisten Sampul
  const terapkanSampul = () => {
    const preset = PRESET_SAMPUL.find((p) => p.code === pilihPresetSampul);
    const targetBudget = options.find((b) => b.code === pilihPresetSampul);

    let ket = "";
    if (pilihPresetSampul === "1.3.66.14") {
      // Khusus PBTK
      const namaKel = pbtkKeluarga.trim()
        ? pbtkKeluarga.trim().toLowerCase().startsWith("kel")
          ? pbtkKeluarga.trim()
          : `Kel ${pbtkKeluarga.trim()}`
        : "";
      const kelPart = namaKel ? ` ${namaKel}` : "";
      const blnPart = pbtkPeriodeTeks.trim()
        ? ` (${pbtkPeriodeTeks.trim()})`
        : ` Bulan ${BULAN_PANJANG[Number(pbtkBulan)]}`;
      ket = `PBTK${kelPart} Kolom ${pbtkKolom}${blnPart}`;
    } else {
      // Sampul Lainnya
      const jlhPart = jumlahSampul.trim() ? `${jumlahSampul.trim()} ` : "";
      const namaPart = pemberiSampul.trim() ? ` (${pemberiSampul.trim()})` : "";
      ket = `${jlhPart}${preset?.label || "Sampul"}${namaPart}`;
    }

    applyDescriptionToEmpty(ket, targetBudget?.id);
  };

  const totalNominal =
    kind === "penerimaan"
      ? items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0)
      : Number(form.amount) || 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const baris =
        kind === "penerimaan"
          ? items.filter((i) => i.amount !== "" || i.description.trim() !== "")
          : [{ description: form.description, amount: form.amount }];
      if (baris.length === 0) throw new Error("Minimal satu keterangan wajib diisi");
      const rows = baris.map((b) => {
        const parsed = schema.parse({
          ...form,
          description: b.description,
          amount: Number(b.amount),
          payee: form.payee || undefined,
        });
        return {
          trx_date: parsed.trx_date,
          kind,
          category: "",
          budget_line_id: parsed.budget_line_id,
          amount: parsed.amount,
          description: parsed.description,
          payee: kind === "pengeluaran" ? (parsed.payee ?? null) : null,
          payment_method: null,
          attachment_url: null,
          status: "approved" as const,
          created_by: user!.id,
          voucher_no: "",
        };
      });
      const { error } = await supabase.from("transactions").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(
        kind === "penerimaan"
          ? `${count} penerimaan tercatat & tersinkronisasi`
          : "Pengeluaran berhasil dicatat",
      );
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setOpen(false);
      setItems([{ description: "", amount: "" }]);
      setForm((f) => ({ ...f, amount: "", description: "", payee: "" }));
      setAsistenAktif(false);
    },
    onError: (err) => {
      toast.error(
        err instanceof z.ZodError
          ? (err.issues[0]?.message ?? "Data tidak valid")
          : err instanceof Error
            ? err.message
            : "Gagal menyimpan",
      );
    },
  });

  if (!canManageFinance) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          {kind === "penerimaan" ? "Catat Penerimaan" : "Catat Pengeluaran"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-lg font-bold">
            {kind === "penerimaan" ? "Catat Penerimaan Kas" : "Catat Pengeluaran Kas"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {kind === "penerimaan"
              ? "Catat setoran ibadah kolom, BIPRA, sampul PBTK, sampul-sampul, atau penerimaan kas umum."
              : "Nomor bukti dibuat otomatis oleh sistem setelah transaksi disimpan."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {/* Baris 1: Tanggal & Mata Anggaran (Proporsional 2 Kolom) */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tanggal" className="text-xs font-semibold">
                Tanggal Transaksi <span className="text-destructive">*</span>
              </Label>
              <DateInput
                id="tanggal"
                value={form.trx_date}
                onChange={(val) => setForm({ ...form, trx_date: val })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Mata Anggaran <span className="text-destructive">*</span>
              </Label>
              <Popover open={budgetOpen} onOpenChange={setBudgetOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={budgetOpen}
                    className="w-full justify-between font-normal h-9 text-xs"
                  >
                    <span className="truncate">
                      {selected ? `${selected.code} — ${selected.name}` : "Pilih kode mata anggaran…"}
                    </span>
                    <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[340px] sm:w-[380px] p-0" align="end">
                  <Command
                    filter={(value, search) =>
                      value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                    }
                  >
                    <CommandInput placeholder="Cari kode atau nama mata anggaran…" />
                    <CommandList>
                      <CommandEmpty>Mata anggaran tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                        {options.map((b) => (
                          <CommandItem
                            key={b.id}
                            value={`${b.code} ${b.name}`}
                            onSelect={() => {
                              setForm({ ...form, budget_line_id: b.id });
                              setBudgetOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 size-3.5",
                                form.budget_line_id === b.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="font-mono text-xs font-semibold">{b.code}</span>
                            <span className="truncate text-xs">{b.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Toggle Asisten Pengisian Cepat */}
          {kind === "penerimaan" && (
            <div className="rounded-lg border bg-muted/20 p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span className="text-xs font-semibold">Bantuan Generator Format Standar</span>
                </div>
                <Button
                  type="button"
                  variant={asistenAktif ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAsistenAktif(!asistenAktif)}
                  className="h-7 text-xs px-2.5 font-medium gap-1"
                >
                  {asistenAktif ? "Sembunyikan Asisten" : "Buka Asisten Pengisian"}
                </Button>
              </div>

              {/* Panel Asisten yang Proporsional */}
              {asistenAktif && (
                <div className="mt-3 pt-3 border-t border-border/60">
                  <Tabs value={asistenTab} onValueChange={setAsistenTab}>
                    <TabsList className="grid grid-cols-3 h-8 bg-background border p-0.5">
                      <TabsTrigger value="sampul" className="text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <Mail className="size-3.5" /> Sampul & PBTK
                      </TabsTrigger>
                      <TabsTrigger value="duka" className="text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <HeartHandshake className="size-3.5" /> Dana Duka
                      </TabsTrigger>
                      <TabsTrigger value="kolom" className="text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <Users className="size-3.5" /> Kolom & BIPRA
                      </TabsTrigger>
                    </TabsList>

                    {/* ASISTEN 1: SAMPUL & PBTK */}
                    <TabsContent value="sampul" className="space-y-3 pt-2.5">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Jenis Sampul</Label>
                        <Select value={pilihPresetSampul} onValueChange={setPilihPresetSampul}>
                          <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            {PRESET_SAMPUL.map((s) => (
                              <SelectItem key={s.code} value={s.code} className="text-xs">
                                <span className="font-mono text-[11px] mr-1 text-muted-foreground">{s.code}</span> {s.nama}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {pilihPresetSampul === "1.3.66.14" ? (
                        <div className="rounded-md border bg-background p-3 space-y-2.5">
                          <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                            <Mail className="size-3.5" /> Data Setoran Sampul PBTK
                          </div>
                          <div className="grid gap-2.5 sm:grid-cols-3">
                            <div className="space-y-1 sm:col-span-3">
                              <Label className="text-xs">Nama Keluarga / Penyetor</Label>
                              <Input
                                value={pbtkKeluarga}
                                onChange={(e) => setPbtkKeluarga(e.target.value)}
                                placeholder="Misal: Montori Kansil / Krisen Roeroe"
                                className="h-8 text-xs font-medium"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Nomor Kolom</Label>
                              <Select value={pbtkKolom} onValueChange={setPbtkKolom}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                  {DAFTAR_KOLOM.map((k) => (
                                    <SelectItem key={k} value={String(k)} className="text-xs">
                                      Kolom {k}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Bulan Setoran</Label>
                              <Select value={pbtkBulan} onValueChange={setPbtkBulan}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                  {BULAN_PANJANG.map((b, i) => (
                                    <SelectItem key={b} value={String(i)} className="text-xs">
                                      {b}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Rentang Bulan (Opsional)</Label>
                              <Input
                                value={pbtkPeriodeTeks}
                                onChange={(e) => setPbtkPeriodeTeks(e.target.value)}
                                placeholder="Misal: Jan - Jun"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-2.5 sm:grid-cols-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Jumlah Lembar (Opsional)</Label>
                            <Input
                              value={jumlahSampul}
                              onChange={(e) => setJumlahSampul(e.target.value)}
                              placeholder="Misal: 5 Sampul"
                              className="h-8 text-xs bg-background"
                            />
                          </div>

                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">Keluarga / Kolom / Catatan (Opsional)</Label>
                            <Input
                              value={pemberiSampul}
                              onChange={(e) => setPemberiSampul(e.target.value)}
                              placeholder="Misal: Kel. Montori Kolom 4"
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end pt-1">
                        <Button type="button" size="sm" variant="secondary" onClick={terapkanSampul} className="h-7 text-xs font-semibold">
                          Terapkan Format Sampul
                        </Button>
                      </div>
                    </TabsContent>

                    {/* ASISTEN 2: DANA DUKA */}
                    <TabsContent value="duka" className="space-y-3 pt-2.5">
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Pilih Kolom</Label>
                          <Select value={pilihKolomDuka} onValueChange={setPilihKolomDuka}>
                            <SelectTrigger className="h-8 text-xs bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              {DAFTAR_KOLOM.map((k) => (
                                <SelectItem key={k} value={String(k)} className="text-xs">
                                  Kolom {k}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Jumlah Duka</Label>
                          <Select value={jumlahDuka} onValueChange={setJumlahDuka}>
                            <SelectTrigger className="h-8 text-xs bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1 Duka" className="text-xs">1 Duka</SelectItem>
                              <SelectItem value="2 Duka" className="text-xs">2 Duka</SelectItem>
                              <SelectItem value="3 Duka" className="text-xs">3 Duka</SelectItem>
                              <SelectItem value="4 Duka" className="text-xs">4 Duka</SelectItem>
                              <SelectItem value="5 Duka" className="text-xs">5 Duka</SelectItem>
                              <SelectItem value="Bulan Berjalan" className="text-xs">Bulan Berjalan</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Nama Alm / Keterangan</Label>
                          <Input
                            value={ketDuka}
                            onChange={(e) => setKetDuka(e.target.value)}
                            placeholder="Opsional (mis. Kel. X)"
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <Button type="button" size="sm" variant="secondary" onClick={terapkanDuka} className="h-7 text-xs font-semibold">
                          Terapkan Format Dana Duka
                        </Button>
                      </div>
                    </TabsContent>

                    {/* ASISTEN 3: KOLOM & BIPRA */}
                    <TabsContent value="kolom" className="space-y-3 pt-2.5">
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Jenis Setoran / Kompelka</Label>
                          <Select value={pilihPresetKolom} onValueChange={setPilihPresetKolom}>
                            <SelectTrigger className="h-8 text-xs bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              {PRESET_KOLOM.map((p) => (
                                <SelectItem key={p.code} value={p.code} className="text-xs">
                                  {p.nama}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {!pilihPresetKolom.startsWith("1.3.01") && (
                          <div className="space-y-1">
                            <Label className="text-xs">Nomor Kolom</Label>
                            <Select value={pilihKolom} onValueChange={setPilihKolom}>
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-64">
                                {DAFTAR_KOLOM.map((k) => (
                                  <SelectItem key={k} value={String(k)} className="text-xs">
                                    Kolom {k}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="space-y-1">
                          <Label className="text-xs">Bulan Setoran</Label>
                          <Select value={pilihBulan} onValueChange={setPilihBulan}>
                            <SelectTrigger className="h-8 text-xs bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              {BULAN_PANJANG.map((b, i) => (
                                <SelectItem key={b} value={String(i)} className="text-xs">
                                  {b}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Tgl Ibadah (mis. 12, 19, 26)</Label>
                          <Input
                            value={rincianTanggal}
                            onChange={(e) => setRincianTanggal(e.target.value)}
                            placeholder="Contoh: 12, 19, 26"
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <Button type="button" size="sm" variant="secondary" onClick={terapkanKolom} className="h-7 text-xs font-semibold">
                          Terapkan Format Kolom
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          )}

          {/* Bagian Rincian Keterangan & Nominal Transaksi */}
          {kind === "penerimaan" ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Rincian Keterangan & Nominal (maks. 5 baris)
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={items.length >= 5}
                  onClick={() => setItems([...items, { description: "", amount: "" }])}
                  className="h-7 text-xs px-2.5 gap-1"
                >
                  <Plus className="size-3.5" /> Tambah Baris
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_12rem_auto] gap-2 items-center">
                    <Input
                      value={it.description}
                      onChange={(e) =>
                        setItems(
                          items.map((x, i) =>
                            i === idx ? { ...x, description: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder={`Keterangan baris ${idx + 1}`}
                      maxLength={500}
                      className="h-9 text-xs"
                    />
                    <div className="relative">
                      <Input
                        type="number"
                        min={1}
                        value={it.amount}
                        onChange={(e) =>
                          setItems(items.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))
                        }
                        placeholder="Nominal (Rp)"
                        className="h-9 text-xs font-mono font-medium pl-3"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={items.length === 1}
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      aria-label="Hapus baris"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="nominal" className="text-xs font-semibold">
                  Nominal (Rp) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nominal"
                  type="number"
                  min={1}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  required
                  className="h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="penerima" className="text-xs font-semibold">Penerima</Label>
                <Input
                  id="penerima"
                  value={form.payee}
                  onChange={(e) => setForm({ ...form, payee: e.target.value })}
                  placeholder="Nama penerima atau vendor"
                  maxLength={150}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ket" className="text-xs font-semibold">Keterangan</Label>
                <Textarea
                  id="ket"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Uraian pengeluaran kas"
                  maxLength={500}
                  className="text-xs"
                />
              </div>
            </>
          )}

          {/* Ringkasan Total Transaksi (Proporsional & Jelas) */}
          <div className="flex items-center justify-between rounded-lg border bg-primary/5 px-4 py-3">
            <div>
              <span className="text-xs text-muted-foreground font-medium block">
                Total Transaksi {kind === "penerimaan" && items.length > 1 ? `(${items.length} rincian)` : ""}
              </span>
              <span className="text-xs text-muted-foreground">Nomor bukti dibuat otomatis</span>
            </div>
            <span className="text-lg font-bold font-mono text-primary">{rupiah(totalNominal)}</span>
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? "Menyimpan…" : "Simpan Transaksi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}