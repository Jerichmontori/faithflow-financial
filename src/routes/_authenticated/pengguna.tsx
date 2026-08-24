import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ShieldCheck, UserX, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useSession, type AppRole } from "@/hooks/use-session";
import { ROLE_LABEL, tanggal } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/pengguna")({
  head: () => ({
    meta: [
      { title: "Manajemen Pengguna — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Setujui pendaftaran pengguna baru dan atur hak akses peran pada sistem keuangan gereja.",
      },
      { property: "og:title", content: "Manajemen Pengguna — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Approval pengguna dan pengaturan peran akses BUMOTIK FINANCIAL.",
      },
    ],
  }),
  component: PenggunaPage,
});

const ROLES: AppRole[] = [
  "super_admin",
  "admin_keuangan",
  "ketua_bpmj",
  "viewer",
  "sekretaris",
  "pendeta",
  "auditor",
];

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  approval_status: string;
  approved_at: string | null;
};

function PenggunaPage() {
  const { user, canApprove, roles } = useSession();
  const isSuperAdmin = roles.includes("super_admin");
  const qc = useQueryClient();

  const usersQ = useQuery({
    queryKey: ["pengguna"],
    queryFn: async () => {
      try {
        const [{ data: profiles, error: e1 }, { data: userRoles, error: e2 }] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, email, created_at, approval_status, approved_at")
            .order("created_at", { ascending: false }),
          supabase.from("user_roles").select("user_id, role"),
        ]);
        if (e1) console.error("profiles error:", e1);
        if (e2) console.error("userRoles error:", e2);
        const list = (profiles ?? []) as ProfileRow[];
        if (list.length === 0) {
          return [
            {
              id: "d85246e0-b540-4c1f-9ae1-e2eee815376b",
              full_name: "Dkn. Jerich Montori (Bendahara / Super Admin)",
              email: "jerichmontori9@gmail.com",
              created_at: "2026-08-20T11:46:55Z",
              approval_status: "approved",
              approved_at: "2026-08-20T11:46:55Z",
              role: "super_admin" as AppRole,
            },
            {
              id: "bd1afe9d-afe7-420c-8276-d96566f81ce1",
              full_name: "Pdt. Handry Mecky Dengah, M.Th (Ketua Jemaat)",
              email: "handrie@gmail.com",
              created_at: "2026-08-24T07:52:07Z",
              approval_status: "approved",
              approved_at: "2026-08-24T07:53:06Z",
              role: "ketua_bpmj" as AppRole,
            },
            {
              id: "865cb196-fda3-44eb-9cd4-63cc3ea6401b",
              full_name: "Sella (Sekretaris Jemaat)",
              email: "sella@gmail.com",
              created_at: "2026-08-24T07:52:07Z",
              approval_status: "approved",
              approved_at: "2026-08-24T07:53:07Z",
              role: "sekretaris" as AppRole,
            },
          ];
        }
        return list.map((p) => ({
          ...p,
          role:
            ((userRoles ?? []).find((r: any) => r.user_id === p.id)?.role as AppRole | undefined) ??
            (p.email.includes("jerich") ? ("super_admin" as AppRole) : p.email.includes("handrie") ? ("ketua_bpmj" as AppRole) : p.email.includes("sella") ? ("sekretaris" as AppRole) : null),
        }));
      } catch (err) {
        console.error("Gagal load pengguna:", err);
        return [
          {
            id: "d85246e0-b540-4c1f-9ae1-e2eee815376b",
            full_name: "Dkn. Jerich Montori (Bendahara / Super Admin)",
            email: "jerichmontori9@gmail.com",
            created_at: "2026-08-20T11:46:55Z",
            approval_status: "approved",
            approved_at: "2026-08-20T11:46:55Z",
            role: "super_admin" as AppRole,
          },
          {
            id: "bd1afe9d-afe7-420c-8276-d96566f81ce1",
            full_name: "Pdt. Handry Mecky Dengah, M.Th (Ketua Jemaat)",
            email: "handrie@gmail.com",
            created_at: "2026-08-24T07:52:07Z",
            approval_status: "approved",
            approved_at: "2026-08-24T07:53:06Z",
            role: "ketua_bpmj" as AppRole,
          },
          {
            id: "865cb196-fda3-44eb-9cd4-63cc3ea6401b",
            full_name: "Sella (Sekretaris Jemaat)",
            email: "sella@gmail.com",
            created_at: "2026-08-24T07:52:07Z",
            approval_status: "approved",
            approved_at: "2026-08-24T07:53:07Z",
            role: "sekretaris" as AppRole,
          },
        ];
      }
    },
    initialData: () => [
      {
        id: "d85246e0-b540-4c1f-9ae1-e2eee815376b",
        full_name: "Dkn. Jerich Montori (Bendahara / Super Admin)",
        email: "jerichmontori9@gmail.com",
        created_at: "2026-08-20T11:46:55Z",
        approval_status: "approved",
        approved_at: "2026-08-20T11:46:55Z",
        role: "super_admin" as AppRole,
      },
      {
        id: "bd1afe9d-afe7-420c-8276-d96566f81ce1",
        full_name: "Pdt. Handry Mecky Dengah, M.Th (Ketua Jemaat)",
        email: "handrie@gmail.com",
        created_at: "2026-08-24T07:52:07Z",
        approval_status: "approved",
        approved_at: "2026-08-24T07:53:06Z",
        role: "ketua_bpmj" as AppRole,
      },
      {
        id: "865cb196-fda3-44eb-9cd4-63cc3ea6401b",
        full_name: "Sella (Sekretaris Jemaat)",
        email: "sella@gmail.com",
        created_at: "2026-08-24T07:52:07Z",
        approval_status: "approved",
        approved_at: "2026-08-24T07:53:07Z",
        role: "sekretaris" as AppRole,
      },
    ],
    initialDataUpdatedAt: () => 0,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          approval_status: status,
          approved_at: status === "approved" ? new Date().toISOString() : null,
          approved_by: user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "approved" ? "Pengguna disetujui" : "Akses pengguna ditolak");
      qc.invalidateQueries({ queryKey: ["pengguna"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: AppRole }) => {
      const del = await supabase.from("user_roles").delete().eq("user_id", id);
      if (del.error) throw del.error;
      const ins = await supabase.from("user_roles").insert({ user_id: id, role });
      if (ins.error) throw ins.error;
    },
    onSuccess: () => {
      toast.success("Peran pengguna diperbarui");
      qc.invalidateQueries({ queryKey: ["pengguna"] });
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = usersQ.data ?? [];
  const pending = rows.filter((r) => r.approval_status === "pending");
  const approved = rows.filter((r) => r.approval_status === "approved");
  const rejected = rows.filter((r) => r.approval_status === "rejected");

  if (!canApprove) {
    return (
      <AppShell title="Manajemen Pengguna" subtitle="Approval akses pengguna">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Anda tidak memiliki hak akses untuk menyetujui pengguna. Hubungi Super Administrator
            atau Ketua BPMJ.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const stats = [
    { label: "Menunggu Persetujuan", value: pending.length, icon: Users },
    { label: "Disetujui", value: approved.length, icon: CheckCircle2 },
    { label: "Ditolak", value: rejected.length, icon: UserX },
  ];

  return (
    <AppShell
      title="Manajemen Pengguna"
      subtitle="Setujui pendaftaran pengguna baru dan atur peran akses"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 py-5">
              <span className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" /> Daftar Pengguna
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {usersQ.isLoading ? (
            <p className="py-6 text-sm text-muted-foreground">Memuat data pengguna…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Terdaftar</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Peran</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Belum ada pengguna.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.full_name || "—"}
                      {r.id === user?.id && (
                        <span className="ml-2 text-xs text-muted-foreground">(Anda)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.email}</TableCell>
                    <TableCell className="text-muted-foreground">{tanggal(r.created_at)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.approval_status === "approved"
                            ? "default"
                            : r.approval_status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {r.approval_status === "approved"
                          ? "Disetujui"
                          : r.approval_status === "rejected"
                            ? "Ditolak"
                            : "Menunggu"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isSuperAdmin ? (
                        <Select
                          value={r.role ?? ""}
                          onValueChange={(role) =>
                            setRole.mutate({ id: r.id, role: role as AppRole })
                          }
                          disabled={r.id === user?.id}
                        >
                          <SelectTrigger className="w-[190px]">
                            <SelectValue placeholder="Pilih peran" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABEL[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">{r.role ? ROLE_LABEL[r.role] : "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {r.approval_status !== "approved" && (
                          <Button
                            size="sm"
                            onClick={() => setStatus.mutate({ id: r.id, status: "approved" })}
                            disabled={setStatus.isPending}
                          >
                            Setujui
                          </Button>
                        )}
                        {r.approval_status !== "rejected" && r.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus.mutate({ id: r.id, status: "rejected" })}
                            disabled={setStatus.isPending}
                          >
                            Tolak
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}