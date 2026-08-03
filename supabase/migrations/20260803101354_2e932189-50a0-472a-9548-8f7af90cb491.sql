-- Helper: approved user check
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND approval_status = 'approved');
$$;

-- profiles: own row or approvers
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_own_or_admin ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id OR public.can_approve(auth.uid()));

-- user_roles: own rows or approvers
DROP POLICY IF EXISTS roles_select_authenticated ON public.user_roles;
CREATE POLICY roles_select_own_or_admin ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_approve(auth.uid()));

-- budget_lines: approved users only
DROP POLICY IF EXISTS budget_select ON public.budget_lines;
CREATE POLICY budget_select ON public.budget_lines
FOR SELECT TO authenticated
USING (public.is_approved(auth.uid()));

-- transactions: approved users only
DROP POLICY IF EXISTS trx_select ON public.transactions;
CREATE POLICY trx_select ON public.transactions
FOR SELECT TO authenticated
USING (public.is_approved(auth.uid()));

-- Lock down SECURITY DEFINER functions
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