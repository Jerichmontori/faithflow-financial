import React, { useRef, useState } from "react";
import { Printer, Download, Scissors, Check, Copy } from "lucide-react";
import html2pdf from "html2pdf.js";
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
  const printAreaRef = useRef<HTMLDivElement>(null);

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

    // Create a temporary hidden print frame for exact F4 2-rangkap printing
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
              margin: 8mm 10mm;
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
            .slip-wrapper {
              width: 100%;
              box-sizing: border-box;
            }
            .slip {
              border: 1.5px solid #000;
              padding: 10px 14px;
              margin-bottom: 6px;
              font-size: 11px;
              line-height: 1.35;
              background: #fff;
              box-sizing: border-box;
            }
            .kop {
              display: flex;
              align-items: center;
              border-bottom: 2px solid #000;
              padding-bottom: 6px;
              margin-bottom: 8px;
            }
            .kop-text {
              flex: 1;
              text-align: center;
            }
            .kop-text h2 {
              margin: 0;
              font-size: 13px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .kop-text h3 {
              margin: 2px 0 0 0;
              font-size: 11.5px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .kop-text p {
              margin: 1px 0 0 0;
              font-size: 9.5px;
              color: #222;
            }
            .doc-title {
              text-align: center;
              margin: 6px 0;
            }
            .doc-title h4 {
              margin: 0;
              font-size: 12.5px;
              font-weight: 800;
              text-decoration: underline;
              text-transform: uppercase;
            }
            .doc-title span {
              font-size: 9px;
              font-weight: 600;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            .badge-rangkap {
              display: inline-block;
              font-size: 9px;
              font-weight: bold;
              border: 1px solid #000;
              padding: 1px 6px;
              border-radius: 2px;
              margin-top: 2px;
            }
            .meta-grid {
              display: table;
              width: 100%;
              margin: 6px 0;
              border-collapse: collapse;
            }
            .meta-row {
              display: table-row;
            }
            .meta-label {
              display: table-cell;
              width: 28%;
              font-weight: bold;
              padding: 2px 0;
              vertical-align: top;
              font-size: 10.5px;
            }
            .meta-colon {
              display: table-cell;
              width: 2%;
              padding: 2px 0;
              vertical-align: top;
              font-size: 10.5px;
            }
            .meta-value {
              display: table-cell;
              width: 70%;
              padding: 2px 0;
              vertical-align: top;
              font-size: 10.5px;
            }
            .amount-box {
              border: 1.5px solid #000;
              padding: 6px 10px;
              margin: 8px 0;
              background-color: #fcfcfc;
            }
            .amount-num {
              font-size: 14px;
              font-weight: 800;
              font-family: 'Courier New', monospace;
            }
            .amount-words {
              font-style: italic;
              font-size: 10px;
              margin-top: 2px;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 6px 0;
              font-size: 10px;
            }
            .items-table th, .items-table td {
              border: 1px solid #777;
              padding: 3px 6px;
            }
            .items-table th {
              background: #eee;
              text-align: left;
            }
            .ttd-table {
              width: 100%;
              margin-top: 10px;
              border-collapse: collapse;
              text-align: center;
              font-size: 10px;
            }
            .ttd-space {
              height: 42px;
            }
            .cutting-line {
              text-align: center;
              border-top: 1.5px dashed #555;
              margin: 12px 0;
              position: relative;
              padding-top: 3px;
              font-size: 9.5px;
              color: #444;
              font-weight: bold;
              letter-spacing: 1px;
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

  const handleDownloadPdf = () => {
    if (!printAreaRef.current) return;
    toast.info("Sedang menyiapkan file PDF (Kertas F4)...");
    const element = printAreaRef.current;
    const opt = {
      margin: [6, 8, 6, 8] as [number, number, number, number],
      filename: `${info.voucher_no || "BUKTI"}_${info.trx_date}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2.5, useCORS: true },
      jsPDF: { unit: "mm", format: [215, 330] as [number, number], orientation: "portrait" as const },
    };

    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => toast.success("PDF berhasil diunduh"))
      .catch(() => toast.error("Gagal membuat PDF"));
  };

  const { settings } = useAppSettings();

  // Render a single slip
  const renderSlip = (lembarKe: 1 | 2, labelLembar: string) => {
    const isTransfer = (info.payment_method?.toLowerCase() || "") === "transfer";
    const multiItems = (info.items ?? []).filter((i) => i.amount > 0 || i.description.trim() !== "");

    return (
      <div className="slip border-2 border-black p-3.5 mb-2 bg-white text-black text-[11px] leading-snug rounded-none shadow-none">
        {/* Kop Surat Gereja */}
        <div className="border-b-2 border-black pb-2 mb-2 flex items-center justify-between text-center">
          <div className="w-full text-center">
            <h2 className="text-[13px] font-black uppercase tracking-wide leading-tight">
              {settings.namaGereja || "Gereja Masehi Injili di Minahasa (GMIM)"}
            </h2>
            <h3 className="text-[11px] font-extrabold uppercase mt-0.5 text-gray-900">
              {settings.wilayah || "Jemaat Bukit Moria Tikala Baru — Wilayah Manado Wawonasa Kombos"}
            </h3>
            <p className="text-[9px] text-gray-700 mt-0.5">
              {settings.alamatGereja || "Jl. Lumimuut, Tikala Baru, Kec. Tikala, Kota Manado, Sulawesi Utara"}
            </p>
          </div>
        </div>

        {/* Judul Dokumen & Lembar */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className="inline-block text-[9px] font-bold border border-black px-2 py-0.5 uppercase bg-gray-100">
              {labelLembar}
            </span>
          </div>
          <div className="text-center">
            <h4 className="text-[12.5px] font-black uppercase underline tracking-wide">
              {judul}
            </h4>
            <span className="text-[9px] font-bold text-gray-700 block uppercase">
              ({subJudul})
            </span>
          </div>
          <div className="text-right">
            <span className="text-[9.5px] font-mono font-bold bg-black text-white px-2 py-0.5 rounded-sm">
              {info.voucher_no || "NO. BUKTI: -"}
            </span>
          </div>
        </div>

        {/* Tabel Metadata Transaksi */}
        <div className="space-y-1 my-2 text-[10.5px]">
          <div className="grid grid-cols-12 gap-1">
            <span className="col-span-3 font-bold text-gray-900">Tanggal Transaksi</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-8 font-medium">{tanggalPanjang(info.trx_date)}</span>
          </div>

          <div className="grid grid-cols-12 gap-1">
            <span className="col-span-3 font-bold text-gray-900">
              {isPenerimaan ? "Telah Terima Dari" : "Dibayarkan Kepada"}
            </span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-8 font-extrabold uppercase">
              {info.payee || (isPenerimaan ? "Jemaat / Donatur / Kolom" : "Penerima / Vendor")}
            </span>
          </div>

          <div className="grid grid-cols-12 gap-1">
            <span className="col-span-3 font-bold text-gray-900">Mata Anggaran</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-8 font-semibold">
              {info.budget_line_code ? `${info.budget_line_code} — ${info.budget_line_name}` : "Operasional Kas Jemaat"}
            </span>
          </div>

          <div className="grid grid-cols-12 gap-1">
            <span className="col-span-3 font-bold text-gray-900">Untuk Pembayaran</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-8">{info.description || "-"}</span>
          </div>

          <div className="grid grid-cols-12 gap-1">
            <span className="col-span-3 font-bold text-gray-900">Metode / Sumber</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-8 font-semibold">
              {isTransfer ? "🏦 Bank / Transfer Non-Tunai" : "💵 Kas Fisik (Tunai / Kasir)"}
            </span>
          </div>
        </div>

        {/* Jika ada multi items rincian */}
        {multiItems.length > 1 && (
          <table className="w-full border-collapse border border-gray-400 my-2 text-[9.5px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 p-1 text-center w-8">No</th>
                <th className="border border-gray-400 p-1 text-left">Rincian Pos / Keterangan</th>
                <th className="border border-gray-400 p-1 text-right w-28">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {multiItems.map((it, idx) => (
                <tr key={idx}>
                  <td className="border border-gray-400 p-1 text-center">{idx + 1}</td>
                  <td className="border border-gray-400 p-1">{it.description}</td>
                  <td className="border border-gray-400 p-1 text-right font-mono font-semibold">
                    {rupiah(it.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Kotak Nominal & Terbilang */}
        <div className="border-2 border-black p-2 my-2 bg-gray-50 flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase font-bold text-gray-600 block">Jumlah Uang:</span>
            <span className="text-[14px] font-black font-mono tracking-tight text-black">
              {rupiah(info.amount)}
            </span>
          </div>
          <div className="text-right max-w-[65%]">
            <span className="text-[9px] uppercase font-bold text-gray-600 block">Terbilang:</span>
            <span className="text-[10px] font-bold italic text-black leading-tight block">
              "{terbilang(info.amount)}"
            </span>
          </div>
        </div>

        {/* Tanda Tangan */}
        <table className="w-full mt-3 text-center text-[10px] border-collapse">
          <tbody>
            <tr>
              <td className="w-1/3">
                <span>{isPenerimaan ? (settings.labelPenyetor || "Penyetor / Yang Menyerahkan") : (settings.labelPenerima || "Penerima Kas")},</span>
                <div className="h-10"></div>
                <span className="font-bold underline block">
                  ( {info.payee || "......................................."} )
                </span>
              </td>
              <td className="w-1/3">
                <span>Mengetahui,</span>
                <span className="block text-[9px] text-gray-600">{settings.jabatanKetuaBpmj || "Ketua BPMJ"}</span>
                <div className="h-8"></div>
                <span className="font-bold underline block">
                  ( {settings.namaKetuaBpmj || "......................................."} )
                </span>
              </td>
              <td className="w-1/3">
                <span>{settings.kotaSurat || "Manado"}, {tanggalPanjang(info.trx_date)}</span>
                <span className="block font-medium">{settings.jabatanBendahara || "Bendahara Jemaat"},</span>
                <div className="h-8"></div>
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
              <Button size="sm" variant="outline" onClick={handleDownloadPdf} className="gap-1.5 text-xs h-8">
                <Download className="size-3.5" /> PDF (F4)
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
            className="bg-white text-black p-4 mx-auto border shadow-sm max-w-[210mm] min-h-[297mm]"
            style={{ fontFamily: "Arial, sans-serif" }}
          >
            {/* RANGKAP 1 */}
            {renderSlip(1, "LEMBAR 1: UNTUK ARSIP GEREJA / KASIR")}

            {/* GARIS POTONG DENGAN GUNTING */}
            <div className="my-3 text-center border-t-2 border-dashed border-gray-400 relative pt-1.5 flex items-center justify-center gap-2 text-gray-600 text-[9.5px] font-bold">
              <Scissors className="size-3.5 text-gray-500" />
              <span>GUNTING / POTONG DI SINI (PEMISAH LEMBAR ARSIP & PENYETOR)</span>
              <Scissors className="size-3.5 text-gray-500 scale-x-[-1]" />
            </div>

            {/* RANGKAP 2 */}
            {renderSlip(2, isPenerimaan ? "LEMBAR 2: UNTUK PENYETOR (TANDA TERIMA SAH)" : "LEMBAR 2: UNTUK PENERIMA (TANDA TERIMA SAH)")}
          </div>
        </div>

        <div className="border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>💡 <strong>Tips Cetak:</strong> Pada menu print browser, pilih ukuran kertas <strong>F4 / Folio (8.5 x 13 in)</strong> dan Margin <strong>Default / Minimum</strong>.</span>
          <Button variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
