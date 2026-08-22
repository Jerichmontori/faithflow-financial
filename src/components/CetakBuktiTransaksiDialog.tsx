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
              size: 215mm 330mm portrait; /* Kertas F4 / Folio */
              margin: 8mm 12mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, Helvetica, sans-serif;
              color: #000;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body>
          <div style="width: 100%; max-width: 210mm; margin: 0 auto;">
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
    toast.info("Sedang menyiapkan file PDF (Kertas F4)...");

    try {
      const html2pdfModule = await import("html2pdf.js");
      const html2pdfFunc =
        typeof html2pdfModule.default === "function"
          ? html2pdfModule.default
          : (html2pdfModule as any);

      const element = printAreaRef.current;
      const opt = {
        margin: [6, 10, 6, 10] as [number, number, number, number],
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
          format: [215, 330] as [number, number], // F4 dimensions
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
          padding: "12px 16px",
          marginBottom: "6px",
          backgroundColor: "#fff",
          color: "#000",
          fontSize: "11px",
          lineHeight: "1.35",
          fontFamily: "Arial, Helvetica, sans-serif",
          boxSizing: "border-box",
        }}
      >
        {/* KOP SURAT RESMI */}
        <table
          style={{
            width: "100%",
            borderBottom: "2.5px double #000",
            paddingBottom: "8px",
            marginBottom: "8px",
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            <tr>
              <td style={{ width: "55px", verticalAlign: "middle", textAlign: "left" }}>
                <img
                  src={settings.logoUrl || "/favicon.png"}
                  alt="Logo GMIM"
                  style={{ width: "48px", height: "48px", objectFit: "contain", display: "block" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/favicon.png";
                  }}
                />
              </td>
              <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                <div style={{ fontSize: "13px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {settings.namaGereja || "GEREJA MASEHI INJILI DI MINAHASA (GMIM)"}
                </div>
                <div style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", marginTop: "2px" }}>
                  {settings.wilayah || "JEMAAT BUKIT MORIA TIKALA BARU — WILAYAH MANADO WAWONASA KOMBOS"}
                </div>
                <div style={{ fontSize: "9px", color: "#333", marginTop: "2px" }}>
                  {settings.alamatGereja || "Jl. Lumimuut, Tikala Baru, Kec. Tikala, Kota Manado, Sulawesi Utara"}
                </div>
              </td>
              <td style={{ width: "55px" }}></td>
            </tr>
          </tbody>
        </table>

        {/* BARIS JUDUL & NOMOR BUKTI */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px" }}>
          <tbody>
            <tr>
              <td style={{ width: "32%", verticalAlign: "top", textAlign: "left" }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "9px",
                    fontWeight: "bold",
                    border: "1px solid #000",
                    padding: "2px 8px",
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
                    fontSize: "12.5px",
                    fontWeight: "900",
                    textDecoration: "underline",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {judul}
                </div>
                <div style={{ fontSize: "9px", fontWeight: "bold", textTransform: "uppercase", color: "#333", marginTop: "1px" }}>
                  ({subJudul})
                </div>
              </td>
              <td style={{ width: "32%", verticalAlign: "top", textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "10px",
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
        <table style={{ width: "100%", borderCollapse: "collapse", margin: "6px 0", fontSize: "11px" }}>
          <tbody>
            <tr>
              <td style={{ width: "140px", fontWeight: "bold", padding: "2px 0", verticalAlign: "top" }}>
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
              <td style={{ fontWeight: "900", textTransform: "uppercase", padding: "2px 0", verticalAlign: "top" }}>
                {info.payee || (isPenerimaan ? "JEMAAT / DONATUR / KOLOM" : "PENERIMA / VENDOR")}
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
              <td style={{ fontWeight: "bold", padding: "2px 0", verticalAlign: "top" }}>Untuk Pembayaran</td>
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
              margin: "6px 0",
              fontSize: "10px",
              border: "1px solid #777",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ border: "1px solid #777", padding: "3px 6px", textAlign: "center", width: "30px" }}>No</th>
                <th style={{ border: "1px solid #777", padding: "3px 6px", textAlign: "left" }}>Rincian Pos / Keterangan</th>
                <th style={{ border: "1px solid #777", padding: "3px 6px", textAlign: "right", width: "120px" }}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {multiItems.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ border: "1px solid #777", padding: "2px 6px", textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ border: "1px solid #777", padding: "2px 6px" }}>{it.description}</td>
                  <td style={{ border: "1px solid #777", padding: "2px 6px", textAlign: "right", fontFamily: "'Courier New', monospace", fontWeight: "bold" }}>
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
            margin: "8px 0",
            padding: "6px 10px",
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "6px 10px", verticalAlign: "middle", width: "40%" }}>
                <div style={{ fontSize: "9px", textTransform: "uppercase", fontWeight: "bold", color: "#555" }}>
                  JUMLAH UANG:
                </div>
                <div style={{ fontSize: "14px", fontWeight: "900", fontFamily: "'Courier New', monospace", color: "#000" }}>
                  {rupiah(info.amount)}
                </div>
              </td>
              <td style={{ padding: "6px 10px", verticalAlign: "middle", textAlign: "right", width: "60%" }}>
                <div style={{ fontSize: "9px", textTransform: "uppercase", fontWeight: "bold", color: "#555" }}>
                  TERBILANG:
                </div>
                <div style={{ fontSize: "10.5px", fontWeight: "bold", fontStyle: "italic", color: "#000", lineHeight: "1.25" }}>
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
            marginTop: "10px",
            borderCollapse: "collapse",
            textAlign: "center",
            fontSize: "10.5px",
          }}
        >
          <tbody>
            <tr>
              <td style={{ width: "33.33%", verticalAlign: "top" }}>
                <div>{isPenerimaan ? (settings.labelPenyetor || "Penyetor / Yang Menyerahkan") : (settings.labelPenerima || "Penerima Kas")},</div>
                <div style={{ height: "42px" }}></div>
                <div style={{ fontWeight: "bold", textDecoration: "underline" }}>
                  ( {info.payee || "......................................."} )
                </div>
              </td>
              <td style={{ width: "33.33%", verticalAlign: "top" }}>
                <div>Mengetahui,</div>
                <div style={{ fontSize: "9.5px", color: "#444" }}>{settings.jabatanKetuaBpmj || "Ketua BPMJ"}</div>
                <div style={{ height: "30px" }}></div>
                <div style={{ fontWeight: "bold", textDecoration: "underline" }}>
                  ( {settings.namaKetuaBpmj || "......................................."} )
                </div>
              </td>
              <td style={{ width: "33.33%", verticalAlign: "top" }}>
                <div>{settings.kotaSurat || "Manado"}, {tanggalPanjang(info.trx_date)}</div>
                <div style={{ fontSize: "9.5px", color: "#444" }}>{settings.jabatanBendahara || "Bendahara Jemaat"},</div>
                <div style={{ height: "30px" }}></div>
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
                Cetak {judul} (Format Kertas F4 - 2 Rangkap)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Dokumen otomatis dibagi menjadi 2 rangkap dalam 1 lembar F4: <strong>Lembar 1 (Arsip Gereja)</strong> dan <strong>Lembar 2 (Tanda Terima Penyetor/Penerima)</strong>.
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
                <Download className="size-3.5" /> {isGeneratingPdf ? "Menyiapkan..." : "PDF (F4)"}
              </Button>
              <Button size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-8 font-semibold">
                <Printer className="size-3.5" /> Cetak / Print Sekarang
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tampilan Preview Hasil Cetak F4 */}
        <div className="bg-muted/40 p-3 rounded-lg border overflow-x-auto">
          <div className="text-[11px] text-muted-foreground mb-2 flex items-center justify-between font-medium">
            <span>📄 Pratinjau Cetak Kertas F4 (215mm × 330mm)</span>
            <span className="text-primary font-bold">Siap Cetak 2 Rangkap</span>
          </div>

          <div
            ref={printAreaRef}
            style={{
              backgroundColor: "#ffffff",
              color: "#000000",
              padding: "16px",
              margin: "0 auto",
              border: "1px solid #ddd",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              maxWidth: "210mm",
              boxSizing: "border-box",
            }}
          >
            {/* RANGKAP 1 */}
            {renderSlip(1, "LEMBAR 1: UNTUK ARSIP GEREJA / BENDAHARA")}

            {/* GARIS POTONG DENGAN GUNTING */}
            <div
              style={{
                textAlign: "center",
                borderTop: "1.5px dashed #666",
                margin: "10px 0",
                paddingTop: "4px",
                fontSize: "9.5px",
                color: "#555",
                fontWeight: "bold",
                letterSpacing: "0.5px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <Scissors style={{ width: "14px", height: "14px", color: "#666" }} />
              <span>GUNTING / POTONG DI SINI (PEMISAH LEMBAR ARSIP & PENYETOR)</span>
              <Scissors style={{ width: "14px", height: "14px", color: "#666", transform: "scaleX(-1)" }} />
            </div>

            {/* RANGKAP 2 */}
            {renderSlip(
              2,
              isPenerimaan ? "LEMBAR 2: UNTUK PENYETOR (TANDA TERIMA SAH)" : "LEMBAR 2: UNTUK PENERIMA (TANDA TERIMA SAH)"
            )}
          </div>
        </div>

        <div className="border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>💡 <strong>Tips Cetak:</strong> Pada dialog print browser, pilih ukuran kertas <strong>F4 / Folio (8.5 x 13 in)</strong> dan Margin <strong>Default / Minimum</strong>.</span>
          <Button variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
