CREATE OR REPLACE FUNCTION public.admin_filtered_transactions(
  _start_date DATE DEFAULT NULL,
  _end_date DATE DEFAULT NULL,
  _type TEXT DEFAULT NULL,
  _category TEXT DEFAULT NULL
)
RETURNS TABLE (
  transaction_date DATE,
  type transaction_type,
  category VARCHAR,
  total_amount NUMERIC,
  user_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT t.transaction_date, t.type, t.category, t.total_amount, t.user_id
  FROM public.transactions t
  WHERE (_start_date IS NULL OR t.transaction_date >= _start_date)
    AND (_end_date   IS NULL OR t.transaction_date <= _end_date)
    AND (_type IS NULL OR _type = '' OR t.type::text = _type)
    AND (_category IS NULL OR _category = '' OR t.category = _category);
END;
$$;