import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "super_admin"
  | "ketua_bpmj"
  | "admin_keuangan"
  | "sekretaris"
  | "pendeta"
  | "auditor"
  | "viewer";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
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
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  const list = roles.data ?? [];
  return {
    user,
    loading,
    roles: list,
    primaryRole: list[0] ?? null,
    canManageFinance: list.some((r) => r === "super_admin" || r === "admin_keuangan"),
    canApprove: list.some((r) => r === "super_admin" || r === "ketua_bpmj"),
  };
}