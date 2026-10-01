CREATE OR REPLACE FUNCTION public.admin_set_user_disabled(_target_user uuid, _disabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tid uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid())) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _target_user = auth.uid() THEN RAISE EXCEPTION 'Cannot disable yourself'; END IF;
  SELECT tenant_id INTO v_tid FROM public.profiles WHERE user_id = _target_user;
  IF NOT public.is_super_admin(auth.uid()) THEN
    IF v_tid IS DISTINCT FROM public.get_my_tenant() THEN RAISE EXCEPTION 'Member is not in your team'; END IF;
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tid AND owner_user_id = _target_user) THEN
      RAISE EXCEPTION 'The team owner cannot be disabled';
    END IF;
  END IF;
  UPDATE auth.users SET banned_until = CASE WHEN _disabled THEN 'infinity'::timestamptz ELSE NULL END WHERE id = _target_user;
  INSERT INTO public.audit_logs(tenant_id, actor_user_id, action, target_type, target_id, metadata)
  VALUES (v_tid, auth.uid(), CASE WHEN _disabled THEN 'member.disabled' ELSE 'member.enabled' END, 'user', _target_user::text, '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.tenant_set_member_role(_target uuid, _make_admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  SELECT tenant_id INTO v_tid FROM public.profiles WHERE user_id = _target;
  IF v_tid IS DISTINCT FROM public.get_my_tenant() THEN RAISE EXCEPTION 'Member is not in your team'; END IF;
  IF EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tid AND owner_user_id = _target) THEN
    RAISE EXCEPTION 'The team owner role cannot be changed';
  END IF;
  IF _make_admin THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_target, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target AND role = 'admin';
    INSERT INTO public.user_roles(user_id, role) VALUES (_target, 'user') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  INSERT INTO public.audit_logs(tenant_id, actor_user_id, action, target_type, target_id, metadata)
  VALUES (v_tid, auth.uid(), CASE WHEN _make_admin THEN 'member.promoted' ELSE 'member.demoted' END, 'user', _target::text, '{}'::jsonb);
END; $$;

REVOKE EXECUTE ON FUNCTION public.tenant_set_member_role(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.tenant_set_member_role(uuid, boolean) TO authenticated;