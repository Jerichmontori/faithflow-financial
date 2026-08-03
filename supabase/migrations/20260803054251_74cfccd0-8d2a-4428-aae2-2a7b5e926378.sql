ALTER TABLE public.budget_lines ADD COLUMN IF NOT EXISTS grup text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS budget_lines_grup_idx ON public.budget_lines (grup);