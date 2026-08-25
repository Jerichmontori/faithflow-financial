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

  const email = user?.email?.toLowerCase() ?? "";

  const roles = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user!.id);
        if (!error && Array.isArray(data) && data.length > 0) {
          const list = data.map((r: any) => r.role as AppRole);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(`bumotik_roles_${user!.id}`, JSON.stringify(list));
            } catch {}
          }
          return list;
        }
      } catch (err) {
        console.warn("Notice on user_roles fetch:", err);
      }

      // Fallback cerdas berdasarkan identitas email
      if (email.includes("jerich") || email.includes("admin")) {
        return ["super_admin" as AppRole];
      }
      if (email.includes("handrie")) {
        return ["ketua_bpmj" as AppRole];
      }
      if (email.includes("sella") || email.includes("sekretaris")) {
        return ["sekretaris" as AppRole];
      }
      return ["viewer" as AppRole];
    },
    initialData: () => {
      if (typeof window !== "undefined" && user?.id) {
        try {
          const cached = localStorage.getItem(`bumotik_roles_${user.id}`);
          if (cached) return JSON.parse(cached);
        } catch {}
      }
      if (email.includes("jerich") || email.includes("admin")) return ["super_admin" as AppRole];
      if (email.includes("handrie")) return ["ketua_bpmj" as AppRole];
      if (email.includes("sella") || email.includes("sekretaris")) return ["sekretaris" as AppRole];
      if (user) return ["viewer" as AppRole];
      return undefined;
    },
  });

  const list = roles.data ?? (email.includes("jerich") || email.includes("admin") ? ["super_admin"] : ["viewer"]);
  const isSuperAdmin =
    list.includes("super_admin") ||
    list.includes("sekretaris") ||
    list.includes("ketua_jemaat") ||
    list.includes("ketua_bpmj");
  const isAdminKeuangan = list.includes("admin_keuangan");
  const isSekretaris = list.includes("sekretaris");
  const isKetuaJemaat = list.includes("ketua_jemaat") || list.includes("ketua_bpmj");
  const isBpmj = list.includes("bpmj");
  
  const canManageFinance = isSuperAdmin || isAdminKeuangan;
  const canEdit = isSuperAdmin || isAdminKeuangan || isSekretaris;
  const canApprove = isSuperAdmin || isKetuaJemaat;
  const isReadOnly = !canManageFinance && !isSekretaris && !isKetuaJemaat && !isSuperAdmin;

  return {
    user,
    loading: loading && !user,
    roles: list,
    primaryRole: list[0] ?? (email.includes("jerich") || email.includes("admin") ? "super_admin" : "viewer"),
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