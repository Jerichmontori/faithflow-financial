import React, { useRef, useState } from "react";
import { Printer, Download, Scissors, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { rupiah, tanggalPanjang, terbilang } from "@/lib/format";
import { useAppSettings } from "@/lib/settings";
import type { Transaction } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface CetakData {
  voucher_no?: string | undefined;
  trx_date: string;
  kind: "penerimaan" | "pengeluaran";
  budget_line_code?: string | undefined;
  budget_line_name?: string | undefined;
  amount: number;
  payee?: string | null | undefined;
  payment_method?: string | null | undefined;
  description: string;
  items?: Array<{ description: string; amount: number }> | undefined;
}

interface CetakBuktiTransaksiDialogProps {
  trx?: Transaction | undefined;
  data?: CetakData | null | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  trigger?: React.ReactNode;
}

/** Helper cerdas untuk mengekstrak nama penyetor (Kolom, BIPRA, atau Nama Jemaat) dari mata anggaran/keterangan */
export function extractPenyetorName(info: CetakData): string {
  if (info.payee && info.payee.trim() !== "" && !info.payee.toLowerCase().includes("jemaat / donatur")) {
    return info.payee.trim().toUpperCase();
  }

  const desc = (info.description || "").trim();
  const code = (info.budget_line_code || "").trim();
  const name = (info.budget_line_name || "").trim();
  const fullText = `${desc} ${name}`.toLowerCase();

  // 1. Deteksi Kolom spesifik (contoh: "Kolom 1", "Kolom 15", "Klm 5", "Kolom-12")
  const matchKolom = desc.match(/(?:kolom|klm)\s*[-:]?\s*(\d{1,2})/i) || name.match(/(?:kolom|klm)\s*[-:]?\s*(\d{1,2})/i);
  if (matchKolom) {
    return `KOLOM ${matchKolom[1]}`;
  }

  // 2. PKB (Pria/Kaum Bapa)
  if (code === "1.3.01.01" || fullText.includes("pkb aras") || fullText.includes("kompelsus pkb")) {
    const matchPkb = desc.match(/PKB\s+([^,;\n]+)/i);
    return matchPkb ? matchPkb[0].trim().toUpperCase() : "PKB ARAS JEMAAT";
  }
  if (code === "1.3.53.02" || fullText.includes("pkb kolom")) {
    return "KOMPELSUS PKB";
  }

  // 3. W/KI (Wanita/Kaum Ibu)
  if (code === "1.3.01.02" || fullText.includes("wki aras") || fullText.includes("w/ki aras") || fullText.includes("kompelsus w/ki") || fullText.includes("kompelsus wki")) {
    const matchWki = desc.match(/(?:W\/KI|WKI)\s+([^,;\n]+)/i);
    return matchWki ? matchWki[0].trim().toUpperCase() : "W/KI ARAS JEMAAT";
  }
  if (code === "1.3.53.03" || fullText.includes("wki kolom") || fullText.includes("w/ki kolom")) {
    return "KOMPELSUS W/KI";
  }

  // 4. Lansia
  if (code === "1.3.01.08" || fullText.includes("lansia") || fullText.includes("kelompok lansia")) {
    const matchLansia = desc.match(/Lansia\s+([^,;\n]+)/i);
    return matchLansia ? matchLansia[0].trim().toUpperCase() : "LANSIA RAYON";
  }

  // 5. Pemuda
  if (code === "1.3.01.03" || fullText.includes("pemuda aras") || fullText.includes("kompelsus pemuda")) {
    const matchPemuda = desc.match(/Pemuda\s+([^,;\n]+)/i);
    return matchPemuda ? matchPemuda[0].trim().toUpperCase() : "KOMPELSUS PEMUDA";
  }
  if (code === "1.3.53.04" || fullText.includes("pemuda kolom")) {
    return "PEMUDA KOLOM";
  }

  // 6. Remaja
  if (code === "1.3.01.04" || fullText.includes("remaja aras") || fullText.includes("kompelsus remaja")) {
    const matchRemaja = desc.match(/Remaja\s+([^,;\n]+)/i);
    return matchRemaja ? matchRemaja[0].trim().toUpperCase() : "KOMPELSUS REMAJA";
  }
  if (code === "1.3.53.05" || fullText.includes("remaja kolom")) {
    return "REMAJA KOLOM";
  }

  // 7. ASM (Anak Sekolah Minggu)
  if (code === "1.3.01.05" || fullText.includes("asm aras") || fullText.includes("anak sekolah minggu") || fullText.includes("kompelsus anak")) {
    return "KOMPELSUS ANAK (ASM)";
  }
  if (code === "1.3.53.06" || fullText.includes("asm kolom")) {
    return "ASM KOLOM";
  }

  // 8. Dana Duka
  if (code === "3.3.03.01" || code === "1.3.55.01" || fullText.includes("dana duka")) {
    const matchKeluarga = desc.match(/(?:kel|keluarga|alm|almh|alm\.)\s+([^,;\n]+)/i);
    return matchKeluarga?.[1] ? `KELUARGA ${matchKeluarga[1].trim().toUpperCase()}` : "DANA DUKA JEMAAT";
  }

  // 9. PBTK
  if (code === "1.3.66.14" || fullText.includes("pbtk")) {
    const matchKel = desc.match(/(?:kel|keluarga)\s+([^,;\n]+)/i);
    return matchKel?.[1] ? `KELUARGA ${matchKel[1].trim().toUpperCase()}` : "PBTK JEMAAT";
  }

  // 10. Sekolah (TK Bumotik / SD GMIM)
  if (fullText.includes("tk bumotik")) return "TK BUMOTIK";
  if (fullText.includes("sd gmim")) return "SD GMIM 20 MANADO";

  // Fallback ke nama pos anggaran atau jemaat
  if (name) {
    return name.toUpperCase();
  }

  return "JEMAAT / KOLOM";
}

export function CetakBuktiTransaksiDialog({
  trx,
  data,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
}: CetakBuktiTransaksiDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const { settings } = useAppSettings();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? setControlledOpen! : setInternalOpen;

  // Resolve data
  const info: CetakData = data ?? {
    voucher_no: trx?.voucher_no ?? "KM/KK-DRAFT",
    trx_date: trx?.trx_date ?? new Date().toISOString().slice(0, 10),
    kind: trx?.kind ?? "penerimaan",
    budget_line_code: trx?.budget_lines?.code ?? "-",
    budget_line_name: trx?.budget_lines?.name ?? "-",
    amount: Number(trx?.amount ?? 0),
    payee: trx?.payee ?? null,
    payment_method: trx?.payment_method ?? "cash",
    description: trx?.description ?? "-",
    items: trx ? [{ description: trx.description, amount: Number(trx.amount) }] : [],
  };

  const isPenerimaan = info.kind === "penerimaan";
  const judul = isPenerimaan ? "BUKTI PENERIMAAN KAS" : "BUKTI PENGELUARAN KAS";
  const subJudul = isPenerimaan ? "TANDA TERIMA SETORAN" : "KUITANSI PENGELUARAN KAS";

  const namaPenyetorResolved = isPenerimaan ? extractPenyetorName(info) : (info.payee || "PENERIMA / VENDOR");

  const handlePrint = () => {
    if (!printAreaRef.current) return;

    const printContent = printAreaRef.current.innerHTML;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Grab all current document stylesheets
    const styles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
      .map((s) => s.outerHTML)
      .join("\n");

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${judul} - ${info.voucher_no || "BUMOTIK"}</title>
          ${styles}
          <style>
            @page {
              size: portrait; /* Kunci tegas orientasi Portrait */
              margin: 5mm 8mm;
            }
            * {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              background: #fff;
              color: #000;
              font-family: Arial, Helvetica, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-page-wrapper {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <div class="print-page-wrapper">
            ${printContent}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 400);
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setIsGeneratingPdf(true);
    toast.info("Sedang menyiapkan file PDF Portrait...");

    try {
      const html2pdfModule = await import("html2pdf.js");
      const html2pdfFunc =
        typeof html2pdfModule.default === "function"
          ? html2pdfModule.default
          : (html2pdfModule as any);

      const element = printAreaRef.current;
      const opt = {
        margin: [5, 8, 5, 8] as [number, number, number, number],
        filename: `${info.voucher_no || "BUKTI"}_${info.trx_date}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait" as const,
        },
      };

      await html2pdfFunc().set(opt).from(element).save();
      toast.success("PDF berhasil diunduh!");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Tidak dapat mengunduh PDF secara langsung. Mengalihkan ke menu Cetak...");
      handlePrint();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Render a single slip with 100% robust inline styling
  const renderSlip = (lembarKe: 1 | 2, labelLembar: string) => {
    const isTransfer = (info.payment_method?.toLowerCase() || "") === "transfer";
    const multiItems = (info.items ?? []).filter((i) => i.amount > 0 || i.description.trim() !== "");

    return (
      <div
        style={{
          border: "1.5px solid #000",
          padding: "10px 14px",
          marginBottom: "4px",
          backgroundColor: "#ffffff",
          color: "#000000",
          fontSize: "10.5px",
          lineHeight: "1.3",
          fontFamily: "Arial, Helvetica, sans-serif",
          boxSizing: "border-box",
          pageBreakInside: "avoid",
          breakInside: "avoid",
          width: "100%",
        }}
      >
        {/* KOP SURAT RESMI */}
        <table
          style={{
            width: "100%",
            borderBottom: "2.5px double #000",
            paddingBottom: "6px",
            marginBottom: "6px",
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            <tr>
              <td style={{ width: "50px", verticalAlign: "middle", textAlign: "left" }}>
                <img
                  src={settings.logoUrl || "/favicon.png"}
                  alt="Logo GMIM"
                  style={{ width: "44px", height: "44px", objectFit: "contain", display: "block" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/favicon.png";
                  }}
                />
              </td>
              <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                <div style={{ fontSize: "12.5px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.4px", lineHeight: "1.2" }}>
                  {settings.namaGereja || "GEREJA MASEHI INJILI DI MINAHASA (GMIM)"}
                </div>
                <div style={{ fontSize: "11.5px", fontWeight: "900", textTransform: "uppercase", marginTop: "2px", letterSpacing: "0.2px" }}>
                  {settings.namaJemaat || "JEMAAT BUKIT MORIA TIKALA BARU"}
                </div>
                <div style={{ fontSize: "10px", fontWeight: "800", textTransform: "uppercase", marginTop: "1px", color: "#222" }}>
                  {settings.wilayah || "WILAYAH MANADO WAWONASA KOMBOS"}
                </div>
                <div style={{ fontSize: "8.5px", color: "#444", marginTop: "1px" }}>
                  {settings.alamatGereja || "Jl. Lumimuut, Tikala Baru, Kec. Tikala, Kota Manado, Sulawesi Utara"}
                </div>
              </td>
              <td style={{ width: "50px" }}></td>
            </tr>
          </tbody>
        </table>

        {/* BARIS JUDUL & NOMOR BUKTI */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px" }}>
          <tbody>
            <tr>
              <td style={{ width: "32%", verticalAlign: "top", textAlign: "left" }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "8.5px",
                    fontWeight: "bold",
                    border: "1px solid #000",
                    padding: "2px 6px",
                    backgroundColor: "#f2f2f2",
                    textTransform: "uppercase",
                  }}
                >
                  {labelLembar}
                </span>
              </td>
              <td style={{ width: "36%", verticalAlign: "top", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "900",
                    textDecoration: "underline",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {judul}
                </div>
                <div style={{ fontSize: "8.5px", fontWeight: "bold", textTransform: "uppercase", color: "#333", marginTop: "1px" }}>
                  ({subJudul})
                </div>
              </td>
              <td style={{ width: "32%", verticalAlign: "top", textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "9.5px",
                    fontFamily: "'Courier New', monospace",
                    fontWeight: "bold",
                    backgroundColor: "#000",
                    color: "#fff",
                    padding: "2px 8px",
                  }}
                >
                  {info.voucher_no || "NO. BUKTI: -"}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* TABEL DATA TRANSAKSI */}
        <table style={{ width: "100%", borderCollapse: "collapse", margin: "4px 0", fontSize: "10.5px" }}>
          <tbody>
            <tr>
              <td style={{ width: "135px", fontWeight: "bold", padding: "2px 0", verticalAlign: "top" }}>
                Tanggal Transaksi
              </td>
              <td style={{ width: "12px", textAlign: "center", padding: "2px 0", verticalAlign: "top" }}>:</td>
              <td style={{ padding: "2px 0", verticalAlign: "top" }}>{tanggalPanjang(info.trx_date)}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "2px 0", verticalAlign: "top" }}>
                {isPenerimaan ? "Telah Terima Dari" : "Dibayarkan Kepada"}
              </td>
              <td style={{ textAlign: "center", padding: "2px 0", verticalAlign: "top" }}>:</td>
              <td style={{ fontWeight: "900", textTransform: "uppercase", padding: "2px 0", verticalAlign: "top", color: "#000" }}>
                {namaPenyetorResolved}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "2px 0", verticalAlign: "top" }}>Mata Anggaran</td>
              <td style={{ textAlign: "center", padding: "2px 0", verticalAlign: "top" }}>:</td>
              <td style={{ fontWeight: "600", padding: "2px 0", verticalAlign: "top" }}>
                {info.budget_line_code ? `${info.budget_line_code} — ${info.budget_line_name}` : "Operasional Kas Jemaat"}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "2px 0", verticalAlign: "top" }}>
                {isPenerimaan ? "Untuk Penyetoran" : "Untuk Pembayaran"}
              </td>
              <td style={{ textAlign: "center", padding: "2px 0", verticalAlign: "top" }}>:</td>
              <td style={{ padding: "2px 0", verticalAlign: "top" }}>{info.description || "-"}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "2px 0", verticalAlign: "top" }}>Metode Pembayaran</td>
              <td style={{ textAlign: "center", padding: "2px 0", verticalAlign: "top" }}>:</td>
              <td style={{ fontWeight: "600", padding: "2px 0", verticalAlign: "top" }}>
                {isTransfer ? "🏦 Bank / Transfer Non-Tunai" : "💵 Kas Fisik (Tunai / Kasir)"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* MULTI ITEMS TABLE IF ANY */}
        {multiItems.length > 1 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              margin: "4px 0",
              fontSize: "9.5px",
              border: "1px solid #777",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ border: "1px solid #777", padding: "2px 5px", textAlign: "center", width: "28px" }}>No</th>
                <th style={{ border: "1px solid #777", padding: "2px 5px", textAlign: "left" }}>Rincian Pos / Keterangan</th>
                <th style={{ border: "1px solid #777", padding: "2px 5px", textAlign: "right", width: "110px" }}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {multiItems.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ border: "1px solid #777", padding: "2px 5px", textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ border: "1px solid #777", padding: "2px 5px" }}>{it.description}</td>
                  <td style={{ border: "1px solid #777", padding: "2px 5px", textAlign: "right", fontFamily: "'Courier New', monospace", fontWeight: "bold" }}>
                    {rupiah(it.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* KOTAK JUMLAH UANG & TERBILANG */}
        <table
          style={{
            width: "100%",
            border: "1.5px solid #000",
            backgroundColor: "#fcfcfc",
            margin: "6px 0",
            padding: "5px 8px",
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "5px 8px", verticalAlign: "middle", width: "40%" }}>
                <div style={{ fontSize: "8.5px", textTransform: "uppercase", fontWeight: "bold", color: "#555" }}>
                  JUMLAH UANG:
                </div>
                <div style={{ fontSize: "13.5px", fontWeight: "900", fontFamily: "'Courier New', monospace", color: "#000" }}>
                  {rupiah(info.amount)}
                </div>
              </td>
              <td style={{ padding: "5px 8px", verticalAlign: "middle", textAlign: "right", width: "60%" }}>
                <div style={{ fontSize: "8.5px", textTransform: "uppercase", fontWeight: "bold", color: "#555" }}>
                  TERBILANG:
                </div>
                <div style={{ fontSize: "10px", fontWeight: "bold", fontStyle: "italic", color: "#000", lineHeight: "1.2" }}>
                  "{terbilang(info.amount)}"
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* TABEL TANDA TANGAN (3 KOLOM) */}
        <table
          style={{
            width: "100%",
            marginTop: "8px",
            borderCollapse: "collapse",
            textAlign: "center",
            fontSize: "10px",
          }}
        >
          <tbody>
            <tr>
              <td style={{ width: "33.33%", verticalAlign: "top" }}>
                <div>{isPenerimaan ? (settings.labelPenyetor || "Penyetor / Yang Menyerahkan") : (settings.labelPenerima || "Penerima Kas")},</div>
                <div style={{ height: "36px" }}></div>
                <div style={{ fontWeight: "bold", textDecoration: "underline" }}>
                  ( {namaPenyetorResolved} )
                </div>
              </td>
              <td style={{ width: "33.33%", verticalAlign: "top" }}>
                <div>Mengetahui,</div>
                <div style={{ fontSize: "9px", color: "#444" }}>{settings.jabatanKetuaBpmj || "Ketua BPMJ"}</div>
                <div style={{ height: "26px" }}></div>
                <div style={{ fontWeight: "bold", textDecoration: "underline" }}>
                  ( {settings.namaKetuaBpmj || "......................................."} )
                </div>
              </td>
              <td style={{ width: "33.33%", verticalAlign: "top" }}>
                <div>{settings.kotaSurat || "Manado"}, {tanggalPanjang(info.trx_date)}</div>
                <div style={{ fontSize: "9px", color: "#444" }}>{settings.jabatanBendahara || "Bendahara Jemaat"},</div>
                <div style={{ height: "26px" }}></div>
                <div style={{ fontWeight: "bold", textDecoration: "underline" }}>
                  ( {settings.namaBendahara || "......................................."} )
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Printer className="size-4 text-primary" />
                Cetak {judul} (Format Portrait - 2 Rangkap)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Dokumen otomatis disusun memanjang ke bawah (Portrait): <strong>Lembar 1 di bagian Atas (Arsip)</strong> dan <strong>Lembar 2 di bagian Bawah (Penyetor/Penerima)</strong>.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="gap-1.5 text-xs h-8"
              >
                <Download className="size-3.5" /> {isGeneratingPdf ? "Menyiapkan..." : "PDF (Portrait)"}
              </Button>
              <Button size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-8 font-semibold">
                <Printer className="size-3.5" /> Cetak / Print Sekarang
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tampilan Preview Hasil Cetak Portrait */}
        <div className="bg-muted/40 p-3 rounded-lg border overflow-x-auto">
          <div className="text-[11px] text-muted-foreground mb-2 flex items-center justify-between font-medium">
            <span>📄 Pratinjau Cetak Portrait (Atas: Arsip, Bawah: Penyetor)</span>
            <span className="text-primary font-bold">Siap Cetak 2 Rangkap</span>
          </div>

          <div
            ref={printAreaRef}
            style={{
              backgroundColor: "#ffffff",
              color: "#000000",
              padding: "12px",
              margin: "0 auto",
              border: "1px solid #ddd",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              maxWidth: "195mm",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* RANGKAP 1 (BAGIAN ATAS) */}
            {renderSlip(1, "LEMBAR 1: UNTUK ARSIP GEREJA / BENDAHARA")}

            {/* GARIS POTONG DENGAN GUNTING (TENGAH) */}
            <div
              style={{
                textAlign: "center",
                borderTop: "1.5px dashed #666",
                margin: "8px 0",
                paddingTop: "3px",
                fontSize: "9px",
                color: "#555",
                fontWeight: "bold",
                letterSpacing: "0.5px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <Scissors style={{ width: "13px", height: "13px", color: "#666" }} />
              <span>GUNTING / POTONG DI SINI (PEMISAH LEMBAR ARSIP & PENYETOR)</span>
              <Scissors style={{ width: "13px", height: "13px", color: "#666", transform: "scaleX(-1)" }} />
            </div>

            {/* RANGKAP 2 (BAGIAN BAWAH) */}
            {renderSlip(
              2,
              isPenerimaan ? "LEMBAR 2: UNTUK PENYETOR (TANDA TERIMA SAH)" : "LEMBAR 2: UNTUK PENERIMA (TANDA TERIMA SAH)"
            )}
          </div>
        </div>

        <div className="border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>💡 <strong>Tips Cetak:</strong> Pada jendela print browser, pastikan Orientation diset ke <strong>Portrait</strong> dan Margins <strong>Default</strong>.</span>
          <Button variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
