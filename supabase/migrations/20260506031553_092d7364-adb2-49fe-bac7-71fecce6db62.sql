
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reset_code text,
  expires_at timestamptz,
  attempt_count int NOT NULL DEFAULT 0,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Only super admins can directly read/manage; inserts go through SECURITY DEFINER RPC
CREATE POLICY "super admin reads reset requests"
  ON public.password_reset_requests FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "super admin updates reset requests"
  ON public.password_reset_requests FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Public RPC: anyone (anon) can request a reset
CREATE OR REPLACE FUNCTION public.request_password_reset(_email text, _phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_req_id uuid;
  v_recent int;
BEGIN
  IF _email IS NULL OR _phone IS NULL OR length(trim(_email))=0 OR length(trim(_phone))=0 THEN
    RAISE EXCEPTION 'Email and phone are required';
  END IF;

  SELECT u.id INTO v_user_id
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE lower(u.email) = lower(trim(_email))
    AND regexp_replace(coalesce(p.phone,''), '\D', '', 'g')
        = regexp_replace(trim(_phone), '\D', '', 'g')
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No account matches that email and phone';
  END IF;

  -- Cooldown: max 3 pending/recent requests per hour
  SELECT count(*) INTO v_recent
  FROM public.password_reset_requests
  WHERE user_id = v_user_id AND created_at > now() - interval '1 hour';
  IF v_recent >= 3 THEN
    RAISE EXCEPTION 'Too many recent requests. Try again later.';
  END IF;

  INSERT INTO public.password_reset_requests(user_id, email, phone, status)
  VALUES (v_user_id, lower(trim(_email)), trim(_phone), 'pending')
  RETURNING id INTO v_req_id;

  RETURN v_req_id;
END $$;

GRANT EXECUTE ON FUNCTION public.request_password_reset(text, text) TO anon, authenticated;

-- Super admin: list reset requests
CREATE OR REPLACE FUNCTION public.super_admin_list_reset_requests()
RETURNS TABLE (
  id uuid, user_id uuid, email text, phone text, status text,
  reset_code text, expires_at timestamptz, attempt_count int,
  created_at timestamptz, reviewed_at timestamptz, full_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT r.id, r.user_id, r.email, r.phone, r.status, r.reset_code,
         r.expires_at, r.attempt_count, r.created_at, r.reviewed_at,
         COALESCE(p.full_name, '')::text
  FROM public.password_reset_requests r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.created_at > now() - interval '7 days'
  ORDER BY r.created_at DESC;
END $$;

-- Super admin: approve & generate code
CREATE OR REPLACE FUNCTION public.super_admin_approve_reset(_request_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_code text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  UPDATE public.password_reset_requests
  SET status='approved', reset_code=v_code,
      expires_at = now() + interval '15 minutes',
      approved_by = auth.uid(), reviewed_at = now(), attempt_count = 0
  WHERE id = _request_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;
  RETURN v_code;
END $$;

CREATE OR REPLACE FUNCTION public.super_admin_reject_reset(_request_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.password_reset_requests
  SET status='rejected', approved_by=auth.uid(), reviewed_at=now()
  WHERE id = _request_id AND status='pending';
END $$;

-- Verify code (used by edge function with service role; also callable by anon for client-side validation)
CREATE OR REPLACE FUNCTION public.verify_reset_code(_email text, _code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.password_reset_requests
  WHERE lower(email) = lower(trim(_email))
    AND status = 'approved'
    AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF r IS NULL THEN RAISE EXCEPTION 'No active reset request'; END IF;
  IF r.attempt_count >= 5 THEN
    UPDATE public.password_reset_requests SET status='rejected' WHERE id = r.id;
    RAISE EXCEPTION 'Too many attempts';
  END IF;

  IF upper(r.reset_code) <> upper(trim(_code)) THEN
    UPDATE public.password_reset_requests SET attempt_count = attempt_count + 1 WHERE id = r.id;
    RAISE EXCEPTION 'Invalid code';
  END IF;

  RETURN r.user_id;
END $$;

GRANT EXECUTE ON FUNCTION public.verify_reset_code(text, text) TO anon, authenticated;

-- Mark used (called by edge function after auth.admin.updateUserById succeeds)
CREATE OR REPLACE FUNCTION public.mark_reset_used(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.password_reset_requests
  SET status='used', reviewed_at = now()
  WHERE user_id = _user_id AND status='approved';
END $$;
