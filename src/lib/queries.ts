import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BudgetLine = {
  id: string;
  code: string;
  name: string;
  kind: "penerimaan" | "pengeluaran";
  fiscal_year: number;
  planned_amount: number;
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
  budget_lines?: { code: string; name: string } | null;
};

/** Kode mutasi kas internal (setoran/tarikan bank) — bukan pendapatan/belanja riil */
export const INTERNAL_CASH_CODES = ["1.1.11.11", "2.2.22.22"];

export const isInternalCash = (t: Transaction) =>
  INTERNAL_CASH_CODES.includes(t.budget_lines?.code ?? "");

export const budgetLinesQuery = queryOptions({
  queryKey: ["budget_lines"],
  queryFn: async (): Promise<BudgetLine[]> => {
    const { data, error } = await supabase
      .from("budget_lines")
      .select("id, code, name, kind, fiscal_year, planned_amount")
      .order("code");
    if (error) throw error;
    return (data ?? []) as BudgetLine[];
  },
});

export const transactionsQuery = queryOptions({
  queryKey: ["transactions"],
  queryFn: async (): Promise<Transaction[]> => {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id, trx_date, voucher_no, kind, category, budget_line_id, amount, description, payee, payment_method, attachment_url, status, created_at, budget_lines(code, name)",
      )
      .order("trx_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(0, 49999);
    if (error) throw error;
    return (data ?? []) as unknown as Transaction[];
  },
});