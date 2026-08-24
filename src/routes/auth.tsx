import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Church, Loader2, BookOpen, Sparkles, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppSettings } from "@/lib/settings";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Masuk ke BUMOTIK FINANCIAL untuk mengelola kas, mata anggaran, dan approval pengeluaran gereja.",
      },
      { property: "og:title", content: "Masuk — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Portal masuk sistem manajemen keuangan dan administrasi gereja.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard", replace: true });
        else toast.success("Pendaftaran berhasil. Akun menunggu persetujuan Super Admin.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Gagal masuk dengan Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  const bgImage = settings.bannerLoginUrl || settings.bannerBerandaUrl || "";
  const bgOpacity = (settings.bannerLoginOpacity ?? 40) / 100;
  const bgColor = settings.warnaBackgroundLogin || settings.warnaBackgroundBeranda || "#0b192c";
  const bgPosition = settings.bannerLoginPosition || "center";

  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-background">
      {/* Panel Kiri: Hero & Background Custom */}
      <div
        className="relative hidden flex-col justify-between p-12 text-white lg:flex overflow-hidden transition-colors duration-300"
        style={{ backgroundColor: bgColor }}
      >
        {/* Layer Gambar Background dengan Opacity & Posisi Custom */}
        {bgImage && (
          <div
            className="absolute inset-0 z-0 bg-cover bg-no-repeat transition-all duration-300 pointer-events-none"
            style={{
              backgroundImage: `url("${bgImage}")`,
              opacity: bgOpacity,
              backgroundPosition: bgPosition,
            }}
          />
        )}

        {/* Gradient Overlay */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background: bgImage
              ? "linear-gradient(180deg, rgba(11, 25, 44, 0.75) 0%, rgba(11, 25, 44, 0.92) 100%)"
              : "radial-gradient(circle at center, rgba(30, 58, 138, 0.45) 0%, rgba(11, 25, 44, 0.95) 100%)",
          }}
        />

        {/* Header Panel Kiri */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src={settings.logoUrl || "/favicon.png"}
            alt="Logo Gereja"
            className="size-11 rounded-md object-contain bg-white/10 p-1 border border-white/20 shadow-md"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/favicon.png";
            }}
          />
          <div>
            <p className="font-display text-lg font-bold tracking-wide">
              {settings.namaAplikasi || "BUMOTIK FINANCIAL"}
            </p>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-300 font-semibold">
              {settings.namaJemaat || "GMIM BUKIT MORIA TIKALA BARU"}
            </p>
          </div>
        </div>

        {/* Isi Tengah Panel Kiri */}
        <div className="relative z-10 max-w-md space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-md">
            <Sparkles className="size-3.5 text-amber-300" />
            Portal Keuangan Terpadu
          </div>

          <h2 className="font-display text-3xl font-extrabold leading-tight text-white drop-shadow-sm">
            {settings.judulLogin || "Kelola kas jemaat dengan tertib, transparan, dan terpercaya."}
          </h2>

          <p className="text-sm text-gray-200 leading-relaxed drop-shadow-xs">
            {settings.deskripsiLogin ||
              "Monitoring saldo realtime, mata anggaran, approval pengeluaran berjenjang, serta laporan harian hingga tahunan dalam satu tempat."}
          </p>

          {/* Ayat Firman di Halaman Login */}
          {settings.mottoAyatLogin && (
            <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur-md p-3.5 text-xs text-amber-100 font-medium flex items-center gap-2.5 shadow-sm">
              <BookOpen className="size-4 text-amber-300 shrink-0" />
              <span className="italic leading-relaxed">"{settings.mottoAyatLogin}"</span>
            </div>
          )}
        </div>

        {/* Footer Panel Kiri */}
        <p className="relative z-10 text-xs text-gray-400">
          &copy; {new Date().getFullYear()} {settings.namaAplikasi || "BUMOTIK FINANCIAL"} — {settings.namaGereja || "GMIM"}.
        </p>
      </div>

      {/* Panel Kanan: Form Login */}
      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          {/* Logo & Judul Mobile View */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <img
              src={settings.logoUrl || "/favicon.png"}
              alt="Logo Gereja"
              className="size-14 rounded-lg object-contain bg-muted p-1 border mb-3 shadow-xs"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/favicon.png";
              }}
            />
            <h2 className="font-display text-lg font-bold tracking-wide">
              {settings.namaAplikasi || "BUMOTIK FINANCIAL"}
            </h2>
            <p className="text-xs text-primary font-semibold uppercase tracking-wider">
              {settings.namaJemaat || "GMIM Bukit Moria Tikala Baru"}
            </p>
          </div>

          <div className="space-y-1 text-left">
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "login" ? "Masuk ke Sistem" : "Daftar Akun Baru"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {mode === "login"
                ? "Gunakan email jemaat yang terdaftar."
                : "Pengguna pertama otomatis menjadi Super Administrator."}
            </p>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="nama" className="text-xs font-semibold">Nama Lengkap</Label>
                <Input
                  id="nama"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama lengkap & gelar"
                  required
                  maxLength={100}
                  className="h-10 text-xs sm:text-sm"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">Alamat Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@gereja.org"
                required
                maxLength={255}
                className="h-10 text-xs sm:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold">Kata Sandi</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="h-10 text-xs sm:text-sm"
              />
            </div>
            <Button type="submit" className="w-full font-bold h-10 shadow-md" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {mode === "login" ? "Masuk ke Akun" : "Daftar Akun"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> atau <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full font-medium h-10" onClick={google}>
            Lanjutkan dengan Google
          </Button>

          <p className="mt-6 text-center text-xs sm:text-sm text-muted-foreground">
            {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
            <button
              type="button"
              className="font-bold text-primary underline underline-offset-4"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Daftar" : "Masuk"}
            </button>
          </p>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="size-3" /> Kembali ke halaman depan
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}