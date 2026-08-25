import { createFileRoute } from "@tanstack/react-router";
import { LaporanKolomContent } from "@/components/reports/LaporanKolomContent";

export const Route = createFileRoute("/_authenticated/laporan")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Laporan Kolom & BIPRA — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content: "Matriks penerimaan kas per kolom jemaat dan BIPRA berdasarkan bulan.",
      },
    ],
  }),
  component: LaporanPage,
});

function LaporanPage() {
  return <LaporanKolomContent isPelsusView={false} />;
}
