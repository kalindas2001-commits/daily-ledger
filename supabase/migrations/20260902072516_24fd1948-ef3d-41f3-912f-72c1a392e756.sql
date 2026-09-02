DROP FUNCTION IF EXISTS public.admin_list_tenant_transactions(uuid,date,date);

CREATE OR REPLACE FUNCTION public.admin_list_tenant_transactions(
  _user_id uuid DEFAULT NULL,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  transaction_date date,
  transaction_time time without time zone,
  type transaction_type,
  category varchar,
  subcategory text,
  description text,
  payment_method text,
  merchant_name text,
  unit_price numeric,
  quantity numeric,
  total_amount numeric,
  account_id uuid,
  notes text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tid uuid;
BEGIN
  v_tid := public.get_my_tenant();

  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    COALESCE(p.full_name, '')::text,
    COALESCE(p.email, '')::text,
    t.transaction_date,
    t.transaction_time,
    t.type,
    t.category,
    t.subcategory,
    t.description,
    COALESCE(t.payment_method, '')::text,
    t.merchant_name,
    t.unit_price,
    t.quantity,
    t.total_amount,
    t.account_id,
    t.notes,
    COALESCE(t.status, 'completed')::text,
    t.created_at
  FROM public.transactions t
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE (public.is_super_admin(auth.uid()) OR t.tenant_id = v_tid)
    AND (_user_id IS NULL OR t.user_id = _user_id)
    AND (_start_date IS NULL OR t.transaction_date >= _start_date)
    AND (_end_date IS NULL OR t.transaction_date <= _end_date)
  ORDER BY t.transaction_date DESC, t.transaction_time DESC, t.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_tenant_transactions(uuid,date,date) TO authenticated;
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;