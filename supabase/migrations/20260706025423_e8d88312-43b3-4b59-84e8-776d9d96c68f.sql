
-- Transaction edit-request workflow
CREATE TABLE public.transaction_edit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tenant_id uuid,
  requested_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_edit_requests TO authenticated;
GRANT ALL ON public.transaction_edit_requests TO service_role;

ALTER TABLE public.transaction_edit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own edit requests" ON public.transaction_edit_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own edit requests" ON public.transaction_edit_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view tenant edit requests" ON public.transaction_edit_requests
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.has_role(auth.uid(),'admin') AND tenant_id = public.get_my_tenant())
  );

CREATE POLICY "Admins update tenant edit requests" ON public.transaction_edit_requests
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.has_role(auth.uid(),'admin') AND tenant_id = public.get_my_tenant())
  );

-- auto-fill tenant_id
CREATE TRIGGER trg_edit_req_tenant
BEFORE INSERT ON public.transaction_edit_requests
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();

CREATE TRIGGER trg_edit_req_updated_at
BEFORE UPDATE ON public.transaction_edit_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_edit_requests;

-- Tighten transactions: users can no longer directly UPDATE their own transactions
DROP POLICY IF EXISTS "Users manage own transactions" ON public.transactions;

CREATE POLICY "Users select own transactions" ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own transactions" ON public.transactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- No direct UPDATE policy for users. Admins & super_admin can update.
CREATE POLICY "Admins update tenant transactions" ON public.transactions
  FOR UPDATE TO authenticated USING (
    public.is_super_admin(auth.uid())
    OR (public.has_role(auth.uid(),'admin') AND tenant_id = public.get_my_tenant())
  );

-- Function: apply an approved edit request
CREATE OR REPLACE FUNCTION public.apply_transaction_edit_request(_request_id uuid, _approve boolean, _admin_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  k text;
  v jsonb;
BEGIN
  SELECT * INTO r FROM public.transaction_edit_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Edit request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already reviewed'; END IF;

  IF NOT (public.is_super_admin(auth.uid())
          OR (public.has_role(auth.uid(),'admin') AND r.tenant_id = public.get_my_tenant())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _approve THEN
    -- Apply whitelisted fields
    FOR k, v IN SELECT key, value FROM jsonb_each(r.requested_changes)
    LOOP
      IF k = 'transaction_date' THEN
        UPDATE public.transactions SET transaction_date = (v#>>'{}'), updated_at = now() WHERE id = r.transaction_id;
      ELSIF k = 'category' THEN
        UPDATE public.transactions SET category = (v#>>'{}'), updated_at = now() WHERE id = r.transaction_id;
      ELSIF k = 'description' THEN
        UPDATE public.transactions SET description = (v#>>'{}'), updated_at = now() WHERE id = r.transaction_id;
      ELSIF k = 'notes' THEN
        UPDATE public.transactions SET notes = (v#>>'{}'), updated_at = now() WHERE id = r.transaction_id;
      ELSIF k = 'unit_price' THEN
        UPDATE public.transactions SET unit_price = (v#>>'{}')::numeric, updated_at = now() WHERE id = r.transaction_id;
      ELSIF k = 'quantity' THEN
        UPDATE public.transactions SET quantity = (v#>>'{}')::numeric, updated_at = now() WHERE id = r.transaction_id;
      ELSIF k = 'account_id' THEN
        UPDATE public.transactions SET account_id = NULLIF((v#>>'{}'),'')::uuid, updated_at = now() WHERE id = r.transaction_id;
      END IF;
    END LOOP;
    UPDATE public.transaction_edit_requests
      SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), admin_notes = _admin_notes, updated_at = now()
      WHERE id = _request_id;
    INSERT INTO public.alerts(user_id, tenant_id, title, message, severity, category)
    VALUES (r.user_id, r.tenant_id, 'Edit request approved', 'Your transaction changes have been applied.', 'success', 'transactions');
  ELSE
    UPDATE public.transaction_edit_requests
      SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), admin_notes = _admin_notes, updated_at = now()
      WHERE id = _request_id;
    INSERT INTO public.alerts(user_id, tenant_id, title, message, severity, category)
    VALUES (r.user_id, r.tenant_id, 'Edit request rejected', COALESCE(_admin_notes,'Your admin declined the changes.'), 'warning', 'transactions');
  END IF;
END $$;

-- RPC: admin lists tenant transactions (optionally per user)
CREATE OR REPLACE FUNCTION public.admin_list_tenant_transactions(_user_id uuid DEFAULT NULL, _start_date date DEFAULT NULL, _end_date date DEFAULT NULL)
RETURNS TABLE(
  id uuid, user_id uuid, full_name text, email text,
  transaction_date date, type transaction_type, category varchar,
  description text, unit_price numeric, quantity numeric, total_amount numeric,
  account_id uuid, notes text, status text, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tid uuid;
BEGIN
  v_tid := public.get_my_tenant();
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT t.id, t.user_id, COALESCE(p.full_name,'')::text, COALESCE(p.email,'')::text,
         t.transaction_date, t.type, t.category, t.description,
         t.unit_price, t.quantity, t.total_amount,
         t.account_id, t.notes, COALESCE(t.status,'completed')::text, t.created_at
  FROM public.transactions t
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE (public.is_super_admin(auth.uid()) OR t.tenant_id = v_tid)
    AND (_user_id IS NULL OR t.user_id = _user_id)
    AND (_start_date IS NULL OR t.transaction_date >= _start_date)
    AND (_end_date   IS NULL OR t.transaction_date <= _end_date)
  ORDER BY t.transaction_date DESC, t.created_at DESC
  LIMIT 500;
END $$;

-- RPC: admin lists edit requests for their tenant
CREATE OR REPLACE FUNCTION public.admin_list_edit_requests()
RETURNS TABLE(
  id uuid, transaction_id uuid, user_id uuid, full_name text,
  requested_changes jsonb, reason text, status text, admin_notes text,
  reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz,
  tx_snapshot jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tid uuid;
BEGIN
  v_tid := public.get_my_tenant();
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT er.id, er.transaction_id, er.user_id, COALESCE(p.full_name,'')::text,
         er.requested_changes, er.reason, er.status, er.admin_notes,
         er.reviewed_by, er.reviewed_at, er.created_at,
         jsonb_build_object(
           'transaction_date', t.transaction_date,
           'type', t.type,
           'category', t.category,
           'description', t.description,
           'unit_price', t.unit_price,
           'quantity', t.quantity,
           'total_amount', t.total_amount,
           'notes', t.notes
         ) AS tx_snapshot
  FROM public.transaction_edit_requests er
  LEFT JOIN public.transactions t ON t.id = er.transaction_id
  LEFT JOIN public.profiles p ON p.user_id = er.user_id
  WHERE public.is_super_admin(auth.uid()) OR er.tenant_id = v_tid
  ORDER BY (er.status = 'pending') DESC, er.created_at DESC
  LIMIT 200;
END $$;
