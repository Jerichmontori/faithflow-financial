import { useEffect, useState } from "react";

export interface AppSettings {
  namaGereja: string; // e.g. "Gereja Masehi Injili di Minahasa (GMIM)"
  namaJemaat: string; // e.g. "Jemaat Bukit Moria Tikala Baru"
  wilayah: string; // e.g. "Wilayah Manado Wawonasa Kombos"
  alamatGereja: string; // e.g. "Jl. Lumimuut, Tikala Baru, Kec. Tikala, Kota Manado, Sulawesi Utara"
  namaAplikasi: string;
  subtitleAplikasi: string;
  logoUrl: string;

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
}

export const DEFAULT_SETTINGS: AppSettings = {
  namaGereja: "Gereja Masehi Injili di Minahasa (GMIM)",
  namaJemaat: "Jemaat Bukit Moria Tikala Baru",
  wilayah: "Wilayah Manado Wawonasa Kombos",
  alamatGereja: "Jl. Lumimuut, Tikala Baru, Kec. Tikala, Kota Manado, Sulawesi Utara",
  namaAplikasi: "BUMOTIK FINANCIAL",
  subtitleAplikasi: "Sistem Manajemen & Keuangan Gereja",
  logoUrl: "/favicon.png",

  namaKetuaBpmj: "Pdt. Handry Mecky Dengah, M.Th",
  jabatanKetuaBpmj: "Ketua BPMJ",
  namaBendahara: "Dkn. Jerich Montori",
  jabatanBendahara: "Bendahara Jemaat",
  namaSekretaris: "Pnt. Sekretaris BPMJ",
  jabatanSekretaris: "Sekretaris BPMJ",
  kotaSurat: "Manado",
  labelPenyetor: "Penyetor / Yang Menyerahkan",
  labelPenerima: "Penerima Kas",
};

const STORAGE_KEY = "bumotik.app_settings_v1";

export function getStoredSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);

    // Migration / fallback if namaGereja contained full text
    let namaGereja = parsed.namaGereja || DEFAULT_SETTINGS.namaGereja;
    let namaJemaat = parsed.namaJemaat || DEFAULT_SETTINGS.namaJemaat;
    if (namaGereja.includes("Jemaat") && !parsed.namaJemaat) {
      namaGereja = "Gereja Masehi Injili di Minahasa (GMIM)";
      namaJemaat = "Jemaat Bukit Moria Tikala Baru";
    }

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      namaGereja,
      namaJemaat,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("bumotik_settings_updated", { detail: settings }));
}

/** Hook untuk reactive update settings di seluruh komponen */
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => getStoredSettings());

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<AppSettings>;
      if (custom.detail) {
        setSettings(custom.detail);
      } else {
        setSettings(getStoredSettings());
      }
    };

    window.addEventListener("bumotik_settings_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("bumotik_settings_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    saveStoredSettings(merged);
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    saveStoredSettings(DEFAULT_SETTINGS);
  };

  return { settings, updateSettings, resetSettings };
}
