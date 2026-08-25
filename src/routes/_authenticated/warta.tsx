import { createFileRoute } from "@tanstack/react-router";
import { WartaContent } from "@/components/reports/WartaContent";

export const Route = createFileRoute("/_authenticated/warta")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Warta Keuangan Mingguan — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content: "Laporan penerimaan & pengeluaran kas jemaat per minggu.",
      },
    ],
  }),
  component: WartaPage,
});

function WartaPage() {
  return <WartaContent isPelsusView={false} />;
}
