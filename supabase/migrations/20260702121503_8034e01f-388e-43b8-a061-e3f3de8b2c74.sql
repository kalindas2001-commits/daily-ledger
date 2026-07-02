
CREATE TABLE public.assist_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  category_id TEXT NOT NULL,
  category_name TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assist_requests TO authenticated;
GRANT ALL ON public.assist_requests TO service_role;

ALTER TABLE public.assist_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own assist requests"
  ON public.assist_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own assist requests"
  ON public.assist_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Tenant admins can view tenant assist requests"
  ON public.assist_requests FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND tenant_id IS NOT NULL
    AND tenant_id = public.get_my_tenant()
  );

CREATE POLICY "Super admins can view all assist requests"
  ON public.assist_requests FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update assist requests"
  ON public.assist_requests FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can update own pending assist requests"
  ON public.assist_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can delete assist requests"
  ON public.assist_requests FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER assist_requests_set_tenant
  BEFORE INSERT ON public.assist_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();

CREATE TRIGGER assist_requests_updated_at
  BEFORE UPDATE ON public.assist_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_assist_requests_user ON public.assist_requests(user_id, created_at DESC);
CREATE INDEX idx_assist_requests_tenant ON public.assist_requests(tenant_id, created_at DESC);
CREATE INDEX idx_assist_requests_status ON public.assist_requests(status, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.assist_requests;
