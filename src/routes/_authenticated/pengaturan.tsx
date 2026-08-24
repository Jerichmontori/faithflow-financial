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
  Home,
  BookOpen,
  Sparkles,
  Clock,
  ArrowRight,
  Sliders,
  Palette,
  Trash2,
  ImageIcon,
  LogIn,
  Lock,
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
          "Pengaturan nama gereja, wilayah, alamat, logo aplikasi, background beranda, tampilan login, serta penandatangan kuitansi dan laporan keuangan.",
      },
      { property: "og:title", content: "Pengaturan Awal — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Kelola profil jemaat, logo aplikasi, gambar background beranda, tampilan login, dan nama penandatangan kwitansi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PengaturanPage,
});

const WARNA_BACKGROUND_PRESET = [
  { label: "Navy GMIM", value: "#0b192c", bgClass: "bg-[#0b192c]" },
  { label: "Royal Deep Blue", value: "#1e3a8a", bgClass: "bg-[#1e3a8a]" },
  { label: "Midnight Blue", value: "#0f172a", bgClass: "bg-[#0f172a]" },
  { label: "Ocean Blue", value: "#0369a1", bgClass: "bg-[#0369a1]" },
];

function PengaturanPage() {
  const { settings, updateSettings, resetSettings } = useAppSettings();
  const { canManageFinance } = useSession();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const loginBannerInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [logoPreview, setLogoPreview] = useState<string>(settings.logoUrl || "/favicon.png");
  const [activeTab, setActiveTab] = useState("profil");

  const handleChange = (field: keyof AppSettings, value: any) => {
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

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast.error("Ukuran gambar background maksimal 3MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setForm((prev) => ({ ...prev, bannerBerandaUrl: result }));
      toast.success("Gambar background beranda berhasil dipilih. Silakan atur opacity dan klik Simpan.");
    };
    reader.readAsDataURL(file);
  };

  const handleLoginBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast.error("Ukuran gambar background maksimal 3MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setForm((prev) => ({ ...prev, bannerLoginUrl: result }));
      toast.success("Gambar background login berhasil dipilih.");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    updateSettings(form);
    toast.success("Pengaturan berhasil disimpan dan langsung diterapkan ke seluruh aplikasi, beranda & halaman login!");
  };

  const handleReset = () => {
    if (confirm("Kembalikan semua pengaturan ke nilai standar GMIM Bukit Moria Tikala Baru?")) {
      resetSettings();
      setForm(DEFAULT_SETTINGS);
      setLogoPreview(DEFAULT_SETTINGS.logoUrl);
      toast.info("Pengaturan telah direset ke nilai standar.");
    }
  };

  const currentLoginBgImage = form.bannerLoginUrl || form.bannerBerandaUrl || "";
  const currentLoginBgOpacity = (form.bannerLoginOpacity ?? 40) / 100;
  const currentLoginBgColor = form.warnaBackgroundLogin || form.warnaBackgroundBeranda || "#0b192c";

  return (
    <AppShell
      title="Pengaturan Awal & Profil Gereja"
      subtitle="Kelola identitas jemaat, logo, tampilan beranda, halaman login, dan nama penandatangan kuitansi"
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="profil" className="text-[11px] sm:text-xs px-1">
                <Church className="size-3 sm:size-3.5 mr-1" /> Profil
              </TabsTrigger>
              <TabsTrigger value="aplikasi" className="text-[11px] sm:text-xs px-1">
                <Settings className="size-3 sm:size-3.5 mr-1" /> Logo
              </TabsTrigger>
              <TabsTrigger value="beranda" className="text-[11px] sm:text-xs px-1">
                <Home className="size-3 sm:size-3.5 mr-1" /> Beranda
              </TabsTrigger>
              <TabsTrigger value="login" className="text-[11px] sm:text-xs px-1">
                <LogIn className="size-3 sm:size-3.5 mr-1" /> Login
              </TabsTrigger>
              <TabsTrigger value="ttd" className="text-[11px] sm:text-xs px-1">
                <PenTool className="size-3 sm:size-3.5 mr-1" /> Pejabat
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
                      Nama Sinode / Gereja <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="namaGereja"
                      value={form.namaGereja}
                      onChange={(e) => handleChange("namaGereja", e.target.value)}
                      placeholder="Contoh: Gereja Masehi Injili di Minahasa (GMIM)"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="namaJemaat" className="font-semibold">
                      Nama Jemaat <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="namaJemaat"
                      value={form.namaJemaat}
                      onChange={(e) => handleChange("namaJemaat", e.target.value)}
                      placeholder="Contoh: Jemaat Bukit Moria Tikala Baru"
                      className="h-9 text-xs font-semibold text-primary"
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
                          ref={logoInputRef}
                          onChange={handleLogoUpload}
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          className="hidden"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => logoInputRef.current?.click()}
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

            {/* TAB 3: PENGATURAN TAMPILAN BERANDA */}
            <TabsContent value="beranda" className="space-y-4 pt-3">
              {/* Card Gambar Background Hero & Opacity */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="size-4 text-primary" /> Gambar Background & Warna Latar Hero
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Tambahkan foto gedung gereja / jemaat sebagai latar belakang hero dan atur tingkat transparansinya (*opacity*).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  {/* Upload Gambar Background */}
                  <div className="space-y-2">
                    <Label className="font-semibold">Foto / Gambar Background Beranda</Label>
                    <input
                      type="file"
                      ref={bannerInputRef}
                      onChange={handleBannerUpload}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                    />

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      {form.bannerBerandaUrl ? (
                        <div className="relative h-20 w-36 rounded-lg border overflow-hidden shadow-xs shrink-0 bg-slate-900">
                          <img
                            src={form.bannerBerandaUrl}
                            alt="Background Preview"
                            className="size-full object-cover"
                            style={{ opacity: (form.bannerOpacity ?? 45) / 100 }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-1">
                            <span className="text-[9px] text-white font-bold">
                              Opacity {form.bannerOpacity}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-20 w-36 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 shrink-0">
                          <ImageIcon className="size-5 mb-1" />
                          <span className="text-[9.5px]">Warna Polos</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => bannerInputRef.current?.click()}
                            className="gap-1.5 text-xs h-8 font-semibold"
                          >
                            <Upload className="size-3.5 text-primary" />
                            {form.bannerBerandaUrl ? "Ganti Gambar Foto" : "Unggah Gambar Foto (JPG/PNG)"}
                          </Button>

                          {form.bannerBerandaUrl && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setForm((prev) => ({ ...prev, bannerBerandaUrl: "" }))}
                              className="text-xs h-8 text-destructive gap-1"
                            >
                              <Trash2 className="size-3.5" /> Hapus Gambar
                            </Button>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Disarankan foto lanskap resolusi tinggi (foto gedung gereja, altar, atau suasana ibadah).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Slider Opacity (Transparansi Gambar) */}
                  {form.bannerBerandaUrl && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="bannerOpacity" className="font-semibold flex items-center gap-1.5">
                          <Sliders className="size-3.5 text-primary" /> Tingkat Transparansi Gambar (Opacity)
                        </Label>
                        <span className="text-xs font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full">
                          {form.bannerOpacity}%
                        </span>
                      </div>
                      <input
                        id="bannerOpacity"
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={form.bannerOpacity ?? 45}
                        onChange={(e) => handleChange("bannerOpacity", Number(e.target.value))}
                        className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>10% (Samar-samar)</span>
                        <span className="text-primary font-medium">40% - 50% (Direkomendasikan agar teks jelas)</span>
                        <span>100% (Sangat Terang)</span>
                      </div>
                    </div>
                  )}

                  {/* Pilihan Warna Dasar Background */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="font-semibold flex items-center gap-1.5">
                      <Palette className="size-3.5 text-primary" /> Warna Dasar Latar Hero
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {WARNA_BACKGROUND_PRESET.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => handleChange("warnaBackgroundBeranda", preset.value)}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                            form.warnaBackgroundBeranda === preset.value
                              ? "border-primary ring-2 ring-primary/20 font-bold bg-primary/5"
                              : "hover:border-muted-foreground/40"
                          }`}
                        >
                          <div className={`size-4 rounded-full ${preset.bgClass} border shadow-xs`} />
                          <span className="text-[11px] truncate">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card Teks Sambutan & Motto */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Home className="size-4 text-primary" /> Teks Sambutan & Informasi Beranda
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Atur judul sambutan, tagline, firman Tuhan/motto, dan informasi kontak yang tampil di halaman depan website.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <Label htmlFor="subjudulBeranda" className="font-semibold">
                      Tagline / Badge Atas Beranda
                    </Label>
                    <Input
                      id="subjudulBeranda"
                      value={form.subjudulBeranda}
                      onChange={(e) => handleChange("subjudulBeranda", e.target.value)}
                      placeholder="Contoh: SISTEM MANAJEMEN KEUANGAN & ADMINISTRASI JEMAAT"
                      className="h-9 text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="judulBeranda" className="font-semibold">
                      Judul Utama Beranda (Headline) <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="judulBeranda"
                      value={form.judulBeranda}
                      onChange={(e) => handleChange("judulBeranda", e.target.value)}
                      placeholder="Contoh: Keuangan gereja yang tertib, transparan, dan mudah dipertanggungjawabkan."
                      rows={2}
                      className="text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="deskripsiBeranda" className="font-semibold">
                      Paragraf Deskripsi Sambutan
                    </Label>
                    <Textarea
                      id="deskripsiBeranda"
                      value={form.deskripsiBeranda}
                      onChange={(e) => handleChange("deskripsiBeranda", e.target.value)}
                      placeholder="Uraian singkat tentang sistem keuangan jemaat..."
                      rows={2}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="mottoAyatBeranda" className="font-semibold text-primary flex items-center gap-1.5">
                      <BookOpen className="size-3.5" /> Ayat Firman Tuhan / Motto Jemaat
                    </Label>
                    <Input
                      id="mottoAyatBeranda"
                      value={form.mottoAyatBeranda}
                      onChange={(e) => handleChange("mottoAyatBeranda", e.target.value)}
                      placeholder="Contoh: 1 Korintus 14:40 — 'Tetapi segala sesuatu harus berlangsung dengan sopan dan teratur.'"
                      className="h-9 text-xs italic"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
                    <div className="space-y-1.5">
                      <Label htmlFor="teksTombolBeranda" className="font-semibold">
                        Teks Tombol Masuk Utama
                      </Label>
                      <Input
                        id="teksTombolBeranda"
                        value={form.teksTombolBeranda}
                        onChange={(e) => handleChange("teksTombolBeranda", e.target.value)}
                        placeholder="Contoh: Mulai Kelola Keuangan"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="jadwalIbadahSingkat" className="font-semibold flex items-center gap-1">
                        <Clock className="size-3.5 text-primary" /> Jadwal Pelayanan / Ibadah
                      </Label>
                      <Input
                        id="jadwalIbadahSingkat"
                        value={form.jadwalIbadahSingkat}
                        onChange={(e) => handleChange("jadwalIbadahSingkat", e.target.value)}
                        placeholder="Contoh: Ibadah Minggu: Subuh 05.30 | Pagi 09.00 | Sore 17.00 WITA"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="kontakSekretariat" className="font-semibold flex items-center gap-1">
                        <MapPin className="size-3.5 text-primary" /> Informasi Sekretariat & Kontak
                      </Label>
                      <Input
                        id="kontakSekretariat"
                        value={form.kontakSekretariat}
                        onChange={(e) => handleChange("kontakSekretariat", e.target.value)}
                        placeholder="Contoh: Sekretariat: Jl. Lumimuut, Tikala Baru | Telp/WA: 0812-xxxx-xxxx"
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: PENGATURAN TAMPILAN LOGIN */}
            <TabsContent value="login" className="space-y-4 pt-3">
              {/* Card Background Latar Panel Login */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LogIn className="size-4 text-primary" /> Gambar Background & Warna Panel Login (/auth)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Atur foto latar dan nuansa warna yang tampil di sisi kiri halaman masuk (portal login) pengguna.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  {/* Upload Gambar Khusus Login */}
                  <div className="space-y-2">
                    <Label className="font-semibold">Foto Background Khusus Login (Opsional)</Label>
                    <input
                      type="file"
                      ref={loginBannerInputRef}
                      onChange={handleLoginBannerUpload}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                    />

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      {currentLoginBgImage ? (
                        <div className="relative h-20 w-36 rounded-lg border overflow-hidden shadow-xs shrink-0 bg-slate-900">
                          <img
                            src={currentLoginBgImage}
                            alt="Login BG Preview"
                            className="size-full object-cover"
                            style={{ opacity: currentLoginBgOpacity }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-1">
                            <span className="text-[9px] text-white font-bold">
                              Opacity {form.bannerLoginOpacity}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-20 w-36 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 shrink-0">
                          <Lock className="size-5 mb-1" />
                          <span className="text-[9.5px]">Warna Polos</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => loginBannerInputRef.current?.click()}
                            className="gap-1.5 text-xs h-8 font-semibold"
                          >
                            <Upload className="size-3.5 text-primary" />
                            {form.bannerLoginUrl ? "Ganti Foto Login" : "Unggah Foto Khusus Login"}
                          </Button>

                          {form.bannerBerandaUrl && !form.bannerLoginUrl && (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md font-medium">
                              ✓ Mengikuti Foto Beranda
                            </span>
                          )}

                          {form.bannerLoginUrl && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setForm((prev) => ({ ...prev, bannerLoginUrl: "" }))}
                              className="text-xs h-8 text-destructive gap-1"
                            >
                              <Trash2 className="size-3.5" /> Gunakan Foto Beranda
                            </Button>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Jika tidak diunggah, halaman login akan otomatis memakai foto background beranda Anda.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Slider Opacity Login */}
                  {currentLoginBgImage && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="bannerLoginOpacity" className="font-semibold flex items-center gap-1.5">
                          <Sliders className="size-3.5 text-primary" /> Transparansi Background Login (Opacity)
                        </Label>
                        <span className="text-xs font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full">
                          {form.bannerLoginOpacity}%
                        </span>
                      </div>
                      <input
                        id="bannerLoginOpacity"
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={form.bannerLoginOpacity ?? 40}
                        onChange={(e) => handleChange("bannerLoginOpacity", Number(e.target.value))}
                        className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
                      />
                    </div>
                  )}

                  {/* Warna Latar Login */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="font-semibold flex items-center gap-1.5">
                      <Palette className="size-3.5 text-primary" /> Nuansa Warna Panel Login
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {WARNA_BACKGROUND_PRESET.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => handleChange("warnaBackgroundLogin", preset.value)}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                            form.warnaBackgroundLogin === preset.value
                              ? "border-primary ring-2 ring-primary/20 font-bold bg-primary/5"
                              : "hover:border-muted-foreground/40"
                          }`}
                        >
                          <div className={`size-4 rounded-full ${preset.bgClass} border shadow-xs`} />
                          <span className="text-[11px] truncate">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card Teks Sambutan & Ayat Halaman Login */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="size-4 text-primary" /> Teks Sambutan & Firman di Halaman Login
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Kalimat motivasi dan ayat firman yang tampil di sisi kiri form login.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <Label htmlFor="judulLogin" className="font-semibold">
                      Judul Sambutan Login <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="judulLogin"
                      value={form.judulLogin}
                      onChange={(e) => handleChange("judulLogin", e.target.value)}
                      placeholder="Contoh: Kelola kas jemaat dengan tertib, transparan, dan terpercaya."
                      rows={2}
                      className="text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="deskripsiLogin" className="font-semibold">
                      Paragraf Penjelasan
                    </Label>
                    <Textarea
                      id="deskripsiLogin"
                      value={form.deskripsiLogin}
                      onChange={(e) => handleChange("deskripsiLogin", e.target.value)}
                      placeholder="Contoh: Monitoring saldo realtime, mata anggaran, approval pengeluaran..."
                      rows={2}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="mottoAyatLogin" className="font-semibold text-primary flex items-center gap-1.5">
                      <BookOpen className="size-3.5" /> Ayat Firman Tuhan di Halaman Login
                    </Label>
                    <Input
                      id="mottoAyatLogin"
                      value={form.mottoAyatLogin}
                      onChange={(e) => handleChange("mottoAyatLogin", e.target.value)}
                      placeholder="Contoh: Amsal 3:9 — 'Muliakanlah TUHAN dengan hartamu...'"
                      className="h-9 text-xs italic"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 5: PENANDATANGAN KWITANSI */}
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

        {/* Kolom Kanan: Pratinjau Langsung (Live Preview) */}
        <div className="lg:col-span-5 space-y-3">
          {activeTab === "login" ? (
            /* LIVE PREVIEW HALAMAN LOGIN */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <LogIn className="size-3.5 text-primary" /> Live Pratinjau Halaman Login
                </h3>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                  Real-time
                </span>
              </div>

              <div className="rounded-xl border overflow-hidden shadow-lg grid grid-cols-12 text-xs">
                {/* Panel Kiri Simulasi */}
                <div
                  className="col-span-7 relative p-4 text-white flex flex-col justify-between overflow-hidden min-h-[260px]"
                  style={{ backgroundColor: currentLoginBgColor }}
                >
                  {currentLoginBgImage && (
                    <div
                      className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none"
                      style={{
                        backgroundImage: `url("${currentLoginBgImage}")`,
                        opacity: currentLoginBgOpacity,
                      }}
                    />
                  )}
                  <div
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(180deg, rgba(11, 25, 44, 0.75) 0%, rgba(11, 25, 44, 0.92) 100%)",
                    }}
                  />

                  <div className="relative z-10 flex items-center gap-2">
                    <img
                      src={logoPreview || "/favicon.png"}
                      alt="Logo"
                      className="size-6 object-contain rounded-sm border p-0.5 bg-white/10"
                    />
                    <div>
                      <strong className="block text-[10px] leading-tight font-bold">{form.namaAplikasi}</strong>
                      <span className="text-[8px] text-amber-300 font-semibold uppercase block">{form.namaJemaat}</span>
                    </div>
                  </div>

                  <div className="relative z-10 my-2 space-y-1.5">
                    <span className="inline-block text-[7.5px] font-bold text-white bg-white/15 px-2 py-0.5 rounded-full uppercase">
                      Portal Keuangan
                    </span>
                    <h4 className="text-[11px] font-extrabold leading-tight text-white">
                      {form.judulLogin || "Judul Login"}
                    </h4>
                    <p className="text-[8.5px] text-gray-200 leading-snug line-clamp-2">
                      {form.deskripsiLogin || "Deskripsi..."}
                    </p>
                    {form.mottoAyatLogin && (
                      <div className="p-1.5 rounded-md bg-white/10 border border-white/20 text-[8px] italic text-amber-200">
                        "{form.mottoAyatLogin}"
                      </div>
                    )}
                  </div>

                  <p className="relative z-10 text-[7.5px] text-gray-400">
                    &copy; {new Date().getFullYear()} {form.namaAplikasi}
                  </p>
                </div>

                {/* Form Simulasi */}
                <div className="col-span-5 bg-card p-3 flex flex-col justify-center space-y-2">
                  <strong className="text-[10.5px] font-bold">Masuk</strong>
                  <div className="space-y-1">
                    <div className="h-5 rounded bg-muted/60 border px-1.5 text-[8px] flex items-center text-muted-foreground">
                      email@gereja.org
                    </div>
                    <div className="h-5 rounded bg-muted/60 border px-1.5 text-[8px] flex items-center text-muted-foreground">
                      ••••••••
                    </div>
                  </div>
                  <div className="h-6 rounded bg-primary text-primary-foreground font-bold text-[8.5px] flex items-center justify-center shadow-xs">
                    Masuk ke Akun
                  </div>
                  <div className="text-[7.5px] text-center text-muted-foreground underline">
                    Masuk dengan Google
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "beranda" ? (
            /* LIVE PREVIEW TAMPILAN BERANDA */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Home className="size-3.5 text-primary" /> Live Pratinjau Halaman Beranda
                </h3>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                  Real-time
                </span>
              </div>

              <div className="rounded-xl border overflow-hidden shadow-lg text-xs space-y-0">
                {/* Mini Navbar Preview */}
                <div className="flex items-center justify-between border-b bg-background px-3 py-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={logoPreview || "/favicon.png"}
                      alt="Logo"
                      className="size-6 object-contain rounded-sm border p-0.5"
                    />
                    <div>
                      <strong className="block text-[10.5px] leading-tight font-bold">{form.namaAplikasi}</strong>
                      <span className="text-[8.5px] text-primary font-semibold block">{form.namaJemaat}</span>
                    </div>
                  </div>
                  <span className="text-[9.5px] bg-primary text-primary-foreground px-2 py-0.5 rounded-sm font-semibold">
                    Masuk
                  </span>
                </div>

                {/* Hero Preview dengan Background Gambar & Opacity Live */}
                <div
                  className="relative text-center py-6 px-4 text-white overflow-hidden"
                  style={{ backgroundColor: form.warnaBackgroundBeranda || "#0b192c" }}
                >
                  {form.bannerBerandaUrl && (
                    <div
                      className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none"
                      style={{
                        backgroundImage: `url("${form.bannerBerandaUrl}")`,
                        opacity: (form.bannerOpacity ?? 45) / 100,
                      }}
                    />
                  )}

                  <div
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={{
                      background: form.bannerBerandaUrl
                        ? "linear-gradient(180deg, rgba(11, 25, 44, 0.75) 0%, rgba(11, 25, 44, 0.90) 100%)"
                        : "radial-gradient(circle at center, rgba(30, 58, 138, 0.45) 0%, rgba(11, 25, 44, 0.95) 100%)",
                    }}
                  />

                  <div className="relative z-10 space-y-2">
                    <span className="inline-block text-[8.5px] font-bold text-white bg-white/15 border border-white/25 px-2.5 py-0.5 rounded-full uppercase backdrop-blur-xs">
                      {form.subjudulBeranda || "TAGLINE BERANDA"}
                    </span>
                    <h4 className="text-xs font-black text-white leading-snug drop-shadow-xs max-w-xs mx-auto">
                      {form.judulBeranda || "Judul Utama Beranda"}
                    </h4>
                    <p className="text-[9.5px] text-gray-200 leading-relaxed max-w-xs mx-auto">
                      {form.deskripsiBeranda || "Deskripsi sambutan beranda..."}
                    </p>
                    {form.mottoAyatBeranda && (
                      <div className="p-2 rounded-md bg-white/10 border border-white/20 text-[8.5px] italic text-amber-200 max-w-xs mx-auto">
                        "{form.mottoAyatBeranda}"
                      </div>
                    )}
                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1 rounded-md font-bold text-[9.5px] shadow-sm">
                        {form.teksTombolBeranda || "Mulai Kelola Keuangan"} <ArrowRight className="size-2.5" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Preview */}
                {(form.jadwalIbadahSingkat || form.kontakSekretariat) && (
                  <div className="bg-muted/40 p-2.5 space-y-1 text-[9px] text-muted-foreground border-t">
                    {form.jadwalIbadahSingkat && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3 text-primary shrink-0" />
                        <span>{form.jadwalIbadahSingkat}</span>
                      </div>
                    )}
                    {form.kontakSekretariat && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3 text-primary shrink-0" />
                        <span>{form.kontakSekretariat}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* LIVE PREVIEW KUITANSI F4 */
            <div className="space-y-3">
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
                      {form.namaGereja || "GEREJA MASEHI INJILI DI MINAHASA (GMIM)"}
                    </h2>
                    <h3 className="text-[10.5px] font-black uppercase mt-0.5 text-gray-900">
                      {form.namaJemaat || "JEMAAT BUKIT MORIA TIKALA BARU"}
                    </h3>
                    <h4 className="text-[9.5px] font-extrabold uppercase mt-0.5 text-gray-800">
                      {form.wilayah || "WILAYAH MANADO WAWONASA KOMBOS"}
                    </h4>
                    <p className="text-[8px] text-gray-600 mt-0.5 truncate">
                      {form.alamatGereja || "Jl. Lumimuut, Tikala Baru, Kec. Tikala, Kota Manado, Sulawesi Utara"}
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
                  <div className="grid grid-cols-12">
                    <span className="col-span-4 font-bold text-gray-800">Untuk Penyetoran</span>
                    <span className="col-span-8 font-bold">: Persembahan Ibadah Subuh Kolom 15</span>
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
                        <span className="font-bold underline block">( KOLOM 15 )</span>
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
            </div>
          )}

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
            <CheckCircle2 className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Perubahan pada menu ini otomatis tersinkronisasi ke seluruh kuitansi, laporan kas, halaman depan (beranda), dan portal login <strong>https://keuanganbumotik.my.id/auth</strong>.
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
