ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS koreksi_dari text,
  ADD COLUMN IF NOT EXISTS koreksi_catatan text;

CREATE TABLE IF NOT EXISTS public.transaction_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  voucher_no text NOT NULL DEFAULT '',
  field text NOT NULL,
  old_value text NOT NULL DEFAULT '',
  new_value text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  corrected_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.transaction_corrections TO authenticated;
GRANT ALL ON public.transaction_corrections TO service_role;

ALTER TABLE public.transaction_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY corrections_select ON public.transaction_corrections
  FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));

CREATE POLICY corrections_insert ON public.transaction_corrections
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finance(auth.uid()) AND corrected_by = auth.uid());

CREATE INDEX IF NOT EXISTS transaction_corrections_trx_idx
  ON public.transaction_corrections(transaction_id);