DROP FUNCTION IF EXISTS public.admin_list_tenant_transactions(uuid,date,date);

CREATE OR REPLACE FUNCTION public.admin_list_tenant_transactions(_user_id uuid DEFAULT NULL::uuid, _start_date date DEFAULT NULL::date, _end_date date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, user_id uuid, full_name text, email text, transaction_date date, transaction_time time without time zone, type transaction_type, category character varying, subcategory text, description text, payment_method text, merchant_name text, unit_price numeric, quantity numeric, total_amount numeric, account_id uuid, notes text, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_tid uuid;
BEGIN
  v_tid := public.get_my_tenant();
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT t.id, t.user_id, COALESCE(p.full_name,'')::text, COALESCE(p.email,'')::text,
         t.transaction_date, t.transaction_time, t.type, t.category, t.subcategory, t.description,
         COALESCE(t.payment_method,'')::text, t.merchant_name,
         t.unit_price, t.quantity, t.total_amount,
         t.account_id, t.notes, COALESCE(t.status,'completed')::text, t.created_at
  FROM public.transactions t
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE (public.is_super_admin(auth.uid()) OR t.tenant_id = v_tid)
    AND (_user_id IS NULL OR t.user_id = _user_id)
    AND (_start_date IS NULL OR t.transaction_date >= _start_date)
    AND (_end_date   IS NULL OR t.transaction_date <= _end_date)
  ORDER BY t.transaction_date DESC, t.created_at DESC;
END $function$;

CREATE POLICY "Admins read tenant transactions"
ON public.transactions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND tenant_id = public.get_my_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;