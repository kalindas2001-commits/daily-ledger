
DROP FUNCTION IF EXISTS public.admin_global_stats();
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE,
  business_name text NOT NULL DEFAULT 'My Business',
  tin_number text,
  max_users integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_tenants_updated ON public.tenants;
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.quota_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  requested_max_users integer NOT NULL CHECK (requested_max_users > 0),
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quota_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor_user_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id, created_at DESC);

ALTER TABLE public.profiles               ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.transactions           ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.loans                  ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.daily_notes            ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.budgets                ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.categories             ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.daily_summaries        ADD COLUMN IF NOT EXISTS tenant_id uuid;

INSERT INTO public.tenants (id, owner_user_id, business_name, tin_number, max_users)
SELECT gen_random_uuid(), u.id,
       COALESCE(NULLIF(p.full_name, ''), split_part(u.email, '@', 1), 'My Business'),
       NULL, 5
FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id
ON CONFLICT (owner_user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role FROM auth.users u
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role FROM auth.users
WHERE email = 'munezzero@fintracker.local'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles p SET tenant_id = t.id FROM public.tenants t WHERE t.owner_user_id = p.user_id AND p.tenant_id IS NULL;
UPDATE public.transactions x SET tenant_id = t.id FROM public.tenants t WHERE t.owner_user_id = x.user_id AND x.tenant_id IS NULL;
UPDATE public.loans x SET tenant_id = t.id FROM public.tenants t WHERE t.owner_user_id = x.user_id AND x.tenant_id IS NULL;
UPDATE public.daily_notes x SET tenant_id = t.id FROM public.tenants t WHERE t.owner_user_id = x.user_id AND x.tenant_id IS NULL;
UPDATE public.budgets x SET tenant_id = t.id FROM public.tenants t WHERE t.owner_user_id = x.user_id AND x.tenant_id IS NULL;
UPDATE public.recurring_transactions x SET tenant_id = t.id FROM public.tenants t WHERE t.owner_user_id = x.user_id AND x.tenant_id IS NULL;
UPDATE public.categories x SET tenant_id = t.id FROM public.tenants t WHERE t.owner_user_id = x.user_id AND x.tenant_id IS NULL;
UPDATE public.daily_summaries x SET tenant_id = t.id FROM public.tenants t WHERE t.owner_user_id = x.user_id AND x.tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON public.transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loans_tenant ON public.loans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_notes_tenant ON public.daily_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_budgets_tenant ON public.budgets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recurring_tenant ON public.recurring_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON public.categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_summaries_tenant ON public.daily_summaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);

CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.get_my_tenant()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant_id uuid; v_name text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'My Business');
  INSERT INTO public.tenants (owner_user_id, business_name) VALUES (NEW.id, v_name)
  RETURNING id INTO v_tenant_id;
  INSERT INTO public.profiles (user_id, tenant_id, full_name, phone, email)
  VALUES (NEW.id, v_tenant_id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
          COALESCE(NEW.raw_user_meta_data->>'phone', ''),
          NEW.email)
  ON CONFLICT (user_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.set_tenant_id_from_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_tenant_transactions ON public.transactions;
CREATE TRIGGER trg_set_tenant_transactions BEFORE INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();
DROP TRIGGER IF EXISTS trg_set_tenant_loans ON public.loans;
CREATE TRIGGER trg_set_tenant_loans BEFORE INSERT ON public.loans FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();
DROP TRIGGER IF EXISTS trg_set_tenant_notes ON public.daily_notes;
CREATE TRIGGER trg_set_tenant_notes BEFORE INSERT ON public.daily_notes FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();
DROP TRIGGER IF EXISTS trg_set_tenant_budgets ON public.budgets;
CREATE TRIGGER trg_set_tenant_budgets BEFORE INSERT ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();
DROP TRIGGER IF EXISTS trg_set_tenant_recurring ON public.recurring_transactions;
CREATE TRIGGER trg_set_tenant_recurring BEFORE INSERT ON public.recurring_transactions FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();
DROP TRIGGER IF EXISTS trg_set_tenant_categories ON public.categories;
CREATE TRIGGER trg_set_tenant_categories BEFORE INSERT ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();
DROP TRIGGER IF EXISTS trg_set_tenant_summaries ON public.daily_summaries;
CREATE TRIGGER trg_set_tenant_summaries BEFORE INSERT ON public.daily_summaries FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();

DROP POLICY IF EXISTS "Tenant members view tenant" ON public.tenants;
CREATE POLICY "Tenant members view tenant" ON public.tenants FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR id = public.get_my_tenant());
DROP POLICY IF EXISTS "Tenant owner updates tenant" ON public.tenants;
CREATE POLICY "Tenant owner updates tenant" ON public.tenants FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR owner_user_id = auth.uid())
WITH CHECK (public.is_super_admin(auth.uid()) OR owner_user_id = auth.uid());
DROP POLICY IF EXISTS "Super admin inserts tenants" ON public.tenants;
CREATE POLICY "Super admin inserts tenants" ON public.tenants FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "View quota requests" ON public.quota_requests;
CREATE POLICY "View quota requests" ON public.quota_requests FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR tenant_id = public.get_my_tenant());
DROP POLICY IF EXISTS "Admin creates quota request" ON public.quota_requests;
CREATE POLICY "Admin creates quota request" ON public.quota_requests FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_my_tenant() AND requested_by = auth.uid() AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Super admin reviews quota requests" ON public.quota_requests;
CREATE POLICY "Super admin reviews quota requests" ON public.quota_requests FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "View audit logs" ON public.audit_logs;
CREATE POLICY "View audit logs" ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR tenant_id = public.get_my_tenant());
DROP POLICY IF EXISTS "Insert audit logs" ON public.audit_logs;
CREATE POLICY "Insert audit logs" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND actor_user_id = auth.uid());

DROP POLICY IF EXISTS "Super admin reads all transactions" ON public.transactions;
CREATE POLICY "Super admin reads all transactions" ON public.transactions FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Super admin reads all loans" ON public.loans;
CREATE POLICY "Super admin reads all loans" ON public.loans FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Super admin reads all notes" ON public.daily_notes;
CREATE POLICY "Super admin reads all notes" ON public.daily_notes FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Super admin reads all budgets" ON public.budgets;
CREATE POLICY "Super admin reads all budgets" ON public.budgets FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins view tenant profiles" ON public.profiles;
CREATE POLICY "Tenant admins view tenant profiles" ON public.profiles FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid())
       OR (tenant_id = public.get_my_tenant() AND public.has_role(auth.uid(), 'admin')));

CREATE OR REPLACE FUNCTION public.admin_global_stats()
RETURNS TABLE(total_users bigint, total_transactions bigint,
              total_income numeric, total_expense numeric,
              net_balance numeric, total_loans_pending numeric,
              total_tenants bigint, total_admins bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM auth.users)::BIGINT,
    (SELECT COUNT(*) FROM public.transactions)::BIGINT,
    COALESCE((SELECT SUM(total_amount) FROM public.transactions WHERE type='INCOME'), 0),
    COALESCE((SELECT SUM(total_amount) FROM public.transactions WHERE type='EXPENSE'), 0),
    COALESCE((SELECT SUM(CASE WHEN type='INCOME' THEN total_amount ELSE -total_amount END) FROM public.transactions), 0),
    COALESCE((SELECT SUM(amount) FROM public.loans WHERE status='PENDING'), 0),
    (SELECT COUNT(*) FROM public.tenants)::BIGINT,
    (SELECT COUNT(DISTINCT user_id) FROM public.user_roles WHERE role='admin')::BIGINT;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_tenants_overview()
RETURNS TABLE(tenant_id uuid, business_name text, tin_number text,
              owner_email text, owner_full_name text, owner_phone text,
              max_users integer, current_users bigint,
              total_income numeric, total_expense numeric, total_loans numeric,
              created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT t.id, t.business_name, COALESCE(t.tin_number,'')::text,
         u.email::text, COALESCE(p.full_name,'')::text, COALESCE(p.phone,'')::text,
         t.max_users,
         (SELECT COUNT(*) FROM public.profiles pp WHERE pp.tenant_id = t.id)::BIGINT,
         COALESCE((SELECT SUM(total_amount) FROM public.transactions tr WHERE tr.tenant_id = t.id AND tr.type='INCOME'), 0),
         COALESCE((SELECT SUM(total_amount) FROM public.transactions tr WHERE tr.tenant_id = t.id AND tr.type='EXPENSE'), 0),
         COALESCE((SELECT SUM(amount) FROM public.loans l WHERE l.tenant_id = t.id), 0),
         t.created_at
  FROM public.tenants t
  JOIN auth.users u ON u.id = t.owner_user_id
  LEFT JOIN public.profiles p ON p.user_id = t.owner_user_id
  ORDER BY t.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.my_tenant_info()
RETURNS TABLE(tenant_id uuid, business_name text, tin_number text,
              max_users integer, current_users bigint, pending_request boolean,
              is_owner boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tid uuid;
BEGIN
  v_tid := public.get_my_tenant();
  IF v_tid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT t.id, t.business_name, COALESCE(t.tin_number,''),
         t.max_users,
         (SELECT COUNT(*) FROM public.profiles pp WHERE pp.tenant_id = t.id)::BIGINT,
         EXISTS(SELECT 1 FROM public.quota_requests qr WHERE qr.tenant_id = t.id AND qr.status='pending'),
         (t.owner_user_id = auth.uid())
  FROM public.tenants t WHERE t.id = v_tid;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_quota_request(_request_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO r FROM public.quota_requests WHERE id = _request_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;
  IF _approve THEN
    UPDATE public.tenants SET max_users = r.requested_max_users WHERE id = r.tenant_id;
    UPDATE public.quota_requests SET status='approved', reviewed_by=auth.uid(), reviewed_at=now() WHERE id = _request_id;
  ELSE
    UPDATE public.quota_requests SET status='rejected', reviewed_by=auth.uid(), reviewed_at=now() WHERE id = _request_id;
  END IF;
  INSERT INTO public.audit_logs(tenant_id, actor_user_id, action, target_type, target_id, metadata)
  VALUES (r.tenant_id, auth.uid(), CASE WHEN _approve THEN 'quota.approved' ELSE 'quota.rejected' END,
          'quota_request', _request_id::text,
          jsonb_build_object('requested_max_users', r.requested_max_users));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_promote_user(_target uuid, _role app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _role NOT IN ('admin','super_admin','user') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_target, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.audit_logs(tenant_id, actor_user_id, action, target_type, target_id, metadata)
  VALUES ((SELECT tenant_id FROM public.profiles WHERE user_id = _target),
          auth.uid(), 'role.granted', 'user', _target::text,
          jsonb_build_object('role', _role::text));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_role(_target uuid, _role app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _target = auth.uid() AND _role = 'super_admin' THEN
    RAISE EXCEPTION 'Cannot revoke your own super_admin role';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _target AND role = _role;
  INSERT INTO public.audit_logs(tenant_id, actor_user_id, action, target_type, target_id, metadata)
  VALUES ((SELECT tenant_id FROM public.profiles WHERE user_id = _target),
          auth.uid(), 'role.revoked', 'user', _target::text,
          jsonb_build_object('role', _role::text));
END; $$;

CREATE OR REPLACE FUNCTION public.update_business_profile(_business_name text, _tin_number text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tid uuid;
BEGIN
  v_tid := public.get_my_tenant();
  IF v_tid IS NULL THEN RAISE EXCEPTION 'No tenant'; END IF;
  IF NOT (public.is_super_admin(auth.uid()) OR EXISTS(SELECT 1 FROM public.tenants WHERE id=v_tid AND owner_user_id=auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.tenants
  SET business_name = COALESCE(NULLIF(_business_name,''), business_name),
      tin_number = NULLIF(_tin_number,'')
  WHERE id = v_tid;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id uuid, email text, username text, full_name text, phone text,
              created_at timestamptz, last_sign_in_at timestamptz,
              is_admin boolean, is_disabled boolean, tx_count bigint,
              total_income numeric, total_expense numeric,
              tenant_id uuid, business_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_super boolean; v_tid uuid;
BEGIN
  v_super := public.is_super_admin(auth.uid());
  v_tid := public.get_my_tenant();
  IF NOT (v_super OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::TEXT,
         split_part(u.email, '@', 1)::TEXT,
         COALESCE(p.full_name,'')::TEXT,
         COALESCE(p.phone,'')::TEXT,
         u.created_at, u.last_sign_in_at,
         public.has_role(u.id, 'admin'),
         (u.banned_until IS NOT NULL AND u.banned_until > now()),
         COALESCE((SELECT COUNT(*) FROM public.transactions t WHERE t.user_id = u.id), 0),
         COALESCE((SELECT SUM(total_amount) FROM public.transactions t WHERE t.user_id = u.id AND t.type='INCOME'), 0),
         COALESCE((SELECT SUM(total_amount) FROM public.transactions t WHERE t.user_id = u.id AND t.type='EXPENSE'), 0),
         p.tenant_id,
         COALESCE(tn.business_name,'')::text
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.tenants tn ON tn.id = p.tenant_id
  WHERE v_super OR p.tenant_id = v_tid
  ORDER BY u.created_at DESC;
END; $$;

ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;
