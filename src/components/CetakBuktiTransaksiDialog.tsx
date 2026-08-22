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

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${judul} - ${info.voucher_no || "BUMOTIK"}</title>
          <style>
            @page {
              size: 215mm 330mm portrait; /* Kertas F4 / Folio */
              margin: 6mm 10mm;
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
            .slip {
              border: 1.5px solid #000;
              padding: 10px 14px;
              margin-bottom: 6px;
              background: #fff;
              page-break-inside: avoid;
            }
            .kop {
              display: flex;
              align-items: center;
              justify-content: center;
              border-bottom: 2.5px double #000;
              padding-bottom: 6px;
              margin-bottom: 6px;
              text-align: center;
              position: relative;
            }
            .kop-logo {
              position: absolute;
              left: 6px;
              top: 2px;
              width: 44px;
              height: 44px;
              object-fit: contain;
            }
            .kop-text h2 {
              margin: 0;
              font-size: 13px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .kop-text h3 {
              margin: 2px 0 0 0;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .kop-text p {
              margin: 1px 0 0 0;
              font-size: 8.5px;
              color: #333;
            }
            .doc-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin: 4px 0 6px 0;
            }
            .badge-rangkap {
              font-size: 8.5px;
              font-weight: bold;
              border: 1px solid #000;
              padding: 2px 6px;
              background-color: #f2f2f2;
              text-transform: uppercase;
            }
            .doc-title {
              text-align: center;
            }
            .doc-title h4 {
              margin: 0;
              font-size: 12px;
              font-weight: 900;
              text-decoration: underline;
              text-transform: uppercase;
            }
            .doc-title span {
              font-size: 8.5px;
              font-weight: bold;
              text-transform: uppercase;
              color: #333;
            }
            .badge-voucher {
              font-size: 9.5px;
              font-family: 'Courier New', monospace;
              font-weight: bold;
              background: #000;
              color: #fff;
              padding: 2px 6px;
            }
            .meta-table {
              width: 100%;
              border-collapse: collapse;
              margin: 4px 0;
              font-size: 10px;
            }
            .meta-table td {
              padding: 2px 0;
              vertical-align: top;
            }
            .amount-box {
              border: 1.5px solid #000;
              padding: 5px 10px;
              margin: 6px 0;
              background-color: #fafafa;
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            .amount-num {
              font-size: 13.5px;
              font-weight: 900;
              font-family: 'Courier New', monospace;
            }
            .amount-words {
              font-style: italic;
              font-size: 9.5px;
              font-weight: bold;
              text-align: right;
              max-width: 65%;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 4px 0;
              font-size: 9px;
            }
            .items-table th, .items-table td {
              border: 1px solid #666;
              padding: 2px 5px;
            }
            .items-table th {
              background: #eee;
              text-align: left;
            }
            .ttd-table {
              width: 100%;
              margin-top: 8px;
              border-collapse: collapse;
              text-align: center;
              font-size: 9.5px;
            }
            .ttd-table td {
              vertical-align: top;
              padding: 0 4px;
            }
            .ttd-space {
              height: 38px;
            }
            .cutting-line {
              text-align: center;
              border-top: 1.5px dashed #666;
              margin: 8px 0;
              padding-top: 2px;
              font-size: 9px;
              color: #555;
              font-weight: bold;
              letter-spacing: 0.5px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 300);
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setIsGeneratingPdf(true);
    toast.info("Sedang menyiapkan file PDF (Kertas F4)...");

    try {
      // Dynamically load html2pdf safely
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
          format: [215, 330] as [number, number], // F4 dimensions
          orientation: "portrait" as const,
        },
      };

      await html2pdfFunc().set(opt).from(element).save();
      toast.success("PDF berhasil diunduh!");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Tidak dapat membuat PDF otomatis. Mengalihkan ke menu Cetak/Save as PDF...");
      handlePrint();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Render a single slip with clean styles
  const renderSlip = (lembarKe: 1 | 2, labelLembar: string) => {
    const isTransfer = (info.payment_method?.toLowerCase() || "") === "transfer";
    const multiItems = (info.items ?? []).filter((i) => i.amount > 0 || i.description.trim() !== "");

    return (
      <div className="slip border border-black p-3 mb-2 bg-white text-black text-[10px] leading-snug rounded-none shadow-none">
        {/* Kop Surat Gereja */}
        <div className="border-b-[2.5px] border-double border-black pb-2 mb-1.5 flex items-center justify-between text-center relative">
          <img
            src={settings.logoUrl || "/favicon.png"}
            alt="Logo"
            className="size-10 object-contain absolute left-1 top-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="w-full text-center pl-8 pr-2">
            <h2 className="text-[12.5px] font-black uppercase tracking-wide leading-tight">
              {settings.namaGereja || "Gereja Masehi Injili di Minahasa (GMIM)"}
            </h2>
            <h3 className="text-[10.5px] font-extrabold uppercase mt-0.5 text-gray-900">
              {settings.wilayah || "Jemaat Bukit Moria Tikala Baru — Wilayah Manado Wawonasa Kombos"}
            </h3>
            <p className="text-[8.5px] text-gray-700 mt-0.5">
              {settings.alamatGereja || "Jl. Lumimuut, Tikala Baru, Kec. Tikala, Kota Manado, Sulawesi Utara"}
            </p>
          </div>
        </div>

        {/* Judul Dokumen & Lembar */}
        <div className="flex items-center justify-between mb-1.5 pt-0.5">
          <div>
            <span className="inline-block text-[8px] font-bold border border-black px-1.5 py-0.5 uppercase bg-gray-100">
              {labelLembar}
            </span>
          </div>
          <div className="text-center">
            <h4 className="text-[12px] font-black uppercase underline tracking-wide leading-tight">
              {judul}
            </h4>
            <span className="text-[8.5px] font-bold text-gray-700 block uppercase">
              ({subJudul})
            </span>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-mono font-bold bg-black text-white px-2 py-0.5 rounded-xs">
              {info.voucher_no || "NO. BUKTI: -"}
            </span>
          </div>
        </div>

        {/* Tabel Metadata Transaksi */}
        <table className="w-full border-collapse my-1 text-[10px]">
          <tbody>
            <tr>
              <td className="w-32 font-bold text-gray-900 py-0.5">Tanggal Transaksi</td>
              <td className="w-3 text-center py-0.5">:</td>
              <td className="font-medium py-0.5">{tanggalPanjang(info.trx_date)}</td>
            </tr>
            <tr>
              <td className="font-bold text-gray-900 py-0.5">
                {isPenerimaan ? "Telah Terima Dari" : "Dibayarkan Kepada"}
              </td>
              <td className="text-center py-0.5">:</td>
              <td className="font-extrabold uppercase py-0.5 text-black">
                {info.payee || (isPenerimaan ? "Jemaat / Donatur / Kolom" : "Penerima / Vendor")}
              </td>
            </tr>
            <tr>
              <td className="font-bold text-gray-900 py-0.5">Mata Anggaran</td>
              <td className="text-center py-0.5">:</td>
              <td className="font-semibold py-0.5">
                {info.budget_line_code ? `${info.budget_line_code} — ${info.budget_line_name}` : "Operasional Kas Jemaat"}
              </td>
            </tr>
            <tr>
              <td className="font-bold text-gray-900 py-0.5">Untuk Pembayaran</td>
              <td className="text-center py-0.5">:</td>
              <td className="py-0.5">{info.description || "-"}</td>
            </tr>
            <tr>
              <td className="font-bold text-gray-900 py-0.5">Metode Pembayaran</td>
              <td className="text-center py-0.5">:</td>
              <td className="font-semibold py-0.5">
                {isTransfer ? "🏦 Bank / Transfer Non-Tunai" : "💵 Kas Fisik (Tunai / Kasir)"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Jika ada multi items rincian */}
        {multiItems.length > 1 && (
          <table className="w-full border-collapse border border-gray-400 my-1.5 text-[9px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 p-0.5 text-center w-6">No</th>
                <th className="border border-gray-400 p-0.5 text-left">Rincian Pos / Keterangan</th>
                <th className="border border-gray-400 p-0.5 text-right w-24">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {multiItems.map((it, idx) => (
                <tr key={idx}>
                  <td className="border border-gray-400 p-0.5 text-center">{idx + 1}</td>
                  <td className="border border-gray-400 p-0.5">{it.description}</td>
                  <td className="border border-gray-400 p-0.5 text-right font-mono font-semibold">
                    {rupiah(it.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Kotak Nominal & Terbilang */}
        <div className="border border-black p-1.5 my-1.5 bg-gray-50 flex items-center justify-between">
          <div>
            <span className="text-[8px] uppercase font-bold text-gray-600 block">Jumlah Uang:</span>
            <span className="text-[13px] font-black font-mono tracking-tight text-black">
              {rupiah(info.amount)}
            </span>
          </div>
          <div className="text-right max-w-[65%]">
            <span className="text-[8px] uppercase font-bold text-gray-600 block">Terbilang:</span>
            <span className="text-[9.5px] font-bold italic text-black leading-tight block">
              "{terbilang(info.amount)}"
            </span>
          </div>
        </div>

        {/* Tanda Tangan */}
        <table className="w-full mt-2 text-center text-[9.5px] border-collapse">
          <tbody>
            <tr>
              <td className="w-1/3">
                <span>{isPenerimaan ? (settings.labelPenyetor || "Penyetor / Yang Menyerahkan") : (settings.labelPenerima || "Penerima Kas")},</span>
                <div className="h-9"></div>
                <span className="font-bold underline block">
                  ( {info.payee || "......................................."} )
                </span>
              </td>
              <td className="w-1/3">
                <span>Mengetahui,</span>
                <span className="block text-[8.5px] text-gray-600">{settings.jabatanKetuaBpmj || "Ketua BPMJ"}</span>
                <div className="h-7"></div>
                <span className="font-bold underline block">
                  ( {settings.namaKetuaBpmj || "......................................."} )
                </span>
              </td>
              <td className="w-1/3">
                <span>{settings.kotaSurat || "Manado"}, {tanggalPanjang(info.trx_date)}</span>
                <span className="block font-medium">{settings.jabatanBendahara || "Bendahara Jemaat"},</span>
                <div className="h-7"></div>
                <span className="font-bold underline block">
                  ( {settings.namaBendahara || "......................................."} )
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}

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
            className="bg-white text-black p-4 mx-auto border shadow-sm max-w-[210mm]"
            style={{ fontFamily: "Arial, sans-serif" }}
          >
            {/* RANGKAP 1 */}
            {renderSlip(1, "LEMBAR 1: UNTUK ARSIP GEREJA / BENDAHARA")}

            {/* GARIS POTONG DENGAN GUNTING */}
            <div className="my-2 text-center border-t-2 border-dashed border-gray-400 relative pt-1 flex items-center justify-center gap-2 text-gray-600 text-[9px] font-bold">
              <Scissors className="size-3.5 text-gray-500" />
              <span>GUNTING / POTONG DI SINI (PEMISAH LEMBAR ARSIP & PENYETOR)</span>
              <Scissors className="size-3.5 text-gray-500 scale-x-[-1]" />
            </div>

            {/* RANGKAP 2 */}
            {renderSlip(2, isPenerimaan ? "LEMBAR 2: UNTUK PENYETOR (TANDA TERIMA SAH)" : "LEMBAR 2: UNTUK PENERIMA (TANDA TERIMA SAH)")}
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
