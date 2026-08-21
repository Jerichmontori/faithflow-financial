import { useState, useMemo, useEffect } from "react";
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
import { Check, ChevronsUpDown, Sparkles, X, HeartHandshake, Mail, Users, Plus, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { BULAN_PANJANG, standardizeDescription } from "@/lib/kolom";

const schema = z.object({
  trx_date: z.string().min(1, "Tanggal wajib diisi"),
  category: z.string().max(150),
  budget_line_id: z.string().uuid("Mata anggaran wajib dipilih"),
  amount: z.number().positive("Nominal harus lebih dari 0").max(1_000_000_000_000),
  description: z.string().trim().max(500),
  payee: z.string().trim().max(150).optional(),
  payment_method: z.string().optional().nullable(),
});

const DAFTAR_KOLOM = Array.from({ length: 29 }, (_, i) => i + 1);

const NAMA_PKB_ARAS = ["PKB Musafir", "PKB Abraham", "PKB ARAS"];
const NAMA_WKI_ARAS = [
  "WKI Martha Maria",
  "WKI Lidya",
  "WKI Ester Eunike",
  "WKI Debora",
  "WKI Sifra",
  "WKI Monika",
  "WKI Aras",
];
const NAMA_LANSIA_RAYON = [
  "Lansia Rayon 1",
  "Lansia Rayon 2",
  "Lansia Rayon 3",
  "Lansia Rayon 4",
  "Lansia Rayon 5",
  "Lansia Aras",
];
const NAMA_PEMUDA_ARAS = ["Pemuda Bethany", "Pemuda Imanuel", "Pemuda ARAS"];

export function TransactionDialog({ kind }: { kind: "penerimaan" | "pengeluaran" }) {
  const { user, canManageFinance } = useSession();
  const budgets = useQuery(budgetLinesQuery);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [items, setItems] = useState([{ description: "", amount: "" }]);

  // Asisten Pintar Terbuka Otomatis Sesuai Mata Anggaran
  const [asistenAktif, setAsistenAktif] = useState(true);

  // State Parameter Asisten
  const [pilihKolom, setPilihKolom] = useState("1");
  const [pilihBulan, setPilihBulan] = useState(() => String(new Date().getMonth()));
  const [rincianTanggal, setRincianTanggal] = useState("");
  const [namaPkbTerpilih, setNamaPkbTerpilih] = useState(NAMA_PKB_ARAS[0]);
  const [namaWkiTerpilih, setNamaWkiTerpilih] = useState(NAMA_WKI_ARAS[0]);
  const [namaLansiaTerpilih, setNamaLansiaTerpilih] = useState(NAMA_LANSIA_RAYON[0]);
  const [namaPemudaTerpilih, setNamaPemudaTerpilih] = useState(NAMA_PEMUDA_ARAS[0]);

  // State Dana Duka
  const [jumlahDuka, setJumlahDuka] = useState("1 Duka");
  const [ketDuka, setKetDuka] = useState("");

  // State Sampul
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
    payment_method: "cash",
  });

  const resetState = () => {
    setForm({
      trx_date: new Date().toISOString().slice(0, 10),
      category: "",
      budget_line_id: "",
      amount: "",
      description: "",
      payee: "",
      payment_method: "cash",
    });
    setItems([{ description: "", amount: "" }]);
    setBudgetOpen(false);
    setPilihKolom("1");
    setPilihBulan(String(new Date().getMonth()));
    setRincianTanggal("");
    setNamaPkbTerpilih(NAMA_PKB_ARAS[0]);
    setNamaWkiTerpilih(NAMA_WKI_ARAS[0]);
    setNamaLansiaTerpilih(NAMA_LANSIA_RAYON[0]);
    setNamaPemudaTerpilih(NAMA_PEMUDA_ARAS[0]);
    setJumlahDuka("1 Duka");
    setKetDuka("");
    setJumlahSampul("");
    setPemberiSampul("");
    setPbtkKeluarga("");
    setPbtkKolom("1");
    setPbtkBulan(String(new Date().getMonth()));
    setPbtkPeriodeTeks("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      resetState();
    }
    setOpen(nextOpen);
  };

  const options = useMemo(() => (budgets.data ?? []).filter((b) => b.kind === kind), [budgets.data, kind]);
  const selected = options.find((b) => b.id === form.budget_line_id);

  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => a.code.localeCompare(b.code)),
    [options],
  );

  // Deteksi Tipe Template yang Sesuai dengan Mata Anggaran Terpilih
  const templateType = useMemo(() => {
    if (!selected) return "none";
    const code = selected.code;
    const name = selected.name.toLowerCase();

    // 1. PKB
    if (code === "1.3.01.01") return "pkb_aras";
    if (code === "1.3.53.02") return "pkb_kolom";

    // 2. WKI
    if (code === "1.3.01.02") return "wki_aras";
    if (code === "1.3.53.03") return "wki_kolom";

    // 3. Lansia
    if (code === "1.3.01.08") return "lansia_rayon";

    // 4. Pemuda
    if (code === "1.3.01.03") return "pemuda_aras";
    if (code === "1.3.53.04") return "pemuda_kolom";

    // 5. Remaja
    if (code === "1.3.01.04") return "remaja_aras";
    if (code === "1.3.53.05") return "remaja_kolom";

    // 6. ASM
    if (code === "1.3.01.05") return "asm_aras";
    if (code === "1.3.53.06") return "asm_kolom";

    // 7. Kolom Rutin & Pembangunan Kolom
    if (code === "1.3.53.01") return "kolom_rutin";
    if (code === "1.3.57.01") return "kolom_pembangunan";
    if (code === "1.3.53.07") return "kolom_syukur";

    // 8. Dana Duka
    if (code === "3.3.03.01" || code === "1.3.55.01" || name.includes("dana duka") || name.includes("duka"))
      return "duka";

    // 9. Persembahan Sekolah (TK Bumotik & SD GMIM)
    if (
      code === "2.3.50.07" ||
      code === "2.3.50.08" ||
      name.includes("tk bumotik") ||
      name.includes("sd gmim") ||
      name.includes("sekolah")
    )
      return "sekolah";

    // 10. Sampul PBTK
    if (code === "1.3.66.14") return "pbtk";

    // 11. Sampul-Sampul Lainnya
    if (code.startsWith("1.3.66.") || code === "4.3.64.00" || code === "1.3.50.06" || name.startsWith("sampul"))
      return "sampul_lain";

    return "umum";
  }, [selected]);

  // Fungsi helper untuk menerapkan format ke baris keterangan yang kosong tanpa mengganti yang sudah ada
  const applyDescriptionToEmpty = (ket: string, targetBudgetId?: string) => {
    const cleanKet = standardizeDescription(ket);
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
          description: cleanKet,
          amount: targetRow.amount,
        };
        return updated;
      }

      // Jika semua baris yang ada sudah terisi dan masih kurang dari 5 baris, tambahkan baris baru
      if (prev.length < 5) {
        return [...prev, { description: cleanKet, amount: "" }];
      }

      // Jika sudah mencapai 5 baris dan semuanya penuh
      toast.warning("Maksimal 5 baris tercapai. Kosongkan salah satu baris untuk menerapkan keterangan baru.");
      return prev;
    });

    toast.success(`Keterangan terstandarisasi diterapkan: "${cleanKet}"`);
  };

  // Handler Terapkan Template Berdasarkan Tipe Pos Anggaran
  const terapkanTemplateTerpilih = (customPrefix?: string) => {
    const bulanNama = BULAN_PANJANG[Number(pilihBulan)] ?? "Januari";
    const tglPart = rincianTanggal.trim() ? ` (${rincianTanggal.trim()})` : "";

    let ket = "";

    switch (templateType) {
      case "pkb_aras":
        ket = `${customPrefix || namaPkbTerpilih}${tglPart} Bulan ${bulanNama}`;
        break;
      case "pkb_kolom":
        ket = `PKB Kolom ${pilihKolom}${tglPart} Bulan ${bulanNama}`;
        break;
      case "wki_aras":
        ket = `${customPrefix || namaWkiTerpilih}${tglPart} Bulan ${bulanNama}`;
        break;
      case "wki_kolom":
        ket = `WKI Kolom ${pilihKolom}${tglPart} Bulan ${bulanNama}`;
        break;
      case "lansia_rayon":
        ket = `${customPrefix || namaLansiaTerpilih}${tglPart} Bulan ${bulanNama}`;
        break;
      case "pemuda_aras":
        ket = `${customPrefix || namaPemudaTerpilih}${tglPart} Bulan ${bulanNama}`;
        break;
      case "pemuda_kolom":
        ket = `Pemuda Kolom ${pilihKolom}${tglPart} Bulan ${bulanNama}`;
        break;
      case "remaja_aras":
        ket = `Remaja ARAS${tglPart} Bulan ${bulanNama}`;
        break;
      case "remaja_kolom":
        ket = `Remaja Kolom ${pilihKolom}${tglPart} Bulan ${bulanNama}`;
        break;
      case "asm_aras":
        ket = `ASM ARAS${tglPart} Bulan ${bulanNama}`;
        break;
      case "asm_kolom":
        ket = `ASM Kolom ${pilihKolom}${tglPart} Bulan ${bulanNama}`;
        break;
      case "kolom_rutin":
        ket = `Persembahan Ibadah Kolom ${pilihKolom}${tglPart} Bulan ${bulanNama}`;
        break;
      case "kolom_pembangunan":
        ket = `Pembangunan Kolom ${pilihKolom}${tglPart} Bulan ${bulanNama}`;
        break;
      case "kolom_syukur":
        ket = `Syukur HUT Kolom ${pilihKolom}${tglPart} Bulan ${bulanNama}`;
        break;
      case "duka": {
        const dukaCount = jumlahDuka.trim() ? ` (${jumlahDuka.trim()})` : "";
        const extra = ketDuka.trim() ? ` - ${ketDuka.trim()}` : "";
        ket = `Dana Duka Kolom ${pilihKolom}${dukaCount}${extra}`;
        break;
      }
      case "pbtk": {
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
        break;
      }
      case "sampul_lain": {
        const jlhPart = jumlahSampul.trim() ? `${jumlahSampul.trim()} ` : "";
        const namaPart = pemberiSampul.trim() ? ` (${pemberiSampul.trim()})` : "";
        ket = `${jlhPart}${selected?.name || "Sampul"}${namaPart}`;
        break;
      }
      case "sekolah": {
        const isSd = selected?.code === "2.3.50.07" || selected?.name.toLowerCase().includes("sd");
        const namaSekolah = isSd ? "SD GMIM 5" : "TK Bumotik";
        const tglPart = rincianTanggal.trim() ? ` (${rincianTanggal.trim()})` : "";
        ket = `${namaSekolah}${tglPart} Bulan ${bulanNama}`;
        break;
      }
      default:
        ket = `${selected?.name || "Penerimaan"} Bulan ${bulanNama}`;
        break;
    }

    applyDescriptionToEmpty(ket, selected?.id);
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
        const cleanDesc = standardizeDescription(b.description);
        const parsed = schema.parse({
          ...form,
          description: cleanDesc,
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
          payment_method: parsed.payment_method || "cash",
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          {kind === "penerimaan" ? "Catat Penerimaan" : "Catat Pengeluaran"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">
              {kind === "penerimaan" ? "Catat Penerimaan Kas" : "Catat Pengeluaran Kas"}
            </DialogTitle>
            {kind === "penerimaan" && (
              <span className="text-[11px] text-success font-medium flex items-center gap-1 bg-success/10 px-2 py-0.5 rounded-full">
                <ShieldCheck className="size-3" /> Auto-Template Aktif
              </span>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {kind === "penerimaan"
              ? "Pilih Mata Anggaran di bawah, template otomatis akan terbuka menyesuaikan pos yang Anda pilih."
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
                <PopoverContent className="w-[360px] sm:w-[460px] p-0" align="end">
                  <Command
                    filter={(value, search) =>
                      value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                    }
                  >
                    <CommandInput placeholder="Ketik kode, nama PKB/WKI/Lansia, atau pos…" />
                    <CommandList className="max-h-80 overflow-y-auto">
                      <CommandEmpty>Mata anggaran tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                        {sortedOptions.map((b) => (
                          <CommandItem
                            key={b.id}
                            value={`${b.code} ${b.name} ${b.grup || ""}`}
                            onSelect={() => {
                              setForm({ ...form, budget_line_id: b.id });
                              setBudgetOpen(false);
                              setAsistenAktif(true);
                            }}
                            className="flex items-start py-2 cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 size-3.5 mt-0.5 shrink-0",
                                form.budget_line_id === b.id ? "opacity-100" : "opacity-0",
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

          {/* Rincian Keterangan Mata Anggaran Terpilih */}
          {selected && (
            <div className="rounded-md bg-muted/40 border px-3 py-2 text-xs flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary">{selected.code}</span>
                  <span className="font-semibold text-foreground">{selected.name}</span>
                </div>
                {selected.grup && (
                  <span className="text-[11px] text-muted-foreground block">
                    Grup Kategori: <strong>{selected.grup}</strong>
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                onClick={() => setBudgetOpen(true)}
              >
                Ganti
              </Button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ASISTEN TEMPLATE DINAMIS - TERBUKA OTOMATIS SESUAI MATA ANGGARAN TERPILIH */}
          {/* ========================================================================= */}
          {kind === "penerimaan" && selected && templateType !== "none" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span className="text-xs font-bold text-primary">
                    Template Otomatis: {selected.name}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Pilih & klik untuk mengisi baris keterangan
                </span>
              </div>

              {/* 1. KHUSUS BIPRA PKB ARAS (1.3.01.01) */}
              {templateType === "pkb_aras" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block">
                      Pilih Nama Kelompok PKB (Klik untuk Memilih):
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {NAMA_PKB_ARAS.map((nama) => (
                        <Button
                          key={nama}
                          type="button"
                          size="sm"
                          variant={namaPkbTerpilih === nama ? "default" : "outline"}
                          className="h-7 text-xs font-medium"
                          onClick={() => {
                            setNamaPkbTerpilih(nama);
                            terapkanTemplateTerpilih(nama);
                          }}
                        >
                          {nama}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
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
                      <Label className="text-xs">Tgl Ibadah (Opsional)</Label>
                      <Input
                        value={rincianTanggal}
                        onChange={(e) => setRincianTanggal(e.target.value)}
                        placeholder="Misal: 1, 8, 15, 22"
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => terapkanTemplateTerpilih()}
                      className="h-7 text-xs font-semibold"
                    >
                      + Terapkan Format {namaPkbTerpilih}
                    </Button>
                  </div>
                </div>
              )}

              {/* 2. KHUSUS BIPRA WKI ARAS (1.3.01.02) */}
              {templateType === "wki_aras" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block">
                      Pilih Nama Kelompok WKI (Klik untuk Memilih):
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {NAMA_WKI_ARAS.map((nama) => (
                        <Button
                          key={nama}
                          type="button"
                          size="sm"
                          variant={namaWkiTerpilih === nama ? "default" : "outline"}
                          className="h-7 text-xs font-medium"
                          onClick={() => {
                            setNamaWkiTerpilih(nama);
                            terapkanTemplateTerpilih(nama);
                          }}
                        >
                          {nama}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
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
                      <Label className="text-xs">Tgl Ibadah (Opsional)</Label>
                      <Input
                        value={rincianTanggal}
                        onChange={(e) => setRincianTanggal(e.target.value)}
                        placeholder="Misal: 7, 14, 21"
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => terapkanTemplateTerpilih()}
                      className="h-7 text-xs font-semibold"
                    >
                      + Terapkan Format {namaWkiTerpilih}
                    </Button>
                  </div>
                </div>
              )}

              {/* 3. KHUSUS LANSIA RAYON / ARAS (1.3.01.08) */}
              {templateType === "lansia_rayon" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block">
                      Pilih Rayon Lansia (Klik untuk Memilih):
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {NAMA_LANSIA_RAYON.map((nama) => (
                        <Button
                          key={nama}
                          type="button"
                          size="sm"
                          variant={namaLansiaTerpilih === nama ? "default" : "outline"}
                          className="h-7 text-xs font-medium"
                          onClick={() => {
                            setNamaLansiaTerpilih(nama);
                            terapkanTemplateTerpilih(nama);
                          }}
                        >
                          {nama}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
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
                      <Label className="text-xs">Tgl Ibadah (Opsional)</Label>
                      <Input
                        value={rincianTanggal}
                        onChange={(e) => setRincianTanggal(e.target.value)}
                        placeholder="Misal: 12, 27"
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => terapkanTemplateTerpilih()}
                      className="h-7 text-xs font-semibold"
                    >
                      + Terapkan Format {namaLansiaTerpilih}
                    </Button>
                  </div>
                </div>
              )}

              {/* 4. KHUSUS PEMUDA ARAS (1.3.01.03) */}
              {templateType === "pemuda_aras" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block">
                      Pilih Kelompok Pemuda (Klik untuk Memilih):
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {NAMA_PEMUDA_ARAS.map((nama) => (
                        <Button
                          key={nama}
                          type="button"
                          size="sm"
                          variant={namaPemudaTerpilih === nama ? "default" : "outline"}
                          className="h-7 text-xs font-medium"
                          onClick={() => {
                            setNamaPemudaTerpilih(nama);
                            terapkanTemplateTerpilih(nama);
                          }}
                        >
                          {nama}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
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
                      <Label className="text-xs">Tgl Ibadah (Opsional)</Label>
                      <Input
                        value={rincianTanggal}
                        onChange={(e) => setRincianTanggal(e.target.value)}
                        placeholder="Misal: 10, 20"
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => terapkanTemplateTerpilih()}
                      className="h-7 text-xs font-semibold"
                    >
                      + Terapkan Format {namaPemudaTerpilih}
                    </Button>
                  </div>
                </div>
              )}

              {/* 5. KHUSUS SETORAN KOLOM 1-29 (PKB Kolom, WKI Kolom, Pemuda Kolom, Remaja, ASM, Rutin, Pembangunan) */}
              {[
                "pkb_kolom",
                "wki_kolom",
                "pemuda_kolom",
                "remaja_kolom",
                "remaja_aras",
                "asm_kolom",
                "asm_aras",
                "kolom_rutin",
                "kolom_pembangunan",
                "kolom_syukur",
              ].includes(templateType) && (
                <div className="space-y-3">
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Pilih Kolom</Label>
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
                      <Label className="text-xs">Tgl Ibadah (Opsional)</Label>
                      <Input
                        value={rincianTanggal}
                        onChange={(e) => setRincianTanggal(e.target.value)}
                        placeholder="Misal: 4, 11, 18, 25"
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => terapkanTemplateTerpilih()}
                      className="h-7 text-xs font-semibold"
                    >
                      + Terapkan Format Kolom {pilihKolom}
                    </Button>
                  </div>
                </div>
              )}

              {/* 6. KHUSUS DANA DUKA (3.3.03.01 / 1.3.55.01) */}
              {templateType === "duka" && (
                <div className="space-y-3">
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Pilih Kolom</Label>
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
                      <Label className="text-xs">Nama Alm / Catatan</Label>
                      <Input
                        value={ketDuka}
                        onChange={(e) => setKetDuka(e.target.value)}
                        placeholder="Opsional"
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => terapkanTemplateTerpilih()}
                      className="h-7 text-xs font-semibold"
                    >
                      + Terapkan Format Dana Duka Kolom {pilihKolom} ({jumlahDuka})
                    </Button>
                  </div>
                </div>
              )}

              {/* 7. KHUSUS SAMPUL PBTK (1.3.66.14) */}
              {templateType === "pbtk" && (
                <div className="space-y-2.5">
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <div className="space-y-1 sm:col-span-3">
                      <Label className="text-xs">Nama Keluarga / Penyetor</Label>
                      <Input
                        value={pbtkKeluarga}
                        onChange={(e) => setPbtkKeluarga(e.target.value)}
                        placeholder="Misal: Montori Kansil / Krisen Roeroe"
                        className="h-8 text-xs font-medium bg-background"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Nomor Kolom</Label>
                      <Select value={pbtkKolom} onValueChange={setPbtkKolom}>
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
                      <Label className="text-xs">Bulan Setoran</Label>
                      <Select value={pbtkBulan} onValueChange={setPbtkBulan}>
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
                      <Label className="text-xs">Rentang Bulan (Opsional)</Label>
                      <Input
                        value={pbtkPeriodeTeks}
                        onChange={(e) => setPbtkPeriodeTeks(e.target.value)}
                        placeholder="Misal: Jan - Jun"
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => terapkanTemplateTerpilih()}
                      className="h-7 text-xs font-semibold"
                    >
                      + Terapkan Format Sampul PBTK
                    </Button>
                  </div>
                </div>
              )}

              {/* 8. KHUSUS SAMPUL-SAMPUL LAINNYA */}
              {templateType === "sampul_lain" && (
                <div className="space-y-2.5">
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

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => terapkanTemplateTerpilih()}
                      className="h-7 text-xs font-semibold"
                    >
                      + Terapkan Format {selected.name}
                    </Button>
                  </div>
                </div>
              )}

              {/* 9. KHUSUS PERSEMBAHAN TK BUMOTIK & SD GMIM */}
              {templateType === "sekolah" && (
                <div className="space-y-3">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Tanggal Setoran / Ibadah <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={rincianTanggal}
                        onChange={(e) => setRincianTanggal(e.target.value)}
                        placeholder="Contoh: 4, 11 / 13, 20 / 25"
                        className="h-8 text-xs bg-background font-medium"
                      />
                      <span className="text-[11px] text-muted-foreground block">
                        Ketik tanggal-tanggal setoran (misal: 4, 11 atau 25)
                      </span>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Bulan Setoran</Label>
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
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => terapkanTemplateTerpilih()}
                      className="h-7 text-xs font-semibold"
                    >
                      + Terapkan Format {selected.name} {rincianTanggal.trim() ? `(${rincianTanggal.trim()})` : ""} Bulan {BULAN_PANJANG[Number(pilihBulan)]}
                    </Button>
                  </div>
                </div>
              )}

              {/* 10. MATA ANGGARAN UMUM */}
              {templateType === "umum" && (
                <div className="space-y-2.5">
                  <div className="grid gap-2.5 sm:grid-cols-2">
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
                      <Label className="text-xs">Keterangan Tambahan (Opsional)</Label>
                      <Input
                        value={rincianTanggal}
                        onChange={(e) => setRincianTanggal(e.target.value)}
                        placeholder="Catatan pos…"
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => terapkanTemplateTerpilih()}
                      className="h-7 text-xs font-semibold"
                    >
                      + Terapkan Format Standar
                    </Button>
                  </div>
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
                      onBlur={(e) => {
                        const clean = standardizeDescription(e.target.value);
                        if (clean !== e.target.value) {
                          setItems(
                            items.map((x, i) =>
                              i === idx ? { ...x, description: clean } : x,
                            ),
                          );
                        }
                      }}
                      placeholder={`Keterangan baris ${idx + 1}`}
                      maxLength={500}
                      className="h-9 text-xs font-medium"
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
              <div className="grid gap-3 sm:grid-cols-2">
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
                  <Label htmlFor="metode" className="text-xs font-semibold">
                    Metode / Sumber Dana <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.payment_method || "cash"}
                    onValueChange={(val) => setForm({ ...form, payment_method: val })}
                  >
                    <SelectTrigger id="metode" className="h-9 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash" className="text-xs">
                        💵 Kas Fisik (Tunai / Brankas)
                      </SelectItem>
                      <SelectItem value="transfer" className="text-xs">
                        🏦 Bank / Transfer (Tidak Kurangi Fisik)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.payment_method === "transfer" && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-2.5 text-[11px] text-blue-800 flex items-center gap-2">
                  <ShieldCheck className="size-4 text-blue-600 shrink-0" />
                  <span>
                    Pengeluaran via <strong>Bank / Transfer</strong> dicatat pada Laporan Bank dan <strong>TIDAK MENGURANGI Saldo Kas Fisik</strong> di brankas/kasir.
                  </span>
                </div>
              )}

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