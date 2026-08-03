-- ENUMS
CREATE TYPE public.app_role AS ENUM ('super_admin','ketua_bpmj','admin_keuangan','sekretaris','pendeta','auditor','viewer');
CREATE TYPE public.trx_kind AS ENUM ('penerimaan','pengeluaran');
CREATE TYPE public.approval_status AS ENUM ('draft','pending','approved','rejected');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

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

-- PROFILES POLICIES
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- USER ROLES POLICIES
CREATE POLICY "roles_select_authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- BUDGET LINES (MATA ANGGARAN)
CREATE TABLE public.budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind public.trx_kind NOT NULL,
  fiscal_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  planned_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code, fiscal_year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_lines TO authenticated;
GRANT ALL ON public.budget_lines TO service_role;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budget_select" ON public.budget_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "budget_insert" ON public.budget_lines FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "budget_update" ON public.budget_lines FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "budget_delete" ON public.budget_lines FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

-- TRANSACTIONS
CREATE TABLE public.transactions (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trx_select" ON public.transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "trx_insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "trx_update" ON public.transactions FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid()) OR public.can_approve(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()) OR public.can_approve(auth.uid()));
CREATE POLICY "trx_delete" ON public.transactions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

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
CREATE TRIGGER trg_voucher_no BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_voucher_no();

-- NEW USER HANDLER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), COALESCE(NEW.email,''))
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO user_count FROM public.user_roles;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN user_count = 0 THEN 'super_admin'::public.app_role ELSE 'viewer'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
 ('5.4.01','Diakonia & Pelayanan Sosial','pengeluaran', EXTRACT(YEAR FROM now())::int, 84000000);

-- SEED TRANSAKSI
INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE, 'penerimaan', 'Persembahan Ibadah Minggu', b.id, 12750000, 'Persembahan ibadah Minggu I', NULL, 'Tunai', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '4.1.01';
INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE, 'penerimaan', 'Perpuluhan', b.id, 8400000, 'Perpuluhan jemaat', NULL, 'Transfer Bank', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '4.1.03';
INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE - 5, 'penerimaan', 'Persembahan Syukur', b.id, 5250000, 'Persembahan syukur ulang tahun jemaat', NULL, 'Tunai', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '4.1.02';
INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE - 12, 'penerimaan', 'Persembahan Pembangunan', b.id, 21000000, 'Dana pembangunan tahap II', NULL, 'Transfer Bank', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '4.2.01';
INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE, 'pengeluaran', 'Operasional', b.id, 2350000, 'Pembelian ATK dan cetak warta jemaat', 'Toko Sinar Jaya', 'Tunai', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '5.1.02';
INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE - 2, 'pengeluaran', 'Utilitas', b.id, 4150000, 'Tagihan listrik dan internet bulan berjalan', 'PLN & Provider', 'Transfer Bank', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '5.2.02';
INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE - 1, 'pengeluaran', 'Pemeliharaan', b.id, 18500000, 'Perbaikan atap dan pengecatan gedung', 'CV Karya Mandiri', 'Transfer Bank', 'pending', NULL, ''
FROM public.budget_lines b WHERE b.code = '5.2.01';
INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE, 'pengeluaran', 'Diakonia', b.id, 3000000, 'Bantuan diakonia keluarga jemaat', 'Panitia Diakonia', 'Tunai', 'pending', NULL, ''
FROM public.budget_lines b WHERE b.code = '5.4.01';
INSERT INTO public.transactions (trx_date, kind, category, budget_line_id, amount, description, payee, payment_method, status, approved_at, voucher_no)
SELECT CURRENT_DATE - 20, 'pengeluaran', 'Tunjangan', b.id, 30000000, 'Tunjangan pendeta dan pelayan bulan lalu', 'Bendahara Jemaat', 'Transfer Bank', 'approved', now(), ''
FROM public.budget_lines b WHERE b.code = '5.1.01';