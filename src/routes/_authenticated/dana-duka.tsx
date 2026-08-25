import { createFileRoute } from "@tanstack/react-router";
import { DanaDukaContent } from "@/components/reports/DanaDukaContent";

export const Route = createFileRoute("/_authenticated/dana-duka")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Status & Rekap Dana Duka Kolom 1-29 — BUMOTIK FINANCIAL" },
      {
        name: "description",
        content: "Matriks status tunggakan duka 29 kolom dan riwayat pelunasan.",
      },
    ],
  }),
  component: DanaDukaPage,
});

function DanaDukaPage() {
  return <DanaDukaContent isPelsusView={false} />;
}
