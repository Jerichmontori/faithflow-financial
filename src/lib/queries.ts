import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BudgetLine = {
  id: string;
  code: string;
  name: string;
  kind: "penerimaan" | "pengeluaran";
  fiscal_year: number;
  planned_amount: number;
  grup: string;
};

export type Transaction = {
  id: string;
  trx_date: string;
  voucher_no: string;
  kind: "penerimaan" | "pengeluaran";
  category: string;
  budget_line_id: string;
  amount: number;
  description: string;
  payee: string | null;
  payment_method: string | null;
  attachment_url: string | null;
  status: "draft" | "pending" | "approved" | "rejected";
  created_at: string;
  koreksi_dari: string | null;
  koreksi_catatan: string | null;
  budget_lines?: { code: string; name: string } | null;
};

/** Kode mutasi kas internal (setoran/tarikan bank) — bukan pendapatan/belanja riil */
export const INTERNAL_CASH_CODES = ["1.1.11.11", "2.2.22.22"];

export const isInternalCash = (t: Transaction) =>
  INTERNAL_CASH_CODES.includes(t.budget_lines?.code ?? "");

/** Transaksi reklas / pengembalian — bukan mutasi bank riil */
export const REKLAS_VOUCHERS = [
  "KM-2026-0184",
  "KM-2026-2575",
  "KM-2026-2576",
  "KM-2026-2577",
];

export const isReklas = (t: Transaction) =>
  Boolean(t.category?.toLowerCase().startsWith("reklas")) ||
  Boolean(t.category?.toLowerCase() === "pengembalian") ||
  Boolean(t.koreksi_dari?.toLowerCase().includes("reklas")) ||
  REKLAS_VOUCHERS.includes(t.voucher_no);

export const budgetLinesQuery = queryOptions({
  queryKey: ["budget_lines"],
  queryFn: async (): Promise<BudgetLine[]> => {
    const { data, error } = await supabase
      .from("budget_lines")
      .select("id, code, name, kind, fiscal_year, planned_amount, grup")
      .order("code");
    if (error) throw error;
    return (data ?? []) as unknown as BudgetLine[];
  },
});

export const transactionsQuery = queryOptions({
  queryKey: ["transactions"],
  queryFn: async (): Promise<Transaction[]> => {
    const PAGE = 1000;
    const all: Transaction[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, trx_date, voucher_no, kind, category, budget_line_id, amount, description, payee, payment_method, attachment_url, status, created_at, koreksi_dari, koreksi_catatan, budget_lines(code, name)",
        )
        .order("trx_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const page = (data ?? []) as unknown as Transaction[];
      all.push(...page);
      if (page.length < PAGE) break;
    }
    return all;
  },
});