export const rupiah = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

export const rupiahShort = (value: number) => {
  const n = Number(value ?? 0);
  if (Math.abs(n) >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`;
  if (Math.abs(n) >= 1_000) return `Rp ${(n / 1_000).toFixed(0)} rb`;
  return `Rp ${n}`;
};

export const tanggal = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const tanggalPanjang = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const namaBulan = (index: number) =>
  ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][index] ?? "";

export const terbilang = (angka: number | string | null | undefined): string => {
  const n = Math.floor(Math.abs(Number(angka ?? 0)));
  if (n === 0) return "Nol Rupiah";

  const huruf = [
    "",
    "Satu",
    "Dua",
    "Tiga",
    "Empat",
    "Lima",
    "Enam",
    "Tujuh",
    "Delapan",
    "Sembilan",
    "Sepuluh",
    "Sebelas",
  ];

  function toWords(x: number): string {
    if (x < 12) return huruf[x] ?? "";
    if (x < 20) return `${toWords(x - 10)} Belas`;
    if (x < 100) return `${toWords(Math.floor(x / 10))} Puluh ${toWords(x % 10)}`.trim();
    if (x < 200) return `Seratus ${toWords(x - 100)}`.trim();
    if (x < 1000) return `${toWords(Math.floor(x / 100))} Ratus ${toWords(x % 100)}`.trim();
    if (x < 2000) return `Seribu ${toWords(x - 1000)}`.trim();
    if (x < 1000000) return `${toWords(Math.floor(x / 1000))} Ribu ${toWords(x % 1000)}`.trim();
    if (x < 1000000000) return `${toWords(Math.floor(x / 1000000))} Juta ${toWords(x % 1000000)}`.trim();
    if (x < 1000000000000) return `${toWords(Math.floor(x / 1000000000))} Miliar ${toWords(x % 1000000000)}`.trim();
    return `${toWords(Math.floor(x / 1000000000000))} Triliun ${toWords(x % 1000000000000)}`.trim();
  }

  return `${toWords(n)} Rupiah`.replace(/\s+/g, " ");
};

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Administrator",
  admin_keuangan: "Admin Keuangan",
  ketua_bpmj: "Ketua Jemaat",
  ketua_jemaat: "Ketua Jemaat",
  viewer: "BPMJ",
  bpmj: "BPMJ",
  sekretaris: "Sekretaris",
  pendeta: "Pendeta",
  auditor: "Auditor",
};