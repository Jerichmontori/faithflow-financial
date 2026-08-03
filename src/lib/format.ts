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

export const namaBulan = (index: number) =>
  ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][index] ?? "";

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Administrator",
  ketua_bpmj: "Ketua BPMJ",
  admin_keuangan: "Admin Keuangan",
  sekretaris: "Sekretaris",
  pendeta: "Pendeta",
  auditor: "Auditor",
  viewer: "Viewer",
};