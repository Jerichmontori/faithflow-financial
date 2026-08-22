import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  Church,
  Settings,
  Image,
  Upload,
  Save,
  RotateCcw,
  PenTool,
  CheckCircle2,
  Building,
  MapPin,
  FileText,
  UserCheck,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAppSettings, DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rupiah, tanggalPanjang, terbilang } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pengaturan")({
  head: () => ({
    meta: [
      { title: "Pengaturan Awal & Profil Gereja — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Pengaturan nama gereja, wilayah, alamat, logo aplikasi, serta penandatangan kuitansi dan laporan keuangan.",
      },
      { property: "og:title", content: "Pengaturan Awal — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Kelola profil jemaat, logo aplikasi, dan nama penandatangan kwitansi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PengaturanPage,
});

function PengaturanPage() {
  const { settings, updateSettings, resetSettings } = useAppSettings();
  const { canManageFinance } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [logoPreview, setLogoPreview] = useState<string>(settings.logoUrl || "/favicon.png");

  const handleChange = (field: keyof AppSettings, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran logo maksimal 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogoPreview(result);
      setForm((prev) => ({ ...prev, logoUrl: result }));
      toast.success("Logo berhasil dipilih. Klik 'Simpan Pengaturan' untuk menerapkan.");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    updateSettings(form);
    toast.success("Pengaturan awal berhasil disimpan dan diterapkan ke seluruh aplikasi!");
  };

  const handleReset = () => {
    if (confirm("Kembalikan semua pengaturan ke nilai standar GMIM Bukit Moria Tikala Baru?")) {
      resetSettings();
      setForm(DEFAULT_SETTINGS);
      setLogoPreview(DEFAULT_SETTINGS.logoUrl);
      toast.info("Pengaturan telah direset ke nilai standar.");
    }
  };

  return (
    <AppShell
      title="Pengaturan Awal & Profil Gereja"
      subtitle="Kelola identitas jemaat, nama aplikasi, logo, dan nama pejabat penandatangan kuitansi"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 text-xs">
            <RotateCcw className="size-3.5" /> Reset Standar
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5 text-xs font-semibold shadow-sm">
            <Save className="size-3.5" /> Simpan Pengaturan
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Kolom Kiri: Form Input Pengaturan */}
        <div className="lg:col-span-7 space-y-6">
          <Tabs defaultValue="profil" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profil" className="text-xs">
                <Church className="size-3.5 mr-1.5" /> Profil Gereja
              </TabsTrigger>
              <TabsTrigger value="aplikasi" className="text-xs">
                <Settings className="size-3.5 mr-1.5" /> Identitas & Logo
              </TabsTrigger>
              <TabsTrigger value="ttd" className="text-xs">
                <PenTool className="size-3.5 mr-1.5" /> Penandatangan
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: PROFIL GEREJA */}
            <TabsContent value="profil" className="space-y-4 pt-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="size-4 text-primary" /> Identitas Jemaat / Gereja
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Informasi ini digunakan sebagai kop surat resmi pada Kwitansi, Warta Keuangan, dan Laporan.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <Label htmlFor="namaGereja" className="font-semibold">
                      Nama Gereja / Jemaat <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="namaGereja"
                      value={form.namaGereja}
                      onChange={(e) => handleChange("namaGereja", e.target.value)}
                      placeholder="Contoh: Gereja Masehi Injili di Minahasa (GMIM) Jemaat Bukit Moria Tikala Baru"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="wilayah" className="font-semibold">
                      Wilayah <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="wilayah"
                      value={form.wilayah}
                      onChange={(e) => handleChange("wilayah", e.target.value)}
                      placeholder="Contoh: Wilayah Manado Wawonasa Kombos"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="alamatGereja" className="font-semibold">
                      Alamat Lengkap Gereja <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="alamatGereja"
                      value={form.alamatGereja}
                      onChange={(e) => handleChange("alamatGereja", e.target.value)}
                      placeholder="Contoh: Jl. Lumimuut, Tikala Baru, Kec. Tikala, Kota Manado, Sulawesi Utara"
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: IDENTITAS APLIKASI & LOGO */}
            <TabsContent value="aplikasi" className="space-y-4 pt-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Image className="size-4 text-primary" /> Nama Aplikasi & Logo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Kustomisasi judul sistem di header/sidebar serta logo aplikasi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <Label htmlFor="namaAplikasi" className="font-semibold">
                      Nama Aplikasi <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="namaAplikasi"
                      value={form.namaAplikasi}
                      onChange={(e) => handleChange("namaAplikasi", e.target.value)}
                      placeholder="Contoh: BUMOTIK FINANCIAL"
                      className="h-9 text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="subtitleAplikasi" className="font-semibold">
                      Subtitle / Keterangan Aplikasi
                    </Label>
                    <Input
                      id="subtitleAplikasi"
                      value={form.subtitleAplikasi}
                      onChange={(e) => handleChange("subtitleAplikasi", e.target.value)}
                      placeholder="Contoh: Sistem Manajemen & Keuangan Gereja"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <Label className="font-semibold">Logo Aplikasi</Label>
                    <div className="flex items-center gap-4">
                      <div className="size-16 rounded-lg border bg-muted/40 p-1 flex items-center justify-center overflow-hidden shadow-xs shrink-0">
                        <img
                          src={logoPreview}
                          alt="Logo Preview"
                          className="size-full object-contain"
                          onError={() => setLogoPreview("/favicon.png")}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleLogoUpload}
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          className="hidden"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="gap-1.5 text-xs h-8"
                          >
                            <Upload className="size-3.5" /> Ganti Logo (PNG/JPG)
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setLogoPreview("/favicon.png");
                              setForm((prev) => ({ ...prev, logoUrl: "/favicon.png" }));
                            }}
                            className="text-xs h-8 text-muted-foreground"
                          >
                            Pakai Default
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Format PNG transparan atau JPG, disarankan rasio 1:1 (persegi).
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: PENANDATANGAN KWITANSI */}
            <TabsContent value="ttd" className="space-y-4 pt-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="size-4 text-primary" /> Pejabat Penandatangan Kwitansi & Laporan
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Nama dan jabatan pejabat yang otomatis tercetak pada kolom tanda tangan bukti setoran/kuitansi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="kotaSurat" className="font-semibold">
                        Kota Surat & Tanggal <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="kotaSurat"
                        value={form.kotaSurat}
                        onChange={(e) => handleChange("kotaSurat", e.target.value)}
                        placeholder="Contoh: Manado"
                        className="h-9 text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Akan tercetak sebagai: <em>"{form.kotaSurat || "Manado"}, [Tanggal Transaksi]"</em>
                      </p>
                    </div>

                    {/* Ketua BPMJ */}
                    <div className="space-y-1.5 p-3 rounded-lg border bg-muted/20">
                      <Label htmlFor="namaKetuaBpmj" className="font-bold text-primary">
                        Nama Ketua BPMJ / Pendeta <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="namaKetuaBpmj"
                        value={form.namaKetuaBpmj}
                        onChange={(e) => handleChange("namaKetuaBpmj", e.target.value)}
                        placeholder="Contoh: Pdt. Handry Mecky Dengah, M.Th"
                        className="h-9 text-xs font-semibold"
                      />
                      <Label htmlFor="jabatanKetuaBpmj" className="font-semibold text-muted-foreground mt-2 block">
                        Jabatan
                      </Label>
                      <Input
                        id="jabatanKetuaBpmj"
                        value={form.jabatanKetuaBpmj}
                        onChange={(e) => handleChange("jabatanKetuaBpmj", e.target.value)}
                        placeholder="Contoh: Ketua BPMJ"
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Bendahara Jemaat */}
                    <div className="space-y-1.5 p-3 rounded-lg border bg-muted/20">
                      <Label htmlFor="namaBendahara" className="font-bold text-primary">
                        Nama Bendahara Jemaat <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="namaBendahara"
                        value={form.namaBendahara}
                        onChange={(e) => handleChange("namaBendahara", e.target.value)}
                        placeholder="Contoh: Dkn. Jerich Montori"
                        className="h-9 text-xs font-semibold"
                      />
                      <Label htmlFor="jabatanBendahara" className="font-semibold text-muted-foreground mt-2 block">
                        Jabatan
                      </Label>
                      <Input
                        id="jabatanBendahara"
                        value={form.jabatanBendahara}
                        onChange={(e) => handleChange("jabatanBendahara", e.target.value)}
                        placeholder="Contoh: Bendahara Jemaat"
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Label Penyetor & Penerima */}
                    <div className="space-y-1.5">
                      <Label htmlFor="labelPenyetor" className="font-semibold">
                        Label Kolom Penyetor (Penerimaan)
                      </Label>
                      <Input
                        id="labelPenyetor"
                        value={form.labelPenyetor}
                        onChange={(e) => handleChange("labelPenyetor", e.target.value)}
                        placeholder="Penyetor / Yang Menyerahkan"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="labelPenerima" className="font-semibold">
                        Label Kolom Penerima (Pengeluaran)
                      </Label>
                      <Input
                        id="labelPenerima"
                        value={form.labelPenerima}
                        onChange={(e) => handleChange("labelPenerima", e.target.value)}
                        placeholder="Penerima Kas"
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button size="sm" onClick={handleSave} className="gap-1.5 text-xs font-semibold w-full sm:w-auto">
              <Save className="size-3.5" /> Simpan Perubahan Pengaturan
            </Button>
          </div>
        </div>

        {/* Kolom Kanan: Pratinjau Langsung (Live Preview Kuitansi F4) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="size-3.5 text-primary" /> Live Pratinjau Kuitansi F4
            </h3>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              Real-time update
            </span>
          </div>

          <div className="rounded-xl border bg-white p-4 text-black shadow-md text-[10px] leading-snug">
            {/* Kop Surat Live Preview */}
            <div className="border-b-2 border-black pb-2 mb-2 flex items-center justify-between text-center">
              <div className="w-full text-center">
                <h2 className="text-[11.5px] font-black uppercase tracking-wide leading-tight">
                  {form.namaGereja || "NAMA GEREJA"}
                </h2>
                <h3 className="text-[10px] font-extrabold uppercase mt-0.5 text-gray-800">
                  {form.wilayah || "WILAYAH"}
                </h3>
                <p className="text-[8px] text-gray-600 mt-0.5 truncate">
                  {form.alamatGereja || "Alamat Gereja"}
                </p>
              </div>
            </div>

            {/* Judul Dokumen */}
            <div className="text-center my-1.5">
              <span className="inline-block text-[8px] font-bold border border-black px-1.5 py-0.2 uppercase bg-gray-100 mb-1">
                LEMBAR 1: UNTUK ARSIP GEREJA / BENDAHARA
              </span>
              <h4 className="text-[11px] font-black uppercase underline tracking-wide">
                BUKTI PENERIMAAN KAS
              </h4>
              <span className="text-[8px] font-bold text-gray-600 uppercase block">
                (TANDA TERIMA SETORAN)
              </span>
            </div>

            {/* Metadata Ringkas */}
            <div className="space-y-0.5 my-2 text-[9px] border-t pt-1.5 border-dashed border-gray-300">
              <div className="grid grid-cols-12">
                <span className="col-span-4 font-bold text-gray-800">No. Bukti</span>
                <span className="col-span-8 font-mono font-bold">: KM-2026-3050</span>
              </div>
              <div className="grid grid-cols-12">
                <span className="col-span-4 font-bold text-gray-800">Tanggal</span>
                <span className="col-span-8">: {tanggalPanjang(new Date().toISOString().slice(0, 10))}</span>
              </div>
              <div className="grid grid-cols-12">
                <span className="col-span-4 font-bold text-gray-800">Telah Terima Dari</span>
                <span className="col-span-8 font-bold uppercase">: Jemaat / Kolom 15</span>
              </div>
              <div className="grid grid-cols-12">
                <span className="col-span-4 font-bold text-gray-800">Mata Anggaran</span>
                <span className="col-span-8">: 1.3.50.01 — Persembahan Ibadah Subuh</span>
              </div>
            </div>

            {/* Nominal Box */}
            <div className="border border-black p-1.5 my-1.5 bg-gray-50 flex items-center justify-between">
              <div>
                <span className="text-[7.5px] uppercase font-bold text-gray-600 block">Jumlah Uang:</span>
                <span className="text-[11.5px] font-black font-mono text-black">
                  {rupiah(2500000)}
                </span>
              </div>
              <div className="text-right max-w-[65%]">
                <span className="text-[7.5px] uppercase font-bold text-gray-600 block">Terbilang:</span>
                <span className="text-[8px] font-bold italic text-black leading-tight block">
                  "{terbilang(2500000)}"
                </span>
              </div>
            </div>

            {/* Live Tanda Tangan */}
            <table className="w-full mt-2 text-center text-[8px] border-collapse">
              <tbody>
                <tr>
                  <td className="w-1/3">
                    <span>{form.labelPenyetor || "Penyetor"},</span>
                    <div className="h-6"></div>
                    <span className="font-bold underline block">( .......................... )</span>
                  </td>
                  <td className="w-1/3">
                    <span>Mengetahui,</span>
                    <span className="block text-[7.5px] text-gray-600">{form.jabatanKetuaBpmj || "Ketua BPMJ"}</span>
                    <div className="h-4"></div>
                    <span className="font-bold underline block">
                      ( {form.namaKetuaBpmj || ".........................."} )
                    </span>
                  </td>
                  <td className="w-1/3">
                    <span>{form.kotaSurat || "Manado"}, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span className="block font-medium">{form.jabatanBendahara || "Bendahara Jemaat"},</span>
                    <div className="h-4"></div>
                    <span className="font-bold underline block">
                      ( {form.namaBendahara || ".........................."} )
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
            <CheckCircle2 className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Perubahan pada nama gereja, wilayah, dan pejabat tanda tangan akan langsung diterapkan otomatis saat Anda mencetak kuitansi dari menu <strong>Penerimaan</strong> dan <strong>Pengeluaran</strong>.
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
