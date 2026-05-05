
-- ============ SAVINGS ============
CREATE TABLE IF NOT EXISTS public.savings_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  name TEXT NOT NULL DEFAULT 'My Savings',
  goal_amount NUMERIC(14,2) DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.savings_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own savings accounts" ON public.savings_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admin reads all savings" ON public.savings_accounts
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TYPE savings_action AS ENUM ('DEPOSIT', 'WITHDRAW');
CREATE TABLE IF NOT EXISTS public.savings_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.savings_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID,
  action savings_action NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  note TEXT,
  receipt_no TEXT NOT NULL DEFAULT ('RC-' || to_char(now(),'YYYYMMDD-HH24MISS') || '-' || substr(md5(random()::text),1,4)),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.savings_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own savings tx" ON public.savings_transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admin reads all savings tx" ON public.savings_transactions
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- Tenant trigger reuse
CREATE TRIGGER set_tenant_savings_acc BEFORE INSERT ON public.savings_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();
CREATE TRIGGER set_tenant_savings_tx BEFORE INSERT ON public.savings_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();

-- Keep savings balance in sync
CREATE OR REPLACE FUNCTION public.apply_savings_tx() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.savings_accounts
      SET current_balance = current_balance + CASE WHEN NEW.action='DEPOSIT' THEN NEW.amount ELSE -NEW.amount END,
          updated_at = now()
      WHERE id = NEW.account_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.savings_accounts
      SET current_balance = current_balance - CASE WHEN OLD.action='DEPOSIT' THEN OLD.amount ELSE -OLD.amount END,
          updated_at = now()
      WHERE id = OLD.account_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_apply_savings_tx
  AFTER INSERT OR DELETE ON public.savings_transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_savings_tx();

-- ============ LOAN TRANSACTIONS ============
CREATE TYPE loan_action AS ENUM ('ADD', 'FULL_REPAY', 'PARTIAL');
CREATE TABLE IF NOT EXISTS public.loan_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID,
  action loan_action NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  note TEXT,
  receipt_no TEXT NOT NULL DEFAULT ('LN-' || to_char(now(),'YYYYMMDD-HH24MISS') || '-' || substr(md5(random()::text),1,4)),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loan_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own loan tx" ON public.loan_transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admin reads all loan tx" ON public.loan_transactions
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE TRIGGER set_tenant_loan_tx BEFORE INSERT ON public.loan_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();

-- Add `original_amount` so we can keep history; loans.amount tracks remaining
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS original_amount NUMERIC(14,2);
UPDATE public.loans SET original_amount = amount WHERE original_amount IS NULL;

-- Apply loan transaction logic
CREATE OR REPLACE FUNCTION public.apply_loan_tx() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_loan RECORD;
BEGIN
  SELECT * INTO v_loan FROM public.loans WHERE id = NEW.loan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;

  IF NEW.action = 'ADD' THEN
    UPDATE public.loans
      SET amount = amount + NEW.amount,
          original_amount = COALESCE(original_amount,0) + NEW.amount,
          status = 'PENDING',
          paid_date = NULL,
          updated_at = now()
      WHERE id = NEW.loan_id;
  ELSIF NEW.action = 'FULL_REPAY' THEN
    UPDATE public.loans
      SET amount = 0, status = 'PAID', paid_date = CURRENT_DATE, updated_at = now()
      WHERE id = NEW.loan_id;
  ELSIF NEW.action = 'PARTIAL' THEN
    UPDATE public.loans
      SET amount = GREATEST(0, amount - NEW.amount),
          status = CASE WHEN amount - NEW.amount <= 0 THEN 'PAID' ELSE 'PENDING' END,
          paid_date = CASE WHEN amount - NEW.amount <= 0 THEN CURRENT_DATE ELSE NULL END,
          updated_at = now()
      WHERE id = NEW.loan_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_apply_loan_tx
  AFTER INSERT ON public.loan_transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_loan_tx();

-- ============ ALERTS ============
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  severity alert_severity NOT NULL DEFAULT 'info',
  category TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own alerts" ON public.alerts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users mark own alerts" ON public.alerts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own alerts" ON public.alerts
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert alerts" ON public.alerts
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Super admin reads all alerts" ON public.alerts
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE TRIGGER set_tenant_alerts BEFORE INSERT ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.savings_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_transactions;

-- ============ SUPER ADMIN RPCs ============
CREATE OR REPLACE FUNCTION public.admin_tenants_overview_paginated(_limit INT DEFAULT 20, _offset INT DEFAULT 0, _search TEXT DEFAULT NULL)
RETURNS TABLE(tenant_id uuid, business_name text, tin_number text, owner_email text, owner_full_name text,
              max_users int, current_users bigint, total_income numeric, total_expense numeric,
              total_savings numeric, total_loans_pending numeric, last_activity timestamptz,
              created_at timestamptz, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  WITH base AS (
    SELECT t.id, t.business_name, COALESCE(t.tin_number,'')::text AS tin_number,
           u.email::text AS owner_email, COALESCE(p.full_name,'')::text AS owner_full_name,
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
  ), counted AS (
    SELECT COUNT(*) AS c FROM base
  )
  SELECT b.*, (SELECT c FROM counted) AS total_count
  FROM base b
  ORDER BY b.created_at DESC
  LIMIT _limit OFFSET _offset;
END $$;

CREATE OR REPLACE FUNCTION public.tenant_drilldown(_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT jsonb_build_object(
    'tenant', (SELECT row_to_json(t) FROM public.tenants t WHERE t.id = _tenant_id),
    'users', (SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb)
              FROM (SELECT pp.user_id, pp.full_name, pp.email, pp.phone, pp.created_at
                    FROM public.profiles pp WHERE pp.tenant_id = _tenant_id) p),
    'totals', jsonb_build_object(
      'income', COALESCE((SELECT SUM(total_amount) FROM public.transactions WHERE tenant_id=_tenant_id AND type='INCOME'),0),
      'expense', COALESCE((SELECT SUM(total_amount) FROM public.transactions WHERE tenant_id=_tenant_id AND type='EXPENSE'),0),
      'savings', COALESCE((SELECT SUM(current_balance) FROM public.savings_accounts WHERE tenant_id=_tenant_id),0),
      'loans_pending', COALESCE((SELECT SUM(amount) FROM public.loans WHERE tenant_id=_tenant_id AND status='PENDING'),0),
      'tx_count', (SELECT COUNT(*) FROM public.transactions WHERE tenant_id=_tenant_id),
      'loan_count', (SELECT COUNT(*) FROM public.loans WHERE tenant_id=_tenant_id),
      'savings_count', (SELECT COUNT(*) FROM public.savings_accounts WHERE tenant_id=_tenant_id)
    ),
    'category_breakdown', (
      SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb)
      FROM (SELECT category, type, SUM(total_amount) as amount
            FROM public.transactions WHERE tenant_id=_tenant_id
            GROUP BY category, type ORDER BY amount DESC LIMIT 20) c
    ),
    'monthly_trend', (
      SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.month), '[]'::jsonb)
      FROM (SELECT to_char(transaction_date, 'YYYY-MM') as month,
                   SUM(CASE WHEN type='INCOME' THEN total_amount ELSE 0 END) as income,
                   SUM(CASE WHEN type='EXPENSE' THEN total_amount ELSE 0 END) as expense
            FROM public.transactions WHERE tenant_id=_tenant_id
              AND transaction_date >= (CURRENT_DATE - INTERVAL '12 months')
            GROUP BY 1 ORDER BY 1) m
    )
  ) INTO result;
  RETURN result;
END $$;
