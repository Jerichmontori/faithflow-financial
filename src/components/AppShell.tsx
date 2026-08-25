import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Newspaper,
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  BookOpen,
  PieChart,
  FileSpreadsheet,
  Landmark,
  CalendarClock,
  Undo2,
  Coins,
  HeartHandshake,
  Pencil,
  UserCog,
  LogOut,
  Church,
  Menu,
  Settings,
} from "lucide-react";
import { useState, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useAppSettings } from "@/lib/settings";
import { ROLE_LABEL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/penerimaan", label: "Penerimaan", icon: ArrowDownCircle },
  { to: "/pengeluaran", label: "Pengeluaran", icon: ArrowUpCircle },
  { to: "/buku-pembantu", label: "Buku Pembantu", icon: BookOpen },
  { to: "/rekapitulasi", label: "Rekapitulasi", icon: PieChart },
  { to: "/laporan-harian", label: "Laporan Harian Kas", icon: CalendarClock },
  { to: "/rincian-uang", label: "Rincian Uang", icon: Coins },
  { to: "/laporan", label: "Laporan Kolom", icon: FileSpreadsheet },
  { to: "/warta", label: "Warta Keuangan", icon: Newspaper },
  { to: "/dana-duka", label: "Dana Duka", icon: HeartHandshake },
  { to: "/laporan-bank", label: "Laporan Bank", icon: Landmark },
  { to: "/reklas", label: "Pengembalian / Reklas", icon: Undo2 },
  { to: "/koreksi", label: "Koreksi Transaksi", icon: Pencil },
  { to: "/anggaran", label: "Mata Anggaran", icon: Wallet },
  { to: "/pengaturan", label: "Pengaturan Awal", icon: Settings },
  { to: "/pengguna", label: "Manajemen Pengguna", icon: UserCog },
] as const;

const SEKRETARIS_KETUA_ALLOWED_PATHS = new Set([
  "/dashboard",
  "/rekapitulasi",
  "/laporan-harian",
  "/laporan",
  "/dana-duka",
  "/laporan-bank",
]);

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, primaryRole, isReadOnly, isSuperAdmin, isAdminKeuangan } = useSession();
  const { settings } = useAppSettings();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const navItems = useMemo(() => {
    if (isSuperAdmin || isAdminKeuangan) return NAV;
    return NAV.filter((item) => SEKRETARIS_KETUA_ALLOWED_PATHS.has(item.to));
  }, [isSuperAdmin, isAdminKeuangan]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <img
            src={settings.logoUrl || "/favicon.png"}
            alt="Logo"
            className="size-9 rounded-md object-contain bg-white/10 p-0.5 shadow-xs"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/favicon.png";
            }}
          />
          <div className="leading-tight overflow-hidden">
            <p className="font-display text-sm font-bold tracking-wide text-sidebar-accent-foreground truncate">
              {settings.namaAplikasi || "BUMOTIK"}
            </p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-sidebar-primary truncate">
              {settings.subtitleAplikasi || "Financial"}
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground data-[status=active]:shadow-[inset_3px_0_0_0_var(--sidebar-primary)]"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-4 py-4">
          <p className="truncate text-xs text-sidebar-foreground/70">{user?.email}</p>
          <p className="mt-0.5 text-xs font-medium text-sidebar-primary">
            {primaryRole ? ROLE_LABEL[primaryRole] : "Memuat peran…"}
          </p>
          <button
            onClick={signOut}
            className="mt-3 flex w-full items-center gap-2 rounded-md border border-sidebar-border px-3 py-2 text-xs text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent"
          >
            <LogOut className="size-3.5" /> Keluar
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/85 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Buka menu"
            >
              <Menu className="size-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {actions}
        </header>
        <main className="px-5 py-6">{children}</main>
      </div>
    </div>
  );
}