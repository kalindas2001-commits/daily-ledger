-- 1) Fix loan_status enum cast bug in apply_loan_tx trigger
CREATE OR REPLACE FUNCTION public.apply_loan_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_loan RECORD;
BEGIN
  SELECT * INTO v_loan FROM public.loans WHERE id = NEW.loan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;

  IF NEW.action = 'ADD' THEN
    UPDATE public.loans
      SET amount = amount + NEW.amount,
          original_amount = COALESCE(original_amount, 0) + NEW.amount,
          status = 'PENDING'::loan_status,
          paid_date = NULL,
          updated_at = now()
      WHERE id = NEW.loan_id;
  ELSIF NEW.action = 'FULL_REPAY' THEN
    UPDATE public.loans
      SET amount = 0,
          status = 'PAID'::loan_status,
          paid_date = CURRENT_DATE,
          updated_at = now()
      WHERE id = NEW.loan_id;
  ELSIF NEW.action = 'PARTIAL' THEN
    UPDATE public.loans
      SET amount = GREATEST(0, amount - NEW.amount),
          status = (CASE WHEN amount - NEW.amount <= 0 THEN 'PAID' ELSE 'PENDING' END)::loan_status,
          paid_date = CASE WHEN amount - NEW.amount <= 0 THEN CURRENT_DATE ELSE NULL END,
          updated_at = now()
      WHERE id = NEW.loan_id;
  END IF;
  RETURN NEW;
END $$;

-- 2) Enrich super-admin action logger with request metadata
CREATE OR REPLACE FUNCTION public.super_admin_log_action(
  _action text,
  _target_type text DEFAULT NULL,
  _target_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid; v_meta jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  v_meta := COALESCE(_metadata, '{}'::jsonb);
  IF NOT (v_meta ? 'request_id') THEN
    v_meta := v_meta || jsonb_build_object('request_id', gen_random_uuid()::text);
  END IF;
  v_meta := v_meta || jsonb_build_object('logged_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  INSERT INTO public.audit_logs(tenant_id, actor_user_id, action, target_type, target_id, metadata)
  VALUES (NULL, auth.uid(), _action, _target_type, _target_id, v_meta)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 3) Add owner_phone to paginated tenants overview
DROP FUNCTION IF EXISTS public.admin_tenants_overview_paginated(integer, integer, text);
CREATE OR REPLACE FUNCTION public.admin_tenants_overview_paginated(
  _limit integer DEFAULT 20,
  _offset integer DEFAULT 0,
  _search text DEFAULT NULL::text
)
RETURNS TABLE(
  tenant_id uuid, business_name text, tin_number text,
  owner_email text, owner_full_name text, owner_phone text,
  max_users integer, current_users bigint,
  total_income numeric, total_expense numeric, total_savings numeric, total_loans_pending numeric,
  last_activity timestamp with time zone, created_at timestamp with time zone, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  WITH base AS (
    SELECT t.id, t.business_name, COALESCE(t.tin_number,'')::text AS tin_number,
           u.email::text AS owner_email,
           COALESCE(p.full_name,'')::text AS owner_full_name,
           COALESCE(p.phone,'')::text AS owner_phone,
           t.max_users,
           (SELECT COUNT(*) FROM public.profiles pp WHERE pp.tenant_id = t.id)::BIGINT AS current_users,
           COALESCE((SELECT SUM(total_amount) FROM public.transactions tr WHERE tr.tenant_id = t.id AND tr.type='INCOME'), 0) AS total_income,
           COALESCE((SELECT SUM(total_amount) FROM public.transactions tr WHERE tr.tenant_id = t.id AND tr.type='EXPENSE'), 0) AS total_expense,
           COALESCE((SELECT SUM(current_balance) FROM public.savings_accounts sa WHERE sa.tenant_id = t.id), 0) AS total_savings,
           COALESCE((SELECT SUM(amount) FROM public.loans l WHERE l.tenant_id = t.id AND l.status='PENDING'), 0) AS total_loans_pending,
           (SELECT MAX(created_at) FROM public.transactions tr WHERE tr.tenant_id = t.id) AS last_activity,
           t.created_at
    FROM public.tenants t
    JOIN auth.users u ON u.id = t.owner_user_id
    LEFT JOIN public.profiles p ON p.user_id = t.owner_user_id
    WHERE _search IS NULL OR _search = '' OR
          t.business_name ILIKE '%'||_search||'%' OR u.email ILIKE '%'||_search||'%'
            OR COALESCE(p.phone,'') ILIKE '%'||_search||'%' OR COALESCE(p.full_name,'') ILIKE '%'||_search||'%'
  ), counted AS (SELECT COUNT(*) AS c FROM base)
  SELECT b.*, (SELECT c FROM counted) AS total_count
  FROM base b
  ORDER BY b.created_at DESC
  LIMIT _limit OFFSET _offset;
END $$;