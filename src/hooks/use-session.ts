import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AuthUser = {
  id: string;
  email?: string;
  [key: string]: any;
};

export type AppRole =
  | "super_admin"
  | "admin_keuangan"
  | "ketua_jemaat"
  | "bpmj"
  | "ketua_bpmj"
  | "sekretaris"
  | "pendeta"
  | "auditor"
  | "viewer";

export function useSession() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("insforge_auth_user");
        return raw ? JSON.parse(raw) : null;
      } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const roles = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.role as AppRole);
    },
  });

  const list = roles.data ?? [];
  const isSuperAdmin = list.includes("super_admin");
  const isAdminKeuangan = list.includes("admin_keuangan");
  const isSekretaris = list.includes("sekretaris");
  const isKetuaJemaat = list.includes("ketua_jemaat") || list.includes("ketua_bpmj");
  const isBpmj = list.includes("bpmj");
  
  const canManageFinance = isSuperAdmin || isAdminKeuangan;
  const canEdit = isSuperAdmin || isAdminKeuangan || isSekretaris;
  const canApprove = isSuperAdmin || isKetuaJemaat;
  const isReadOnly = !canManageFinance && !isSekretaris;

  return {
    user,
    loading,
    roles: list,
    primaryRole: list[0] ?? null,
    isSuperAdmin,
    isAdminKeuangan,
    isKetuaJemaat,
    isBpmj,
    canManageFinance,
    canEdit,
    canApprove,
    isReadOnly,
  };
}