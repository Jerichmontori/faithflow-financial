CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_read_policy" ON public.app_settings;
CREATE POLICY "app_settings_read_policy" ON public.app_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "app_settings_write_policy" ON public.app_settings;
CREATE POLICY "app_settings_write_policy" ON public.app_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin_keuangan')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin_keuangan')
    )
  );

GRANT ALL ON public.app_settings TO anon, authenticated, service_role;
