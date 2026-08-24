import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppSettings {
  namaGereja: string; // e.g. "Gereja Masehi Injili di Minahasa (GMIM)"
  namaJemaat: string; // e.g. "Jemaat Bukit Moria Tikala Baru"
  wilayah: string; // e.g. "Wilayah Manado Wawonasa Kombos"
  alamatGereja: string; // e.g. "Jl. Lumimuut, Tikala Baru, Kec. Tikala, Kota Manado, Sulawesi Utara"
  namaAplikasi: string;
  subtitleAplikasi: string;
  logoUrl: string;

  // Rekening & Saldo Awal Bank
  saldoAwalBank: number; // e.g. 15000000
  tglSaldoAwalBank: string; // e.g. "2026-01-01"
  tglTerakhirWarta?: string; // e.g. "2026-08-14"
  namaBank: string; // e.g. "Bank SulutGo / BCA"
  nomorRekeningBank: string; // e.g. "001.02.03.000123-4"

  // Penandatangan Kwitansi & Laporan
  namaKetuaBpmj: string;
  jabatanKetuaBpmj: string;
  namaBendahara: string;
  jabatanBendahara: string;
  namaSekretaris: string;
  jabatanSekretaris: string;
  kotaSurat: string;
  labelPenyetor: string;
  labelPenerima: string;

  // Pengaturan Tampilan Beranda (Landing Page)
  judulBeranda: string;
  subjudulBeranda: string;
  deskripsiBeranda: string;
  mottoAyatBeranda: string;
  teksTombolBeranda: string;
  kontakSekretariat: string;
  jadwalIbadahSingkat: string;
  bannerBerandaUrl: string;
  bannerOpacity: number; // 0 to 100
  bannerPosition: string; // "center" | "top" | "bottom" | "left" | "right" | etc
  warnaBackgroundBeranda: string; // hex / gradient color

  // Pengaturan Tampilan Halaman Login (/auth)
  judulLogin: string;
  deskripsiLogin: string;
  mottoAyatLogin: string;
  bannerLoginUrl: string;
  bannerLoginOpacity: number; // 0 to 100
  bannerLoginPosition: string; // "center" | "top" | "bottom" | "left" | "right" | etc
  warnaBackgroundLogin: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  namaGereja: "Gereja Masehi Injili di Minahasa (GMIM)",
  namaJemaat: "Jemaat Bukit Moria Tikala Baru",
  wilayah: "Wilayah Manado Wawonasa Kombos",
  alamatGereja: "Jl. Lumimuut, Tikala Baru, Kec. Tikala, Kota Manado, Sulawesi Utara",
  namaAplikasi: "BUMOTIK FINANCIAL",
  subtitleAplikasi: "Sistem Manajemen & Keuangan Gereja",
  logoUrl: "/favicon.png",

  saldoAwalBank: 0,
  tglSaldoAwalBank: "2026-01-01",
  tglTerakhirWarta: "2026-08-14",
  namaBank: "Bank SulutGo",
  nomorRekeningBank: "001-02-03-004567-8",

  namaKetuaBpmj: "Pdt. Handry Mecky Dengah, M.Th",
  jabatanKetuaBpmj: "Ketua BPMJ",
  namaBendahara: "Dkn. Jerich Montori",
  jabatanBendahara: "Bendahara Jemaat",
  namaSekretaris: "Pnt. Sekretaris BPMJ",
  jabatanSekretaris: "Sekretaris BPMJ",
  kotaSurat: "Manado",
  labelPenyetor: "Penyetor / Yang Menyerahkan",
  labelPenerima: "Penerima Kas",

  judulBeranda: "Keuangan gereja yang tertib, transparan, dan mudah dipertanggungjawabkan.",
  subjudulBeranda: "SISTEM MANAJEMEN KEUANGAN & ADMINISTRASI JEMAAT",
  deskripsiBeranda: "Catat penerimaan dan pengeluaran, kendalikan mata anggaran, jalankan approval, dan pantau realisasi anggaran jemaat secara realtime.",
  mottoAyatBeranda: "1 Korintus 14:40 — 'Tetapi segala sesuatu harus berlangsung dengan sopan dan teratur.'",
  teksTombolBeranda: "Mulai Kelola Keuangan",
  kontakSekretariat: "Sekretariat Jemaat: Jl. Lumimuut, Tikala Baru | Telp/WA: 0812-44xx-xxxx",
  jadwalIbadahSingkat: "Ibadah Minggu: Subuh 05.30 | Pagi 09.00 | Sore 17.00 WITA",
  bannerBerandaUrl: "",
  bannerOpacity: 45,
  bannerPosition: "center",
  warnaBackgroundBeranda: "#0b192c",

  judulLogin: "Kelola kas jemaat dengan tertib, transparan, dan terpercaya.",
  deskripsiLogin: "Monitoring saldo realtime, mata anggaran, approval pengeluaran berjenjang, serta laporan harian hingga tahunan dalam satu tempat.",
  mottoAyatLogin: "Amsal 3:9 — 'Muliakanlah TUHAN dengan hartamu dan dengan hasil pertama dari segala penghasilanmu.'",
  bannerLoginUrl: "",
  bannerLoginOpacity: 40,
  bannerLoginPosition: "center",
  warnaBackgroundLogin: "#0b192c",
};

const STORAGE_KEY = "bumotik.app_settings_v1";

export function getStoredSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const legacyBank = localStorage.getItem("bumotik.saldoAwalBank");
    const legacyBankNum = legacyBank ? Number(legacyBank.replace(/[^\d-]/g, "")) || 0 : 0;

    if (!raw) {
      return {
        ...DEFAULT_SETTINGS,
        saldoAwalBank: legacyBankNum || DEFAULT_SETTINGS.saldoAwalBank,
      };
    }
    const parsed = JSON.parse(raw);

    let namaGereja = parsed.namaGereja || DEFAULT_SETTINGS.namaGereja;
    let namaJemaat = parsed.namaJemaat || DEFAULT_SETTINGS.namaJemaat;
    if (namaGereja.includes("Jemaat") && !parsed.namaJemaat) {
      namaGereja = "Gereja Masehi Injili di Minahasa (GMIM)";
      namaJemaat = "Jemaat Bukit Moria Tikala Baru";
    }

    const saldoAwalBank = typeof parsed.saldoAwalBank === "number"
      ? parsed.saldoAwalBank
      : (legacyBankNum || DEFAULT_SETTINGS.saldoAwalBank);

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      namaGereja,
      namaJemaat,
      saldoAwalBank,
      tglSaldoAwalBank: parsed.tglSaldoAwalBank || DEFAULT_SETTINGS.tglSaldoAwalBank,
      tglTerakhirWarta: parsed.tglTerakhirWarta || DEFAULT_SETTINGS.tglTerakhirWarta,
      namaBank: parsed.namaBank || DEFAULT_SETTINGS.namaBank,
      nomorRekeningBank: parsed.nomorRekeningBank || DEFAULT_SETTINGS.nomorRekeningBank,
      bannerBerandaUrl: parsed.bannerBerandaUrl ?? DEFAULT_SETTINGS.bannerBerandaUrl,
      bannerOpacity: typeof parsed.bannerOpacity === "number" ? parsed.bannerOpacity : DEFAULT_SETTINGS.bannerOpacity,
      bannerPosition: parsed.bannerPosition || DEFAULT_SETTINGS.bannerPosition,
      warnaBackgroundBeranda: parsed.warnaBackgroundBeranda || DEFAULT_SETTINGS.warnaBackgroundBeranda,
      judulLogin: parsed.judulLogin || DEFAULT_SETTINGS.judulLogin,
      deskripsiLogin: parsed.deskripsiLogin || DEFAULT_SETTINGS.deskripsiLogin,
      mottoAyatLogin: parsed.mottoAyatLogin ?? DEFAULT_SETTINGS.mottoAyatLogin,
      bannerLoginUrl: parsed.bannerLoginUrl ?? DEFAULT_SETTINGS.bannerLoginUrl,
      bannerLoginOpacity: typeof parsed.bannerLoginOpacity === "number" ? parsed.bannerLoginOpacity : DEFAULT_SETTINGS.bannerLoginOpacity,
      bannerLoginPosition: parsed.bannerLoginPosition || DEFAULT_SETTINGS.bannerLoginPosition,
      warnaBackgroundLogin: parsed.warnaBackgroundLogin || DEFAULT_SETTINGS.warnaBackgroundLogin,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const notifySettingsChanged = (settings: AppSettings) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("bumotik_settings_updated", { detail: settings }));
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel("bumotik_realtime_sync");
      bc.postMessage({ type: "settings_updated", settings });
      bc.close();
    } catch {}
  }
};

export function saveStoredSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    localStorage.setItem("bumotik.saldoAwalBank", String(settings.saldoAwalBank ?? 0));
    notifySettingsChanged(settings);
  } catch (err) {
    console.error("Gagal menyimpan ke localStorage:", err);
  }
}

/** Hook untuk reactive update settings di seluruh komponen dan sinkronisasi cloud */
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => getStoredSettings());

  useEffect(() => {
    // 1. Segera muat pengaturan tersimpan dari cache lokal
    setSettings(getStoredSettings());

    const fetchFromDB = () => {
      supabase
        .from("app_settings")
        .select("value")
        .eq("key", "general_settings")
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data?.value) {
            const dbSettings = data.value as Partial<AppSettings>;
            const current = getStoredSettings();
            const merged: AppSettings = {
              ...current,
              ...dbSettings,
            };
            setSettings(merged);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              localStorage.setItem("bumotik.saldoAwalBank", String(merged.saldoAwalBank ?? 0));
            } catch {}
            notifySettingsChanged(merged);
          }
        });
    };

    // 2. Tarik pengaturan resmi dari Database PostgreSQL segera & berkala
    fetchFromDB();
    const interval = setInterval(fetchFromDB, 10000);
    window.addEventListener("focus", fetchFromDB);

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<AppSettings>;
      if (custom.detail) {
        setSettings(custom.detail);
      } else {
        setSettings(getStoredSettings());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === "bumotik.saldoAwalBank") {
        setSettings(getStoredSettings());
      }
    };

    window.addEventListener("bumotik_settings_updated", handleUpdate);
    window.addEventListener("storage", handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", fetchFromDB);
      window.removeEventListener("bumotik_settings_updated", handleUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    saveStoredSettings(merged);

    // Sinkronisasi ke PostgreSQL Database agar otomatis berlaku ke semua perangkat & user
    supabase
      .from("app_settings")
      .upsert([
        {
          key: "general_settings",
          value: merged,
          updated_at: new Date().toISOString(),
        },
      ])
      .then(({ error }) => {
        if (error) {
          console.error("Gagal sinkronisasi ke database:", error);
        }
      });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    saveStoredSettings(DEFAULT_SETTINGS);
    supabase
      .from("app_settings")
      .upsert([
        {
          key: "general_settings",
          value: DEFAULT_SETTINGS,
          updated_at: new Date().toISOString(),
        },
      ]);
  };

  return { settings, updateSettings, resetSettings };
}
