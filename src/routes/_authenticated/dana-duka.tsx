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
  FileSpreadsheet,
  Trash2,
  Edit2,
  Users,
  Wallet,
  Receipt,
  Search,
  RotateCcw,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { transactionsQuery, type Transaction } from "@/lib/queries";
import { rupiah, tanggal, tanggalPanjang } from "@/lib/format";
import {
  DUKA_KOLOM,
  bacaDaftarDuka,
  simpanDaftarDuka,
  bacaDuka,
  simpanDuka,
  hitungSemuaTunggakanDuka,
  type KasusDuka,
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
          "Daftar nama kasus duka, otomatisasi pelunasan setoran kolom, dan monitoring tunggakan dana duka Kolom 1 sampai 29 terintegrasi Warta Jemaat.",
      },
      { property: "og:title", content: "Dana Diakonia Duka Jemaat — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Otomatisasi pencatatan setoran duka dan monitoring tunggakan setiap kolom jemaat.",
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
  const [overrideMap, setOverrideMap] = useState<DukaMap>({});
  const [activeTab, setActiveTab] = useState("matriks");
  const [searchTerm, setSearchTerm] = useState("");

  // State Modal Tambah/Edit Duka
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDuka, setEditingDuka] = useState<KasusDuka | null>(null);
  const [formNama, setFormNama] = useState("");
  const [formTanggal, setFormTanggal] = useState("");
  const [formKolom, setFormKolom] = useState<string>("");
  const [formTarif, setFormTarif] = useState<string>(String(DEFAULT_TARIF_DUKA));
  const [formKeterangan, setFormKeterangan] = useState("");

  // State Modal Detail Kolom
  const [detailKolom, setDetailKolom] = useState<KolomDukaSummary | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Load data on mount & event
  useEffect(() => {
    setDaftarDuka(bacaDaftarDuka());
    setOverrideMap(bacaDuka());

    const handleUpdate = () => {
      setDaftarDuka(bacaDaftarDuka());
      setOverrideMap(bacaDuka());
    };

    window.addEventListener("bumotik_duka_updated", handleUpdate);
    return () => window.removeEventListener("bumotik_duka_updated", handleUpdate);
  }, []);

  // Hitung status tunggakan duka seluruh kolom 1-29 secara otomatis
  const ringkasanKolom = useMemo(() => {
    return hitungSemuaTunggakanDuka(trx.data ?? [], daftarDuka, overrideMap);
  }, [trx.data, daftarDuka, overrideMap]);

  // Statistik Ringkas
  const stats = useMemo(() => {
    const list = Object.values(ringkasanKolom);
    const totalSetoranSemua = list.reduce((a, b) => a + b.totalSetorRp, 0);
    const lunasCount = list.filter((k) => k.tunggakanJumlah === 0 || k.statusLabel.toLowerCase() === "lunas").length;
    const tertunggakCount = list.length - lunasCount;
    const totalKasus = daftarDuka.length;
    const totalTunggakanKasus = list.reduce((a, b) => a + b.tunggakanJumlah, 0);

    return {
      totalKasus,
      totalSetoranSemua,
      lunasCount,
      tertunggakCount,
      totalTunggakanKasus,
    };
  }, [ringkasanKolom, daftarDuka]);

  // Handlers CRUD Kasus Duka
  const openAddDialog = () => {
    setEditingDuka(null);
    setFormNama("");
    setFormTanggal(new Date().toISOString().slice(0, 10));
    setFormKolom("");
    setFormTarif(String(DEFAULT_TARIF_DUKA));
    setFormKeterangan("");
    setDialogOpen(true);
  };

  const openEditDialog = (item: KasusDuka) => {
    setEditingDuka(item);
    setFormNama(item.nama);
    setFormTanggal(item.tanggal);
    setFormKolom(item.kolomKeluarga ? String(item.kolomKeluarga) : "");
    setFormTarif(String(item.iuranPerKolom || DEFAULT_TARIF_DUKA));
    setFormKeterangan(item.keterangan || "");
    setDialogOpen(true);
  };

  const handleSaveKasusDuka = () => {
    if (!formNama.trim()) {
      toast.error("Nama almarhum/keluarga duka wajib diisi");
      return;
    }

    const tarif = Number(formTarif.replace(/[^\d]/g, "")) || DEFAULT_TARIF_DUKA;
    const kolomKel = formKolom ? Number(formKolom) : null;

    let updated: KasusDuka[];
    if (editingDuka) {
      updated = daftarDuka.map((d) =>
        d.id === editingDuka.id
          ? {
              ...d,
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
        urutan: daftarDuka.length + 1,
        nama: formNama.trim(),
        tanggal: formTanggal,
        kolomKeluarga: kolomKel,
        iuranPerKolom: tarif,
        keterangan: formKeterangan.trim(),
      };
      updated = [...daftarDuka, newItem];
      toast.success("Nama duka baru berhasil ditambahkan! Status tunggakan kolom otomatis terhitung.");
    }

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
        String(info.totalSetorRp).includes(q)
      );
    });
  }, [ringkasanKolom, searchTerm]);

  return (
    <AppShell
      title="Dana Diakonia Duka Jemaat"
      subtitle="Manajemen nama duka jemaat & otomatisasi perhitungan tunggakan per kolom"
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
            <div className="text-2xl font-black text-foreground">{stats.totalKasus} Kasus</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tercatat pada tahun buku berjalan</p>
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
            <p className="text-[11px] text-muted-foreground mt-0.5">Akumulasi penerimaan kas duka kolom</p>
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
            <p className="text-[11px] text-muted-foreground mt-0.5">Tidak memiliki tunggakan duka</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-xs">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Kolom Tertunggak
              </span>
              <AlertCircle className="size-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-black text-amber-700">
              {stats.tertunggakCount} <span className="text-sm font-normal text-muted-foreground">Kolom</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Total {stats.totalTunggakanKasus} tagihan kasus duka
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Utama: 1. Matriks Tunggakan, 2. Master Daftar Nama Duka */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full sm:w-auto grid-cols-2 sm:inline-flex">
          <TabsTrigger value="matriks" className="text-xs">
            <Users className="size-3.5 mr-1.5" /> Status Tunggakan 29 Kolom (Otomatis)
          </TabsTrigger>
          <TabsTrigger value="daftar-duka" className="text-xs">
            <HeartHandshake className="size-3.5 mr-1.5" /> Master Daftar Nama Duka ({daftarDuka.length})
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
              <span className="text-[11px] italic">Status otomatis terhitung dari data setoran kas masuk.</span>
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

                    <div className="space-y-1 text-xs text-muted-foreground mb-3">
                      <div className="flex justify-between">
                        <span>Total Disetor:</span>
                        <strong className="text-foreground">{rupiah(summary.totalSetorRp)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Duka Terbayar:</span>
                        <span className="font-semibold text-primary">
                          {summary.jumlahDukaTerbayar} dari {summary.totalKasusDuka} Kasus
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
                      <Receipt className="size-3 mr-1" /> Rincian Setoran ({summary.riwayatTrx.length})
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
                  <HeartHandshake className="size-4 text-primary" /> Daftar Peristiwa Duka Jemaat
                </CardTitle>
                <CardDescription className="text-xs">
                  Nama almarhum dan keluarga duka yang menjadi dasar kewajiban iuran duka setiap kolom.
                </CardDescription>
              </div>
              <Button size="sm" onClick={openAddDialog} className="gap-1.5 text-xs font-semibold">
                <Plus className="size-3.5" /> Tambah Nama Duka
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-y text-muted-foreground font-semibold">
                      <th className="py-2.5 px-4 w-12 text-center">No</th>
                      <th className="py-2.5 px-4">Nama Almarhum / Keluarga Duka</th>
                      <th className="py-2.5 px-4 w-28">Tanggal Duka</th>
                      <th className="py-2.5 px-4 w-24">Asal Kolom</th>
                      <th className="py-2.5 px-4 w-32 text-right">Iuran per Kolom</th>
                      <th className="py-2.5 px-4">Keterangan</th>
                      <th className="py-2.5 px-4 w-24 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {daftarDuka.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                          Belum ada daftar nama duka yang ditambahkan. Klik <strong>"Tambah Nama Duka"</strong> untuk memulai.
                        </td>
                      </tr>
                    ) : (
                      daftarDuka.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="py-3 px-4 text-center font-bold text-muted-foreground">
                            {idx + 1}
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
                          <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                            {rupiah(item.iuranPerKolom || DEFAULT_TARIF_DUKA)}
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
                      ))
                    )}
                  </tbody>
                </table>
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
              Masukkan identitas keluarga duka. Status pelunasan kolom akan otomatis dihitung berdasarkan peristiwa ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
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

              <div className="space-y-1.5">
                <Label htmlFor="formKolom" className="font-semibold">
                  Asal Kolom Keluarga
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="formTarif" className="font-semibold">
                Target Iuran per Kolom (Rp) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="formTarif"
                type="number"
                value={formTarif}
                onChange={(e) => setFormTarif(e.target.value)}
                placeholder="50000"
                className="h-9 text-xs font-mono font-bold"
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
                placeholder="Contoh: Tahap I / Pemakaman di Ranomuut"
                className="h-9 text-xs"
              />
            </div>
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

      {/* MODAL DIALOG DETAIL SETORAN KOLOM */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Receipt className="size-4 text-primary" /> Rincian Setoran Duka — Kolom {detailKolom?.kolom}
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
              Riwayat transaksi kas masuk penerimaan dana duka yang tercatat dari Kolom {detailKolom?.kolom}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Box Ringkasan */}
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/30 border">
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Nominal Disetor:</span>
                <span className="text-sm font-bold text-foreground font-mono">
                  {rupiah(detailKolom?.totalSetorRp ?? 0)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Pelunasan Kasus:</span>
                <span className="text-sm font-bold text-primary">
                  {detailKolom?.jumlahDukaTerbayar} dari {detailKolom?.totalKasusDuka} Duka
                </span>
              </div>
            </div>

            {/* Riwayat Transaksi */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-xs">Transaksi Penerimaan Tercatat:</Label>
              {(!detailKolom?.riwayatTrx || detailKolom.riwayatTrx.length === 0) ? (
                <p className="text-muted-foreground italic text-center py-4 bg-muted/10 rounded border">
                  Belum ada transaksi setoran dana duka yang tercatat untuk Kolom {detailKolom?.kolom}.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {detailKolom.riwayatTrx.map((t) => (
                    <div key={t.id} className="p-2.5 flex items-center justify-between hover:bg-muted/20">
                      <div>
                        <div className="font-bold text-foreground">{t.voucher_no} — {tanggal(t.trx_date)}</div>
                        <div className="text-[11px] text-muted-foreground">{t.description}</div>
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
