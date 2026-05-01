-- 1. App roles enum + user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Auto-assign 'user' role to every new signup
CREATE OR REPLACE FUNCTION public.assign_default_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_default_user_role();

-- 3. Backfill existing user(s)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  username TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  is_admin BOOLEAN,
  is_disabled BOOLEAN,
  tx_count BIGINT,
  total_income NUMERIC,
  total_expense NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    split_part(u.email, '@', 1)::TEXT AS username,
    u.created_at,
    u.last_sign_in_at,
    public.has_role(u.id, 'admin') AS is_admin,
    (u.banned_until IS NOT NULL AND u.banned_until > now()) AS is_disabled,
    COALESCE((SELECT COUNT(*) FROM public.transactions t WHERE t.user_id = u.id), 0) AS tx_count,
    COALESCE((SELECT SUM(total_amount) FROM public.transactions t WHERE t.user_id = u.id AND t.type = 'INCOME'), 0) AS total_income,
    COALESCE((SELECT SUM(total_amount) FROM public.transactions t WHERE t.user_id = u.id AND t.type = 'EXPENSE'), 0) AS total_expense
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_disabled(_target_user UUID, _disabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _target_user = auth.uid() THEN
    RAISE EXCEPTION 'Cannot disable yourself';
  END IF;

  IF _disabled THEN
    UPDATE auth.users SET banned_until = 'infinity'::TIMESTAMPTZ WHERE id = _target_user;
  ELSE
    UPDATE auth.users SET banned_until = NULL WHERE id = _target_user;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_global_stats()
RETURNS TABLE (
  total_users BIGINT,
  total_transactions BIGINT,
  total_income NUMERIC,
  total_expense NUMERIC,
  net_balance NUMERIC,
  total_loans_pending NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM auth.users)::BIGINT,
    (SELECT COUNT(*) FROM public.transactions)::BIGINT,
    COALESCE((SELECT SUM(total_amount) FROM public.transactions WHERE type='INCOME'), 0),
    COALESCE((SELECT SUM(total_amount) FROM public.transactions WHERE type='EXPENSE'), 0),
    COALESCE((SELECT SUM(CASE WHEN type='INCOME' THEN total_amount ELSE -total_amount END) FROM public.transactions), 0),
    COALESCE((SELECT SUM(amount) FROM public.loans WHERE status='PENDING'), 0);
END;
$$;

-- 5. Create the admin user 'munezzero' and grant admin role
DO $$
DECLARE
  new_uid UUID;
  hashed TEXT;
BEGIN
  SELECT id INTO new_uid FROM auth.users WHERE email = 'munezzero@fintracker.local';
  IF new_uid IS NULL THEN
    new_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_uid, 'authenticated', 'authenticated',
      'munezzero@fintracker.local',
      crypt('Iamme777@Kigali', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), new_uid,
      jsonb_build_object('sub', new_uid::text, 'email', 'munezzero@fintracker.local', 'email_verified', true),
      'email', new_uid::text, now(), now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('Iamme777@Kigali', gen_salt('bf')), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = new_uid;
  END IF;

  -- grant admin role
  INSERT INTO public.user_roles (user_id, role) VALUES (new_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  -- also ensure user role
  INSERT INTO public.user_roles (user_id, role) VALUES (new_uid, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;