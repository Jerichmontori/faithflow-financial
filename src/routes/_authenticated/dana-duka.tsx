import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  HeartHandshake,
  Plus,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Trash2,
  Edit2,
  Users,
  Wallet,
  Receipt,
  Search,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Calendar,
  History,
  FileSpreadsheet,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { transactionsQuery } from "@/lib/queries";
import { rupiah, tanggal } from "@/lib/format";
import {
  DUKA_KOLOM,
  bacaDaftarDuka,
  simpanDaftarDuka,
  bacaTarifRules,
  simpanTarifRules,
  bacaTunggakanTahunLalu,
  simpanTunggakanTahunLalu,
  bacaDuka,
  simpanDuka,
  hitungSemuaTunggakanDuka,
  hitungTotalTargetDukaTahap,
  buatDefaultTarifKolom,
  type KasusDuka,
  type TarifKolomRule,
  type TunggakanTahunLaluMap,
  type DukaMap,
  type KolomDukaSummary,
  DEFAULT_TARIF_DUKA,
} from "@/lib/duka";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dana-duka")({
  head: () => ({
    meta: [
      { title: "Dana Diakonia Duka Jemaat — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Daftar nama kasus duka, saldo tunggakan tahun lalu per kolom, aturan tarif dinamis bertahap, dan monitoring tunggakan dana duka Kolom 1 sampai 29.",
      },
      { property: "og:title", content: "Dana Diakonia Duka Jemaat — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Pencatatan tunggakan tahun lalu dan otomatisasi pelunasan setoran dana duka setiap kolom jemaat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DanaDukaPage,
});

function DanaDukaPage() {
  const trx = useQuery(transactionsQuery);

  const [daftarDuka, setDaftarDuka] = useState<KasusDuka[]>([]);
  const [tarifRules, setTarifRules] = useState<TarifKolomRule[]>([]);
  const [tunggakanLaluMap, setTunggakanLaluMap] = useState<TunggakanTahunLaluMap>({});
  const [overrideMap, setOverrideMap] = useState<DukaMap>({});
  const [activeTab, setActiveTab] = useState("matriks");
  const [searchTerm, setSearchTerm] = useState("");

  // State Modal Tambah/Edit Kasus Duka
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDuka, setEditingDuka] = useState<KasusDuka | null>(null);
  const [formUrutan, setFormUrutan] = useState<number>(1);
  const [formNama, setFormNama] = useState("");
  const [formTanggal, setFormTanggal] = useState("");
  const [formKolom, setFormKolom] = useState<string>("");
  const [formKeterangan, setFormKeterangan] = useState("");

  // State Modal Aturan Tarif Dinamis
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TarifKolomRule | null>(null);
  const [ruleNama, setRuleNama] = useState("");
  const [ruleMulaiTahap, setRuleMulaiTahap] = useState(1);
  const [ruleSampaiTahap, setRuleSampaiTahap] = useState<string>("");
  const [ruleMode, setRuleMode] = useState<"terpilih" | "semua">("terpilih");
  const [selectedKolomList, setSelectedKolomList] = useState<number[]>([1]);
  const [ruleTarifMap, setRuleTarifMap] = useState<Record<number, number>>({});
  const [ruleBatchNominal, setRuleBatchNominal] = useState<string>("50000");

  // State Modal Detail Kolom
  const [detailKolom, setDetailKolom] = useState<KolomDukaSummary | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Load data on mount & event
  useEffect(() => {
    setDaftarDuka(bacaDaftarDuka());
    setTarifRules(bacaTarifRules());
    setTunggakanLaluMap(bacaTunggakanTahunLalu());
    setOverrideMap(bacaDuka());

    const handleUpdate = () => {
      setDaftarDuka(bacaDaftarDuka());
      setTarifRules(bacaTarifRules());
      setTunggakanLaluMap(bacaTunggakanTahunLalu());
      setOverrideMap(bacaDuka());
    };

    window.addEventListener("bumotik_duka_updated", handleUpdate);
    return () => window.removeEventListener("bumotik_duka_updated", handleUpdate);
  }, []);

  // Hitung status tunggakan duka seluruh kolom 1-29 secara dinamis dan otomatis (termasuk tahun lalu)
  const ringkasanKolom = useMemo(() => {
    return hitungSemuaTunggakanDuka(trx.data ?? [], daftarDuka, overrideMap, tarifRules, tunggakanLaluMap);
  }, [trx.data, daftarDuka, overrideMap, tarifRules, tunggakanLaluMap]);

  // Statistik Ringkas
  const stats = useMemo(() => {
    const list = Object.values(ringkasanKolom);
    const totalSetoranSemua = list.reduce((a, b) => a + b.totalSetorRp, 0);
    const totalKewajibanSemua = list.reduce((a, b) => a + b.totalKewajibanRp, 0);
    const totalTunggakanRpSemua = list.reduce((a, b) => a + b.totalSisaTunggakanRp, 0);
    const lunasCount = list.filter((k) => k.tunggakanJumlah === 0 || k.statusLabel.toLowerCase() === "lunas").length;
    const tertunggakCount = list.length - lunasCount;
    const totalKasus = daftarDuka.length;
    const totalTunggakanKasus = list.reduce((a, b) => a + b.tunggakanJumlah, 0);

    return {
      totalKasus,
      totalSetoranSemua,
      totalKewajibanSemua,
      totalTunggakanRpSemua,
      lunasCount,
      tertunggakCount,
      totalTunggakanKasus,
    };
  }, [ringkasanKolom, daftarDuka]);

  // Handlers CRUD Kasus Duka
  const openAddDialog = () => {
    setEditingDuka(null);
    setFormUrutan(daftarDuka.length + 1);
    setFormNama("");
    setFormTanggal(new Date().toISOString().slice(0, 10));
    setFormKolom("");
    setFormKeterangan("");
    setDialogOpen(true);
  };

  const openEditDialog = (item: KasusDuka) => {
    setEditingDuka(item);
    setFormUrutan(item.urutan);
    setFormNama(item.nama);
    setFormTanggal(item.tanggal);
    setFormKolom(item.kolomKeluarga ? String(item.kolomKeluarga) : "");
    setFormKeterangan(item.keterangan || "");
    setDialogOpen(true);
  };

  const handleSaveKasusDuka = () => {
    if (!formNama.trim()) {
      toast.error("Nama almarhum/keluarga duka wajib diisi");
      return;
    }

    const kolomKel = formKolom ? Number(formKolom) : null;
    const tarif = editingDuka?.iuranPerKolom || DEFAULT_TARIF_DUKA;

    let updated: KasusDuka[];
    if (editingDuka) {
      updated = daftarDuka.map((d) =>
        d.id === editingDuka.id
          ? {
              ...d,
              urutan: formUrutan,
              nama: formNama.trim(),
              tanggal: formTanggal,
              kolomKeluarga: kolomKel,
              iuranPerKolom: tarif,
              keterangan: formKeterangan.trim(),
            }
          : d
      );
      toast.success("Peristiwa duka berhasil diperbarui");
    } else {
      const newItem: KasusDuka = {
        id: `duka-${Date.now()}`,
        urutan: formUrutan,
        nama: formNama.trim(),
        tanggal: formTanggal,
        kolomKeluarga: kolomKel,
        iuranPerKolom: tarif,
        keterangan: formKeterangan.trim(),
      };
      updated = [...daftarDuka, newItem];
      toast.success("Peristiwa duka baru ditambahkan!");
    }

    updated.sort((a, b) => a.urutan - b.urutan);
    setDaftarDuka(updated);
    simpanDaftarDuka(updated);
    setDialogOpen(false);
  };

  const handleDeleteKasusDuka = (id: string, nama: string) => {
    if (confirm(`Hapus peristiwa duka "${nama}" dari daftar?`)) {
      const updated = daftarDuka.filter((d) => d.id !== id).map((d, idx) => ({ ...d, urutan: idx + 1 }));
      setDaftarDuka(updated);
      simpanDaftarDuka(updated);
      toast.info("Peristiwa duka telah dihapus");
    }
  };

  // Handlers Aturan Tarif Kolom Dinamis
  const openAddRuleModal = () => {
    setEditingRule(null);
    setRuleNama(`Penyesuaian Tarif Tahap ${daftarDuka.length + 1}`);
    setRuleMulaiTahap(daftarDuka.length + 1 > 0 ? daftarDuka.length + 1 : 1);
    setRuleSampaiTahap("");
    setRuleMode("terpilih");
    setSelectedKolomList([1]); // default pilih kolom 1
    setRuleTarifMap({ 1: 50000 });
    setRuleBatchNominal("50000");
    setRuleModalOpen(true);
  };

  const openEditRuleModal = (rule: TarifKolomRule) => {
    setEditingRule(rule);
    setRuleNama(rule.namaAturan);
    setRuleMulaiTahap(rule.mulaiTahap);
    setRuleSampaiTahap(rule.sampaiTahap ? String(rule.sampaiTahap) : "");
    const keys = Object.keys(rule.tarifPerKolom).map(Number);
    const isAll = keys.length >= 29;
    setRuleMode(isAll ? "semua" : "terpilih");
    setSelectedKolomList(keys.length > 0 ? keys : [1]);
    setRuleTarifMap({ ...rule.tarifPerKolom });
    setRuleBatchNominal("50000");
    setRuleModalOpen(true);
  };

  const toggleSelectKolom = (k: number) => {
    if (selectedKolomList.includes(k)) {
      setSelectedKolomList(selectedKolomList.filter((x) => x !== k));
    } else {
      setSelectedKolomList([...selectedKolomList, k].sort((a, b) => a - b));
      if (!ruleTarifMap[k]) {
        setRuleTarifMap((prev) => ({ ...prev, [k]: Number(ruleBatchNominal) || DEFAULT_TARIF_DUKA }));
      }
    }
  };

  const handleSelectAllKolom = () => {
    setSelectedKolomList([...DUKA_KOLOM]);
    const newMap = { ...ruleTarifMap };
    const val = Number(ruleBatchNominal) || DEFAULT_TARIF_DUKA;
    for (const k of DUKA_KOLOM) {
      if (!newMap[k]) newMap[k] = val;
    }
    setRuleTarifMap(newMap);
  };

  const handleClearSelectedKolom = () => {
    setSelectedKolomList([]);
  };

  const handleApplyBatchTarif = () => {
    const val = Number(ruleBatchNominal.replace(/[^\d]/g, "")) || DEFAULT_TARIF_DUKA;
    const targetCols = ruleMode === "semua" ? DUKA_KOLOM : selectedKolomList;

    if (targetCols.length === 0) {
      toast.error("Pilih minimal 1 kolom terlebih dahulu");
      return;
    }

    const newMap: Record<number, number> = { ...ruleTarifMap };
    for (const k of targetCols) {
      newMap[k] = val;
    }
    setRuleTarifMap(newMap);
    toast.success(`Tarif ${rupiah(val)} diterapkan ke ${targetCols.length} kolom`);
  };

  const handleSaveRule = () => {
    if (!ruleNama.trim()) {
      toast.error("Nama aturan wajib diisi");
      return;
    }

    const sampai = ruleSampaiTahap.trim() ? Number(ruleSampaiTahap) : null;

    // Filter tarif map sesuai mode: semua vs hanya kolom terpilih
    const finalTarifMap: Record<number, number> = {};
    if (ruleMode === "semua") {
      for (const k of DUKA_KOLOM) {
        finalTarifMap[k] = ruleTarifMap[k] || DEFAULT_TARIF_DUKA;
      }
    } else {
      if (selectedKolomList.length === 0) {
        toast.error("Pilih minimal 1 kolom yang mengalami perubahan tarif");
        return;
      }
      for (const k of selectedKolomList) {
        finalTarifMap[k] = ruleTarifMap[k] || DEFAULT_TARIF_DUKA;
      }
    }

    const colCount = Object.keys(finalTarifMap).length;
    const keteranganStr = colCount >= 29
      ? `Mulai Tahap ${ruleMulaiTahap}: Berlaku untuk semua 29 Kolom`
      : `Mulai Tahap ${ruleMulaiTahap}: Khusus Kolom ${selectedKolomList.sort((a,b)=>a-b).join(", ")}`;

    let updated: TarifKolomRule[];
    if (editingRule) {
      updated = tarifRules.map((r) =>
        r.id === editingRule.id
          ? {
              ...r,
              namaAturan: ruleNama.trim(),
              mulaiTahap: ruleMulaiTahap,
              sampaiTahap: sampai,
              tarifPerKolom: finalTarifMap,
              keterangan: keteranganStr,
            }
          : r
      );
      toast.success("Aturan tarif kolom berhasil diperbarui");
    } else {
      const newRule: TarifKolomRule = {
        id: `rule-${Date.now()}`,
        namaAturan: ruleNama.trim(),
        mulaiTahap: ruleMulaiTahap,
        sampaiTahap: sampai,
        tarifPerKolom: finalTarifMap,
        keterangan: keteranganStr,
      };
      updated = [...tarifRules, newRule];
      toast.success("Aturan tarif khusus kolom berhasil ditambahkan!");
    }

    setTarifRules(updated);
    simpanTarifRules(updated);
    setRuleModalOpen(false);
  };

  const handleDeleteRule = (id: string, nama: string) => {
    if (tarifRules.length <= 1) {
      toast.error("Minimal harus ada 1 aturan tarif aktif");
      return;
    }
    if (confirm(`Hapus aturan tarif "${nama}"?`)) {
      const updated = tarifRules.filter((r) => r.id !== id);
      setTarifRules(updated);
      simpanTarifRules(updated);
      toast.info("Aturan tarif telah dihapus");
    }
  };

  // Handlers Tunggakan Tahun Lalu
  const handleTunggakanLaluChange = (kolom: number, field: "nominalRp" | "jumlahKasus" | "keterangan", val: any) => {
    const prev = tunggakanLaluMap[kolom] || { kolom, nominalRp: 0, jumlahKasus: 0, keterangan: "" };
    const updated = {
      ...tunggakanLaluMap,
      [kolom]: {
        ...prev,
        [field]: field === "keterangan" ? val : Number(val || 0),
      },
    };
    setTunggakanLaluMap(updated);
    simpanTunggakanTahunLalu(updated);
  };

  const handleOverrideStatus = (kolom: number, val: string) => {
    const newMap = { ...overrideMap, [String(kolom)]: val };
    setOverrideMap(newMap);
    simpanDuka(newMap);
  };

  const handleResetOverride = (kolom: number) => {
    const newMap = { ...overrideMap };
    delete newMap[String(kolom)];
    setOverrideMap(newMap);
    simpanDuka(newMap);
    toast.success(`Status Kolom ${kolom} dikembalikan ke perhitungan otomatis`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter kolom list based on search
  const filteredKolomList = useMemo(() => {
    return DUKA_KOLOM.filter((k) => {
      const info = ringkasanKolom[k];
      if (!info) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        `kolom ${k}`.includes(q) ||
        info.statusLabel.toLowerCase().includes(q) ||
        String(info.totalSetorRp).includes(q) ||
        String(info.totalSisaTunggakanRp).includes(q)
      );
    });
  }, [ringkasanKolom, searchTerm]);

  return (
    <AppShell
      title="Dana Diakonia Duka Jemaat"
      subtitle="Manajemen nama duka, tunggakan tahun lalu, tarif dinamis, & pelunasan otomatis"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
            <Printer className="size-3.5" /> Cetak Rekap
          </Button>
          <Button size="sm" onClick={openAddDialog} className="gap-1.5 text-xs font-semibold shadow-sm">
            <Plus className="size-3.5" /> Tambah Kasus Duka
          </Button>
        </div>
      }
    >
      {/* 4 Stat Cards Ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="border-l-4 border-l-primary shadow-xs">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Daftar Kasus Duka
              </span>
              <HeartHandshake className="size-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-black text-foreground">{stats.totalKasus} Tahap</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Total peristiwa duka tahun berjalan</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-xs">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Total Setoran Duka Masuk
              </span>
              <Wallet className="size-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-black text-emerald-700">{rupiah(stats.totalSetoranSemua)}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Kewajiban: {rupiah(stats.totalKewajibanSemua)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-xs">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Kolom Lunas
              </span>
              <CheckCircle2 className="size-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-black text-blue-700">
              {stats.lunasCount} <span className="text-sm font-normal text-muted-foreground">/ 29 Kolom</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Bebas tunggakan tahun lalu & sekarang</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-xs">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Sisa Tunggakan Duka
              </span>
              <AlertCircle className="size-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-black text-amber-700">
              {rupiah(stats.totalTunggakanRpSemua)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.tertunggakCount} Kolom ({stats.totalTunggakanKasus} tagihan duka)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Utama: 1. Matriks Tunggakan, 2. Master Daftar Nama Duka, 3. Pengaturan Tarif, 4. Tunggakan Tahun Lalu */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full sm:w-auto grid-cols-2 md:grid-cols-4 sm:inline-flex">
          <TabsTrigger value="matriks" className="text-xs">
            <Users className="size-3.5 mr-1.5" /> Status 29 Kolom
          </TabsTrigger>
          <TabsTrigger value="daftar-duka" className="text-xs">
            <HeartHandshake className="size-3.5 mr-1.5" /> Daftar Nama Duka ({daftarDuka.length})
          </TabsTrigger>
          <TabsTrigger value="tahun-lalu" className="text-xs">
            <History className="size-3.5 mr-1.5" /> Tunggakan Tahun Lalu
          </TabsTrigger>
          <TabsTrigger value="tarif-dinamis" className="text-xs">
            <SlidersHorizontal className="size-3.5 mr-1.5" /> Tarif Dinamis ({tarifRules.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MATRIKS STATUS TUNGGAKAN 29 KOLOM */}
        <TabsContent value="matriks" className="space-y-4">
          <div className="panel p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari Kolom / Status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                <CheckCircle2 className="size-3" /> Lunas
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                <Clock className="size-3" /> Tertunggak
              </span>
              <span className="text-[11px] italic">Setoran kas baru otomatis melunasi tunggakan tahun lalu lebih dahulu (FIFO).</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredKolomList.map((k) => {
              const summary = ringkasanKolom[k];
              if (!summary) return null;
              const isLunas = summary.tunggakanJumlah === 0 || summary.statusLabel.toLowerCase() === "lunas";
              const isOverride = Boolean(overrideMap[String(k)]);

              return (
                <div
                  key={k}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isLunas
                      ? "bg-card border-border hover:border-emerald-400/60"
                      : "bg-amber-50/30 border-amber-200/80 hover:border-amber-400"
                  } shadow-xs flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-foreground">Kolom {k}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10.5px] font-bold px-2 py-0.5 ${
                          isLunas
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}
                      >
                        {summary.statusLabel}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                      <div className="flex justify-between">
                        <span>Total Disetor:</span>
                        <strong className="text-foreground font-mono">{rupiah(summary.totalSetorRp)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Kewajiban Total:</span>
                        <span className="font-semibold text-muted-foreground font-mono">
                          {rupiah(summary.totalKewajibanRp)}
                        </span>
                      </div>

                      {/* Info Tunggakan Tahun Lalu jika ada */}
                      {summary.detailTahunLalu.kewajibanTahunLaluRp > 0 && (
                        <div className="flex justify-between text-[11px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                          <span>Thn Lalu ({rupiah(summary.detailTahunLalu.kewajibanTahunLaluRp)}):</span>
                          <span className={summary.detailTahunLalu.lunas ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
                            {summary.detailTahunLalu.lunas ? "✓ Lunas" : `Kurang ${rupiah(summary.detailTahunLalu.sisaTunggakanTahunLaluRp)}`}
                          </span>
                        </div>
                      )}

                      {!isLunas && summary.totalSisaTunggakanRp > 0 && (
                        <div className="flex justify-between text-amber-800 font-semibold bg-amber-100/60 px-1.5 py-0.5 rounded">
                          <span>Sisa Kurang:</span>
                          <span className="font-mono font-bold">{rupiah(summary.totalSisaTunggakanRp)}</span>
                        </div>
                      )}

                      <div className="flex justify-between pt-1 border-t text-[11px]">
                        <span>Duka Thn Ini Lunas:</span>
                        <span className="font-semibold text-primary">
                          {summary.jumlahDukaTerbayar} dari {summary.totalKasusDuka} Tahap
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between gap-1 text-[11px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDetailKolom(summary);
                        setDetailModalOpen(true);
                      }}
                      className="h-7 px-2 text-xs text-primary font-semibold hover:bg-primary/10"
                    >
                      <Receipt className="size-3 mr-1" /> Rincian Pelunasan ({summary.riwayatTrx.length})
                    </Button>

                    {isOverride && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetOverride(k)}
                        title="Reset ke otomatis"
                        className="h-7 px-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <RotateCcw className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* TAB 2: MASTER DAFTAR NAMA KASUS DUKA */}
        <TabsContent value="daftar-duka" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <HeartHandshake className="size-4 text-primary" /> Daftar Peristiwa Duka Tahun Berjalan
                </CardTitle>
                <CardDescription className="text-xs">
                  Urutan tahap duka, nama almarhum/keluarga, tanggal, dan besaran iuran dasar.
                </CardDescription>
              </div>
              <Button size="sm" onClick={openAddDialog} className="gap-1.5 text-xs font-semibold">
                <Plus className="size-3.5" /> Tambah Kasus Duka
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-y text-muted-foreground font-semibold">
                      <th className="py-2.5 px-4 w-16 text-center">Tahap</th>
                      <th className="py-2.5 px-4">Nama Almarhum / Keluarga Duka</th>
                      <th className="py-2.5 px-4 w-28">Tanggal Duka</th>
                      <th className="py-2.5 px-4 w-24">Asal Kolom</th>
                      <th className="py-2.5 px-4 w-40 text-right">Target Dinamis (29 Kolom)</th>
                      <th className="py-2.5 px-4">Keterangan</th>
                      <th className="py-2.5 px-4 w-24 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {daftarDuka.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                          Belum ada daftar nama duka yang ditambahkan. Klik <strong>"Tambah Kasus Duka"</strong> untuk memulai.
                        </td>
                      </tr>
                    ) : (
                      daftarDuka.map((item) => {
                        const targetInfo = hitungTotalTargetDukaTahap(item, tarifRules);
                        return (
                          <tr key={item.id} className="hover:bg-muted/20">
                            <td className="py-3 px-4 text-center font-black text-primary">
                              #{item.urutan}
                            </td>
                            <td className="py-3 px-4 font-bold text-foreground">
                              {item.nama}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                              {tanggal(item.tanggal)}
                            </td>
                            <td className="py-3 px-4">
                              {item.kolomKeluarga ? (
                                <Badge variant="outline" className="text-[10px] font-semibold">
                                  Kolom {item.kolomKeluarga}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <strong className="font-mono font-bold text-foreground block">
                                {rupiah(targetInfo.totalTargetRp)}
                              </strong>
                              <span className="text-[10px] text-muted-foreground block">
                                Rata-rata {rupiah(targetInfo.rataRataPerKolom)} / kolom
                              </span>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {item.keterangan || "-"}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(item)}
                                  className="size-7 p-0 text-muted-foreground hover:text-primary"
                                >
                                  <Edit2 className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteKasusDuka(item.id, item.nama)}
                                  className="size-7 p-0 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: TUNGGAKAN DUKA TAHUN LALU (INPUT MANUAL SALDO AWAL TUNGGAKAN) */}
        <TabsContent value="tahun-lalu" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="size-4 text-primary" /> Tunggakan Duka dari Tahun Lalu (Saldo Awal per Kolom)
              </CardTitle>
              <CardDescription className="text-xs">
                Isi manual sisa tunggakan duka dari tahun lalu untuk setiap kolom. Pembayaran setoran baru dari kolom tersebut akan otomatis dialokasikan untuk melunasi tunggakan tahun lalu terlebih dahulu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                <Sparkles className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Alokasi Otomatis:</strong> Nilai yang diisi di sini tersimpan otomatis. Ketika sebuah kolom menyetor dana duka di kas jemaat, sistem akan memprioritaskan pelunasan sisa duka tahun lalu ini sebelum masuk ke tagihan duka tahun berjalan.
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {DUKA_KOLOM.map((k) => {
                  const info = tunggakanLaluMap[k] || { kolom: k, nominalRp: 0, jumlahKasus: 0, keterangan: "" };
                  const summary = ringkasanKolom[k];
                  const detailLalu = summary?.detailTahunLalu;

                  return (
                    <div key={k} className="p-3 rounded-xl border bg-card space-y-2 shadow-xs">
                      <div className="flex items-center justify-between pb-1 border-b">
                        <strong className="text-xs font-bold text-foreground">Kolom {k}</strong>
                        {info.nominalRp > 0 && (
                          <Badge
                            variant="outline"
                            className={`text-[9.5px] font-bold ${
                              detailLalu?.lunas
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                : "bg-amber-50 text-amber-800 border-amber-300"
                            }`}
                          >
                            {detailLalu?.lunas ? "✓ Lunas Terbayar" : "Tertunggak"}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`tunggakan-nom-${k}`} className="text-[10.5px] font-semibold text-muted-foreground">
                          Sisa Nominal Thn Lalu (Rp):
                        </Label>
                        <Input
                          id={`tunggakan-nom-${k}`}
                          type="number"
                          value={info.nominalRp || 0}
                          onChange={(e) => handleTunggakanLaluChange(k, "nominalRp", e.target.value)}
                          placeholder="0"
                          className="h-8 text-xs font-mono font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor={`tunggakan-kasus-${k}`} className="text-[10px] text-muted-foreground">
                            Jumlah Duka:
                          </Label>
                          <Input
                            id={`tunggakan-kasus-${k}`}
                            type="number"
                            value={info.jumlahKasus || (info.nominalRp > 0 ? 1 : 0)}
                            onChange={(e) => handleTunggakanLaluChange(k, "jumlahKasus", e.target.value)}
                            placeholder="1"
                            className="h-7 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`tunggakan-ket-${k}`} className="text-[10px] text-muted-foreground">
                            Catatan:
                          </Label>
                          <Input
                            id={`tunggakan-ket-${k}`}
                            value={info.keterangan || ""}
                            onChange={(e) => handleTunggakanLaluChange(k, "keterangan", e.target.value)}
                            placeholder="Thn 2025"
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: PENGATURAN TARIF DINAMIS PER KOLOM */}
        <TabsContent value="tarif-dinamis" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-primary" /> Aturan Perubahan Tarif Iuran per Kolom
                </CardTitle>
                <CardDescription className="text-xs">
                  Atur tarif iuran berbeda per kolom, dan tentukan penyesuaian tarif bertambah/berkurang mulai dari duka tahap ke-berapa.
                </CardDescription>
              </div>
              <Button size="sm" onClick={openAddRuleModal} className="gap-1.5 text-xs font-semibold">
                <Plus className="size-3.5" /> Tambah Aturan Perubahan Tarif
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                <Sparkles className="size-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Fleksibel & Dinamis:</strong> Anda dapat menetapkan nilai iuran yang berbeda untuk setiap kolom (misal Kolom 1 = Rp 75.000, Kolom 2 = Rp 50.000). Jika di tengah jalan sidang memutuskan tarif berubah, Anda bisa menambahkan aturan baru terhitung mulai dari <strong>Duka Tahap ke-X</strong>.
                </span>
              </div>

              <div className="space-y-3">
                {tarifRules.map((rule) => {
                  const ruleCols = Object.keys(rule.tarifPerKolom).map(Number);
                  const isAllCols = ruleCols.length >= 29;

                  return (
                    <div key={rule.id} className="p-4 border rounded-xl bg-card shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b">
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm text-foreground">{rule.namaAturan}</strong>
                            <Badge variant="secondary" className="text-[10px] font-bold">
                              Mulai Duka Tahap #{rule.mulaiTahap}
                              {rule.sampaiTahap ? ` s/d #${rule.sampaiTahap}` : " Seterusnya"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold ${
                                isAllCols
                                  ? "bg-blue-50 text-blue-700 border-blue-300"
                                  : "bg-purple-50 text-purple-700 border-purple-300"
                              }`}
                            >
                              {isAllCols ? "Semua 29 Kolom" : `Khusus ${ruleCols.length} Kolom Terpilih`}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{rule.keterangan || "Aturan tarif berlaku"}</p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditRuleModal(rule)}
                            className="h-8 text-xs gap-1 font-medium"
                          >
                            <Edit2 className="size-3" /> Edit Tarif
                          </Button>
                          {tarifRules.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRule(rule.id, rule.namaAturan)}
                              className="h-8 text-xs text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Preview Tarif Kolom yang Terpengaruh */}
                      <div className="space-y-1.5">
                        <span className="text-[10.5px] font-semibold text-muted-foreground block">
                          {isAllCols
                            ? "Tarif Iuran Seluruh Kolom 1 s/d 29:"
                            : `Daftar ${ruleCols.length} Kolom yang Mengalami Perubahan Tarif (Kolom lainnya mengikuti aturan sebelumnya):`}
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 text-[11px]">
                          {(isAllCols ? DUKA_KOLOM : ruleCols.sort((a, b) => a - b)).map((k) => (
                            <div key={k} className="p-1.5 rounded-lg border bg-muted/20 text-center">
                              <span className="text-[10px] text-muted-foreground block font-medium">Kolom {k}</span>
                              <strong className="font-mono text-foreground">
                                {rupiah(rule.tarifPerKolom[k] ?? DEFAULT_TARIF_DUKA)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL DIALOG TAMBAH / EDIT KASUS DUKA */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <HeartHandshake className="size-4 text-primary" />
              {editingDuka ? "Edit Peristiwa Duka Jemaat" : "Tambah Peristiwa / Nama Duka Baru"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan identitas keluarga duka. Status pelunasan kolom akan otomatis dihitung berdasarkan tahapan ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="formUrutan" className="font-semibold">
                  Duka Tahap <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="formUrutan"
                  type="number"
                  min="1"
                  value={formUrutan}
                  onChange={(e) => setFormUrutan(Number(e.target.value))}
                  className="h-9 text-xs font-bold text-primary"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="formTanggal" className="font-semibold">
                  Tanggal Duka <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="formTanggal"
                  type="date"
                  value={formTanggal}
                  onChange={(e) => setFormTanggal(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="formNama" className="font-semibold">
                Nama Almarhum / Keluarga Duka <span className="text-destructive">*</span>
              </Label>
              <Input
                id="formNama"
                value={formNama}
                onChange={(e) => setFormNama(e.target.value)}
                placeholder="Contoh: Alm. Bpk. A. Rumagit (Kel. Rumagit - Kawalo)"
                className="h-9 text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="formKolom" className="font-semibold">
                  Asal Kolom Keluarga (Opsional)
                </Label>
                <Input
                  id="formKolom"
                  type="number"
                  min="1"
                  max="29"
                  value={formKolom}
                  onChange={(e) => setFormKolom(e.target.value)}
                  placeholder="Contoh: 15"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="formKeterangan" className="font-semibold">
                  Catatan / Keterangan
                </Label>
                <Input
                  id="formKeterangan"
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  placeholder="Contoh: Pemakaman di Ranomuut"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* LIVE DYNAMIC TOTAL TARGET 29 KOLOM */}
            {(() => {
              const dummy: KasusDuka = {
                id: "temp",
                urutan: formUrutan,
                nama: formNama,
                tanggal: formTanggal,
                iuranPerKolom: DEFAULT_TARIF_DUKA,
              };
              const targetInfo = hitungTotalTargetDukaTahap(dummy, tarifRules);
              return (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary flex items-center gap-1.5 text-[11px]">
                      <Sparkles className="size-3.5" /> Target Akumulasi Dinamis (29 Kolom):
                    </span>
                    <strong className="font-mono text-xs text-foreground font-bold">
                      {rupiah(targetInfo.totalTargetRp)}
                    </strong>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Dihitung otomatis mengikuti jumlah & matriks tarif spesifik masing-masing kolom pada Tahap #{formUrutan} (Rata-rata {rupiah(targetInfo.rataRataPerKolom)} / kolom).
                  </p>
                </div>
              );
            })()}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="text-xs">
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveKasusDuka} className="text-xs font-semibold gap-1.5">
              <Save className="size-3.5" /> Simpan Data Duka
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL ATURAN TARIF DINAMIS PER KOLOM */}
      <Dialog open={ruleModalOpen} onOpenChange={setRuleModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              {editingRule ? "Edit Aturan Tarif Kolom" : "Tambah Aturan Perubahan Tarif"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Atur nilai iuran berbeda untuk setiap kolom 1 s/d 29 dan tentukan mulai duka tahap ke-berapa perubahan ini berlaku.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="ruleNama" className="font-semibold">
                  Nama Aturan / Dasar Keputusan <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ruleNama"
                  value={ruleNama}
                  onChange={(e) => setRuleNama(e.target.value)}
                  placeholder="Contoh: Penyesuaian Iuran Sidang Majelis Triwulan II"
                  className="h-9 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ruleMulaiTahap" className="font-semibold text-primary">
                  Mulai Duka Tahap <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ruleMulaiTahap"
                  type="number"
                  min="1"
                  value={ruleMulaiTahap}
                  onChange={(e) => setRuleMulaiTahap(Number(e.target.value))}
                  className="h-9 text-xs font-bold text-primary"
                />
              </div>
            </div>

            {/* Pilihan Cakupan Mode Kolom */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-xs">Pilih Cakupan Kolom yang Mengalami Perubahan:</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRuleMode("terpilih")}
                  className={`p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                    ruleMode === "terpilih"
                      ? "bg-purple-50/80 border-purple-400 text-purple-950 font-bold shadow-xs ring-1 ring-purple-400"
                      : "bg-card border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <Users className={`size-4 shrink-0 mt-0.5 ${ruleMode === "terpilih" ? "text-purple-700" : ""}`} />
                  <div>
                    <span className="text-xs block font-bold">Hanya Kolom Tertentu yang Berubah</span>
                    <span className="text-[10px] font-normal opacity-80 block mt-0.5">
                      Pilih kolom spesifik (misal Kolom 3 & 5). Kolom lain tetap mengikuti aturan sebelumnya.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRuleMode("semua");
                    handleSelectAllKolom();
                  }}
                  className={`p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                    ruleMode === "semua"
                      ? "bg-blue-50/80 border-blue-400 text-blue-950 font-bold shadow-xs ring-1 ring-blue-400"
                      : "bg-card border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <SlidersHorizontal className={`size-4 shrink-0 mt-0.5 ${ruleMode === "semua" ? "text-blue-700" : ""}`} />
                  <div>
                    <span className="text-xs block font-bold">Semua 29 Kolom Sekaligus</span>
                    <span className="text-[10px] font-normal opacity-80 block mt-0.5">
                      Berlaku umum dan menetapkan tarif ke seluruh 29 kolom.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Jika mode "Hanya Kolom Tertentu", tampilkan chips pemilih kolom */}
            {ruleMode === "terpilih" && (
              <div className="p-3 bg-muted/30 rounded-xl border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-purple-600" />
                    Pilih Kolom yang Berubah ({selectedKolomList.length} dipilih):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllKolom}
                      className="h-6 text-[11px] px-2 text-primary"
                    >
                      Pilih Semua
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearSelectedKolom}
                      className="h-6 text-[11px] px-2 text-muted-foreground hover:text-destructive"
                    >
                      Batal Pilih
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-background rounded-lg border">
                  {DUKA_KOLOM.map((k) => {
                    const isSelected = selectedKolomList.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleSelectKolom(k)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all border ${
                          isSelected
                            ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                            : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted"
                        }`}
                      >
                        Kolom {k} {isSelected ? "✓" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Batch Set */}
            <div className="p-3 bg-muted/40 rounded-lg border flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[11px] text-foreground">
                Set Nominal Cepat untuk {ruleMode === "semua" ? "29 Kolom" : `${selectedKolomList.length} Kolom Terpilih`}:
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={ruleBatchNominal}
                  onChange={(e) => setRuleBatchNominal(e.target.value)}
                  placeholder="50000"
                  className="h-8 w-28 text-xs font-mono font-bold"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleApplyBatchTarif}
                  className="h-8 text-xs font-medium"
                >
                  Terapkan ke {ruleMode === "semua" ? "29 Kolom" : "Kolom Terpilih"}
                </Button>
              </div>
            </div>

            {/* Grid Inputs Khusus Kolom Terpilih */}
            <div className="space-y-2">
              <Label className="font-semibold text-xs">
                Tarif Iuran Kolom yang Disetel (Rp):
              </Label>
              {((ruleMode === "semua" ? DUKA_KOLOM : selectedKolomList).length === 0) ? (
                <div className="p-4 border rounded-lg text-center text-muted-foreground bg-muted/20">
                  Belum ada kolom yang dipilih. Klik tombol kolom di atas untuk menentukan kolom yang berubah.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-2 border rounded-lg bg-background">
                  {(ruleMode === "semua" ? DUKA_KOLOM : selectedKolomList.sort((a, b) => a - b)).map((k) => (
                    <div key={k} className="space-y-1 p-2 rounded border bg-muted/10">
                      <Label htmlFor={`tarif-k-${k}`} className="text-[11px] font-bold text-foreground block">
                        Kolom {k}
                      </Label>
                      <Input
                        id={`tarif-k-${k}`}
                        type="number"
                        value={ruleTarifMap[k] ?? DEFAULT_TARIF_DUKA}
                        onChange={(e) =>
                          setRuleTarifMap((prev) => ({
                            ...prev,
                            [k]: Number(e.target.value),
                          }))
                        }
                        className="h-7 text-xs font-mono font-bold"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRuleModalOpen(false)} className="text-xs">
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveRule} className="text-xs font-semibold gap-1.5">
              <Save className="size-3.5" /> Simpan Aturan Tarif
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DIALOG DETAIL SETORAN & TAHAPAN KOLOM */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Receipt className="size-4 text-primary" /> Rincian Duka Kolom {detailKolom?.kolom}
              </span>
              <Badge
                variant="outline"
                className={`text-xs font-bold ${
                  detailKolom?.tunggakanJumlah === 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                }`}
              >
                {detailKolom?.statusLabel}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Status pelunasan bertahap (FIFO) dan riwayat transaksi penerimaan kas duka Kolom {detailKolom?.kolom}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Box Ringkasan */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/30 border text-center">
              <div>
                <span className="text-muted-foreground block text-[10.5px]">Total Disetor</span>
                <span className="text-xs sm:text-sm font-bold text-emerald-700 font-mono">
                  {rupiah(detailKolom?.totalSetorRp ?? 0)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10.5px]">Total Kewajiban</span>
                <span className="text-xs sm:text-sm font-bold text-foreground font-mono">
                  {rupiah(detailKolom?.totalKewajibanRp ?? 0)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10.5px]">Sisa Tunggakan</span>
                <span className="text-xs sm:text-sm font-bold text-amber-700 font-mono">
                  {rupiah(detailKolom?.totalSisaTunggakanRp ?? 0)}
                </span>
              </div>
            </div>

            {/* Rincian Pelunasan Tunggakan Tahun Lalu */}
            {detailKolom && detailKolom.detailTahunLalu.kewajibanTahunLaluRp > 0 && (
              <div className="p-3 rounded-lg border bg-amber-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <History className="size-3.5 text-amber-700" /> Tunggakan dari Tahun Lalu:
                  </span>
                  {detailKolom.detailTahunLalu.lunas ? (
                    <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      ✓ Lunas Terbayar
                    </span>
                  ) : (
                    <span className="text-[10.5px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                      Sisa Kurang: {rupiah(detailKolom.detailTahunLalu.sisaTunggakanTahunLaluRp)}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground flex justify-between">
                  <span>Kewajiban: {rupiah(detailKolom.detailTahunLalu.kewajibanTahunLaluRp)} ({detailKolom.detailTahunLalu.kasusTahunLalu}x duka)</span>
                  <span>Terbayar dari setoran baru: <strong className="text-foreground">{rupiah(detailKolom.detailTahunLalu.terbayarTahunLaluRp)}</strong></span>
                </div>
              </div>
            )}

            {/* Status Pelunasan per Kasus / Tahap Duka Tahun Berjalan */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-xs flex items-center justify-between">
                <span>Rincian Pelunasan Tahap Duka Tahun Berjalan:</span>
                <span className="text-[10.5px] font-normal text-muted-foreground">
                  Lunas: {detailKolom?.jumlahDukaTerbayar} dari {detailKolom?.totalKasusDuka} Tahap
                </span>
              </Label>

              <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded-lg p-2 bg-background divide-y">
                {detailKolom?.detailTahap.map((tahap) => (
                  <div key={tahap.kasusId} className="pt-1.5 pb-1 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground">Tahap #{tahap.urutan}:</span>
                        <span className="font-medium text-foreground truncate max-w-[200px]">{tahap.nama}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Kewajiban: {rupiah(tahap.kewajibanRp)} · {tanggal(tahap.tanggal)}
                      </span>
                    </div>

                    <div className="text-right">
                      {tahap.lunas ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <CheckCircle2 className="size-3" /> LUNAS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                          <Clock className="size-3" /> Kurang {rupiah(tahap.sisaKurangRp)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Riwayat Transaksi */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-xs">Transaksi Kas Penerimaan Tercatat:</Label>
              {(!detailKolom?.riwayatTrx || detailKolom.riwayatTrx.length === 0) ? (
                <p className="text-muted-foreground italic text-center py-3 bg-muted/10 rounded border">
                  Belum ada transaksi setoran kas yang masuk untuk Kolom {detailKolom?.kolom}.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto border rounded-lg divide-y">
                  {detailKolom.riwayatTrx.map((t) => (
                    <div key={t.id} className="p-2 flex items-center justify-between hover:bg-muted/20">
                      <div>
                        <div className="font-bold text-foreground">{t.voucher_no} — {tanggal(t.trx_date)}</div>
                        <div className="text-[10.5px] text-muted-foreground">{t.description}</div>
                      </div>
                      <div className="font-mono font-bold text-emerald-700">
                        {rupiah(t.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form Override Manual Jika Perlu */}
            {detailKolom && (
              <div className="pt-2 border-t space-y-1.5">
                <Label htmlFor="manualOverride" className="text-[11px] font-semibold text-muted-foreground">
                  Koreksi / Override Status Manual (Opsional):
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="manualOverride"
                    placeholder="Contoh: Lunas atau 1 x Duka"
                    value={overrideMap[String(detailKolom.kolom)] ?? ""}
                    onChange={(e) => handleOverrideStatus(detailKolom.kolom, e.target.value)}
                    className="h-8 text-xs"
                  />
                  {overrideMap[String(detailKolom.kolom)] && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetOverride(detailKolom.kolom)}
                      className="h-8 text-xs text-destructive shrink-0"
                    >
                      Reset Otomatis
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setDetailModalOpen(false)} className="text-xs">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
