
-- 1. Invites table
CREATE TABLE IF NOT EXISTS public.tenant_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  max_uses integer NOT NULL DEFAULT 1,
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_invites TO authenticated;
GRANT ALL ON public.tenant_invites TO service_role;
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins view invites" ON public.tenant_invites FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.get_my_tenant() AND public.has_role(auth.uid(), 'admin')));

CREATE INDEX IF NOT EXISTS idx_invites_tenant ON public.tenant_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invites_code ON public.tenant_invites(code);

-- 2. Create invite (admin only, own tenant)
CREATE OR REPLACE FUNCTION public.admin_create_invite(_max_uses integer DEFAULT 1, _expires_hours integer DEFAULT 168, _note text DEFAULT NULL)
RETURNS TABLE(id uuid, code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tid uuid; v_code text; v_id uuid;
BEGIN
  v_tid := public.get_my_tenant();
  IF v_tid IS NULL THEN RAISE EXCEPTION 'No tenant'; END IF;
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _max_uses IS NULL OR _max_uses < 1 OR _max_uses > 100 THEN
    RAISE EXCEPTION 'max_uses must be between 1 and 100';
  END IF;

  -- generate unique 8-char code
  LOOP
    v_code := upper(substr(replace(encode(gen_random_bytes(6), 'base64'), '/', ''), 1, 8));
    v_code := regexp_replace(v_code, '[^A-Z0-9]', 'X', 'g');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tenant_invites WHERE code = v_code);
  END LOOP;

  INSERT INTO public.tenant_invites(tenant_id, code, created_by, max_uses, expires_at, note)
  VALUES (v_tid, v_code, auth.uid(), _max_uses,
          CASE WHEN _expires_hours IS NULL OR _expires_hours <= 0 THEN NULL
               ELSE now() + (_expires_hours || ' hours')::interval END,
          NULLIF(_note,''))
  RETURNING tenant_invites.id INTO v_id;

  RETURN QUERY SELECT v_id, v_code;
END $$;

-- 3. Revoke invite
CREATE OR REPLACE FUNCTION public.admin_revoke_invite(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tid uuid;
BEGIN
  v_tid := public.get_my_tenant();
  IF NOT (public.is_super_admin(auth.uid()) OR
         (public.has_role(auth.uid(), 'admin') AND EXISTS(SELECT 1 FROM public.tenant_invites WHERE id=_id AND tenant_id=v_tid))) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.tenant_invites SET revoked = true WHERE id = _id;
END $$;

-- 4. Peek invite (public lookup, returns business name only)
CREATE OR REPLACE FUNCTION public.peek_invite(_code text)
RETURNS TABLE(business_name text, valid boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_count bigint; v_max int;
BEGIN
  SELECT i.*, t.business_name AS bname, t.max_users AS mu
    INTO r FROM public.tenant_invites i
    JOIN public.tenants t ON t.id = i.tenant_id
    WHERE upper(i.code) = upper(trim(_code)) LIMIT 1;
  IF r IS NULL THEN RETURN QUERY SELECT ''::text, false, 'Invalid code'::text; RETURN; END IF;
  IF r.revoked THEN RETURN QUERY SELECT r.bname, false, 'Code revoked'::text; RETURN; END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN
    RETURN QUERY SELECT r.bname, false, 'Code expired'::text; RETURN;
  END IF;
  IF r.uses >= r.max_uses THEN RETURN QUERY SELECT r.bname, false, 'Code fully used'::text; RETURN; END IF;
  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE tenant_id = r.tenant_id;
  IF v_count >= r.mu THEN RETURN QUERY SELECT r.bname, false, 'Business is at user limit'::text; RETURN; END IF;
  RETURN QUERY SELECT r.bname, true, ''::text;
END $$;
GRANT EXECUTE ON FUNCTION public.peek_invite(text) TO anon, authenticated;

-- 5. Redeem invite (called by trigger or after signup); attaches caller to tenant
CREATE OR REPLACE FUNCTION public.redeem_invite_for(_user_id uuid, _code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_count bigint;
BEGIN
  SELECT i.*, t.max_users AS mu INTO r
    FROM public.tenant_invites i JOIN public.tenants t ON t.id = i.tenant_id
    WHERE upper(i.code) = upper(trim(_code)) FOR UPDATE;
  IF r IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  IF r.revoked THEN RAISE EXCEPTION 'Invite has been revoked'; END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN RAISE EXCEPTION 'Invite has expired'; END IF;
  IF r.uses >= r.max_uses THEN RAISE EXCEPTION 'Invite is fully used'; END IF;
  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE tenant_id = r.tenant_id;
  IF v_count >= r.mu THEN RAISE EXCEPTION 'Business has reached its user limit'; END IF;

  UPDATE public.profiles SET tenant_id = r.tenant_id WHERE user_id = _user_id;
  -- demote: ensure not admin/super_admin via invite path
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin');
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, 'user') ON CONFLICT DO NOTHING;
  UPDATE public.tenant_invites SET uses = uses + 1 WHERE id = r.id;
  RETURN r.tenant_id;
END $$;

-- 6. Update new-profile trigger to honor invite_code in user metadata
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id uuid;
  v_name text;
  v_invite text;
  v_inv RECORD;
  v_count bigint;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'My Business');
  v_invite := NULLIF(trim(NEW.raw_user_meta_data->>'invite_code'), '');

  IF v_invite IS NOT NULL THEN
    SELECT i.*, t.max_users AS mu INTO v_inv
      FROM public.tenant_invites i JOIN public.tenants t ON t.id = i.tenant_id
      WHERE upper(i.code) = upper(v_invite) FOR UPDATE;
    IF v_inv IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
    IF v_inv.revoked THEN RAISE EXCEPTION 'Invite has been revoked'; END IF;
    IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() THEN RAISE EXCEPTION 'Invite has expired'; END IF;
    IF v_inv.uses >= v_inv.max_uses THEN RAISE EXCEPTION 'Invite is fully used'; END IF;
    SELECT COUNT(*) INTO v_count FROM public.profiles WHERE tenant_id = v_inv.tenant_id;
    IF v_count >= v_inv.mu THEN RAISE EXCEPTION 'Business has reached its user limit'; END IF;

    v_tenant_id := v_inv.tenant_id;
    INSERT INTO public.profiles (user_id, tenant_id, full_name, phone, email)
    VALUES (NEW.id, v_tenant_id,
            COALESCE(NEW.raw_user_meta_data->>'full_name',''),
            COALESCE(NEW.raw_user_meta_data->>'phone',''),
            NEW.email)
    ON CONFLICT (user_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
    UPDATE public.tenant_invites SET uses = uses + 1 WHERE id = v_inv.id;
  ELSE
    INSERT INTO public.tenants (owner_user_id, business_name) VALUES (NEW.id, v_name)
    RETURNING id INTO v_tenant_id;
    INSERT INTO public.profiles (user_id, tenant_id, full_name, phone, email)
    VALUES (NEW.id, v_tenant_id,
            COALESCE(NEW.raw_user_meta_data->>'full_name',''),
            COALESCE(NEW.raw_user_meta_data->>'phone',''),
            NEW.email)
    ON CONFLICT (user_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- 7. List invites for current tenant
CREATE OR REPLACE FUNCTION public.admin_list_invites()
RETURNS TABLE(id uuid, code text, max_uses int, uses int, expires_at timestamptz, revoked boolean, note text, created_at timestamptz, status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tid uuid;
BEGIN
  v_tid := public.get_my_tenant();
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT i.id, i.code, i.max_uses, i.uses, i.expires_at, i.revoked, i.note, i.created_at,
         CASE
           WHEN i.revoked THEN 'revoked'
           WHEN i.expires_at IS NOT NULL AND i.expires_at < now() THEN 'expired'
           WHEN i.uses >= i.max_uses THEN 'used'
           ELSE 'active'
         END::text
  FROM public.tenant_invites i
  WHERE i.tenant_id = v_tid
  ORDER BY i.created_at DESC;
END $$;

-- 8. Quota check helper
CREATE OR REPLACE FUNCTION public.tenant_has_seat(_tid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT COUNT(*) FROM public.profiles WHERE tenant_id = _tid)
       < (SELECT max_users FROM public.tenants WHERE id = _tid);
$$;
