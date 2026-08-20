import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DUKA_KOLOM, bacaDuka, simpanDuka, type DukaMap } from "@/lib/duka";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dana-duka")({
  head: () => ({
    meta: [
      { title: "Dana Diakonia Duka Jemaat — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content:
          "Pencatatan status Dana Diakonia Duka Jemaat per kolom 1 sampai 29, tampil otomatis pada Warta Keuangan mingguan.",
      },
      { property: "og:title", content: "Dana Diakonia Duka Jemaat — BUMOTIK FINANCIAL" },
      {
        property: "og:description",
        content: "Status pelunasan dana duka setiap kolom jemaat, terhubung dengan warta mingguan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DanaDukaPage,
});

function DanaDukaPage() {
  const [data, setData] = useState<DukaMap>({});

  useEffect(() => {
    setData(bacaDuka());
  }, []);

  const set = (kolom: number, value: string) =>
    setData((d) => ({ ...d, [String(kolom)]: value }));

  const simpan = () => {
    simpanDuka(data);
    toast.success("Data dana duka tersimpan dan akan tampil pada Warta Keuangan");
  };

  return (
    <AppShell
      title="Dana Diakonia Duka Jemaat"
      subtitle="Status tunggakan per kolom — ditampilkan otomatis pada Warta Keuangan mingguan"
      actions={
        <Button onClick={simpan}>
          <Save className="mr-2 size-4" /> Simpan
        </Button>
      }
    >
      <div className="panel p-5">
        <p className="mb-4 text-sm text-muted-foreground">
          Isi &ldquo;Lunas&rdquo; bila kolom tidak memiliki tunggakan, atau tuliskan jumlah
          tunggakan misalnya &ldquo;2 x duka&rdquo;.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DUKA_KOLOM.map((k) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-sm font-medium">Kolom {k}</span>
              <Input
                value={data[String(k)] ?? ""}
                placeholder="Lunas"
                onChange={(e) => set(k, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
