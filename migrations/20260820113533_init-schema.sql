-- Types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('super_admin','ketua_bpmj','admin_keuangan','sekretaris','pendeta','auditor','viewer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trx_kind') THEN
    CREATE TYPE public.trx_kind AS ENUM ('penerimaan','pengeluaran');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE public.approval_status AS ENUM ('draft','pending','approved','rejected');
  END IF;
END $$;

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_finance(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','admin_keuangan'));
$$;

CREATE OR REPLACE FUNCTION public.can_approve(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','ketua_bpmj'));
$$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND approval_status = 'approved');
$$;

-- BUDGET LINES
CREATE TABLE IF NOT EXISTS public.budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind public.trx_kind NOT NULL,
  grup TEXT NOT NULL DEFAULT '',
  fiscal_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  planned_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT budget_lines_code_kind_year_key UNIQUE (code, kind, fiscal_year)
);

CREATE INDEX IF NOT EXISTS budget_lines_grup_idx ON public.budget_lines (grup);

-- TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trx_date DATE NOT NULL DEFAULT CURRENT_DATE,
  voucher_no TEXT NOT NULL UNIQUE,
  kind public.trx_kind NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  budget_line_id UUID NOT NULL REFERENCES public.budget_lines(id),
  amount NUMERIC(16,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  payee TEXT,
  payment_method TEXT,
  attachment_url TEXT,
  status public.approval_status NOT NULL DEFAULT 'approved',
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  koreksi_dari TEXT,
  koreksi_catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TRANSACTION CORRECTIONS
CREATE TABLE IF NOT EXISTS public.transaction_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  voucher_no TEXT NOT NULL DEFAULT '',
  field TEXT NOT NULL,
  old_value TEXT NOT NULL DEFAULT '',
  new_value TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  corrected_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transaction_corrections_trx_idx ON public.transaction_corrections(transaction_id);

-- AUTO VOUCHER NUMBER
CREATE OR REPLACE FUNCTION public.set_voucher_no()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prefix TEXT;
  yr TEXT;
  seq INT;
BEGIN
  IF NEW.voucher_no IS NOT NULL AND NEW.voucher_no <> '' THEN RETURN NEW; END IF;
  prefix := CASE WHEN NEW.kind = 'penerimaan' THEN 'KM' ELSE 'KK' END;
  yr := to_char(COALESCE(NEW.trx_date, CURRENT_DATE), 'YYYY');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(voucher_no, '^.*-', ''), '')::INT), 0) + 1
    INTO seq FROM public.transactions
    WHERE voucher_no LIKE prefix || '-' || yr || '-%';
  NEW.voucher_no := prefix || '-' || yr || '-' || lpad(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_voucher_no ON public.transactions;
CREATE TRIGGER trg_voucher_no BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_voucher_no();

-- NEW USER HANDLER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  SELECT count(*) INTO user_count FROM public.user_roles;

  INSERT INTO public.profiles (id, full_name, email, approval_status, approved_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email,''),
    CASE WHEN user_count = 0 THEN 'approved' ELSE 'pending' END,
    CASE WHEN user_count = 0 THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN user_count = 0 THEN 'super_admin'::public.app_role ELSE 'viewer'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- GRANTS
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT ON public.transaction_corrections TO authenticated;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_corrections ENABLE ROW LEVEL SECURITY;

-- POLICIES
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.can_approve(auth.uid()));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated USING (public.can_approve(auth.uid())) WITH CHECK (public.can_approve(auth.uid()));

DROP POLICY IF EXISTS "roles_select_own_or_admin" ON public.user_roles;
CREATE POLICY "roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.can_approve(auth.uid()));

DROP POLICY IF EXISTS "roles_insert_admin" ON public.user_roles;
CREATE POLICY "roles_insert_admin" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "roles_update_admin" ON public.user_roles;
CREATE POLICY "roles_update_admin" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "roles_delete_admin" ON public.user_roles;
CREATE POLICY "roles_delete_admin" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) AND user_id <> auth.uid());

DROP POLICY IF EXISTS "budget_select" ON public.budget_lines;
CREATE POLICY "budget_select" ON public.budget_lines FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "budget_insert" ON public.budget_lines;
CREATE POLICY "budget_insert" ON public.budget_lines FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));

DROP POLICY IF EXISTS "budget_update" ON public.budget_lines;
CREATE POLICY "budget_update" ON public.budget_lines FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));

DROP POLICY IF EXISTS "budget_delete" ON public.budget_lines;
CREATE POLICY "budget_delete" ON public.budget_lines FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "trx_select" ON public.transactions;
CREATE POLICY "trx_select" ON public.transactions FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "trx_insert" ON public.transactions;
CREATE POLICY "trx_insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "trx_update" ON public.transactions;
CREATE POLICY "trx_update" ON public.transactions FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid()) OR public.can_approve(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()) OR public.can_approve(auth.uid()));

DROP POLICY IF EXISTS "trx_delete" ON public.transactions;
CREATE POLICY "trx_delete" ON public.transactions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "corrections_select" ON public.transaction_corrections;
CREATE POLICY "corrections_select" ON public.transaction_corrections FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "corrections_insert" ON public.transaction_corrections;
CREATE POLICY "corrections_insert" ON public.transaction_corrections FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()) AND corrected_by = auth.uid());

-- PERMISSIONS
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.can_approve(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.can_manage_finance(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_voucher_no() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_approve(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_finance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;

-- SEED MATA ANGGARAN
INSERT INTO public.budget_lines (code, name, kind, fiscal_year, planned_amount) VALUES
 ('4.1.01','Persembahan Ibadah Minggu','penerimaan', EXTRACT(YEAR FROM now())::int, 480000000),
 ('4.1.02','Persembahan Syukur','penerimaan', EXTRACT(YEAR FROM now())::int, 120000000),
 ('4.1.03','Perpuluhan','penerimaan', EXTRACT(YEAR FROM now())::int, 240000000),
 ('4.2.01','Persembahan Khusus / Pembangunan','penerimaan', EXTRACT(YEAR FROM now())::int, 300000000),
 ('4.3.01','Sumbangan & Donasi','penerimaan', EXTRACT(YEAR FROM now())::int, 60000000),
 ('5.1.01','Tunjangan Pendeta & Pelayan','pengeluaran', EXTRACT(YEAR FROM now())::int, 360000000),
 ('5.1.02','Operasional Kantor Jemaat','pengeluaran', EXTRACT(YEAR FROM now())::int, 72000000),
 ('5.2.01','Pemeliharaan Gedung Gereja','pengeluaran', EXTRACT(YEAR FROM now())::int, 150000000),
 ('5.2.02','Listrik, Air & Internet','pengeluaran', EXTRACT(YEAR FROM now())::int, 48000000),
 ('5.3.01','Kegiatan Ibadah & UPK','pengeluaran', EXTRACT(YEAR FROM now())::int, 96000000),
 ('5.4.01','Diakonia & Pelayanan Sosial','pengeluaran', EXTRACT(YEAR FROM now())::int, 84000000)
ON CONFLICT (code, kind, fiscal_year) DO NOTHING;

-- SEED TRANSAKSI
INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE, 'penerimaan', 'Persembahan Ibadah Minggu', b.id, 12750000, 'Persembahan ibadah Minggu I', NULL, 'Tunai', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '4.1.01'
ON CONFLICT DO NOTHING;

INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE, 'penerimaan', 'Perpuluhan', b.id, 8400000, 'Perpuluhan jemaat', NULL, 'Transfer Bank', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '4.1.03'
ON CONFLICT DO NOTHING;

INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE - 5, 'penerimaan', 'Persembahan Syukur', b.id, 5250000, 'Persembahan syukur ulang tahun jemaat', NULL, 'Tunai', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '4.1.02'
ON CONFLICT DO NOTHING;

INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE - 12, 'penerimaan', 'Persembahan Pembangunan', b.id, 21000000, 'Dana pembangunan tahap II', NULL, 'Transfer Bank', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '4.2.01'
ON CONFLICT DO NOTHING;

INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE, 'pengeluaran', 'Operasional', b.id, 2350000, 'Pembelian ATK dan cetak warta jemaat', 'Toko Sinar Jaya', 'Tunai', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '5.1.02'
ON CONFLICT DO NOTHING;

INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE - 2, 'pengeluaran', 'Utilitas', b.id, 4150000, 'Tagihan listrik dan internet bulan berjalan', 'PLN & Provider', 'Transfer Bank', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '5.2.02'
ON CONFLICT DO NOTHING;

INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE - 1, 'pengeluaran', 'Pemeliharaan', b.id, 18500000, 'Perbaikan atap dan pengecatan gedung', 'CV Karya Mandiri', 'Transfer Bank', 'pending', NULL, ''
FROM public.budget_lines b WHERE b.code = '5.2.01'
ON CONFLICT DO NOTHING;

INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE, 'pengeluaran', 'Diakonia', b.id, 3000000, 'Bantuan diakonia keluarga jemaat', 'Panitia Diakonia', 'Tunai', 'pending', NULL, ''
FROM public.budget_lines b WHERE b.code = '5.4.01'
ON CONFLICT DO NOTHING;

INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE - 20, 'pengeluaran', 'Tunjangan', b.id, 30000000, 'Tunjangan pendeta dan pelayan bulan lalu', 'Bendahara Jemaat', 'Transfer Bank', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '5.1.01'
ON CONFLICT DO NOTHING;
