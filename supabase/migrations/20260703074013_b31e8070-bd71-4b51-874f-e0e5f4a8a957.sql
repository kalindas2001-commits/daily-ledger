
-- 1. Add columns
ALTER TABLE public.assist_requests
  ADD COLUMN IF NOT EXISTS expert_type text,
  ADD COLUMN IF NOT EXISTS contact_email text;

-- 2. Status history
CREATE TABLE IF NOT EXISTS public.assist_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.assist_requests(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes text,
  event text NOT NULL DEFAULT 'status_change',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assist_status_history_req ON public.assist_status_history(request_id, created_at DESC);

GRANT SELECT, INSERT ON public.assist_status_history TO authenticated;
GRANT ALL ON public.assist_status_history TO service_role;
ALTER TABLE public.assist_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own request history" ON public.assist_status_history
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assist_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
  );
CREATE POLICY "Tenant admins read tenant history" ON public.assist_status_history
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assist_requests r
            WHERE r.id = request_id AND has_role(auth.uid(),'admin') AND r.tenant_id = get_my_tenant())
  );
CREATE POLICY "Super admins manage history" ON public.assist_status_history
  FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Super admins insert history" ON public.assist_status_history
  FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()));

-- 3. Deliverables
CREATE TABLE IF NOT EXISTS public.assist_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.assist_requests(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  content_type text,
  size_bytes bigint,
  kind text NOT NULL DEFAULT 'report',
  admin_notes text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assist_deliverables_req ON public.assist_deliverables(request_id, created_at DESC);

GRANT SELECT ON public.assist_deliverables TO authenticated;
GRANT ALL ON public.assist_deliverables TO service_role;
ALTER TABLE public.assist_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own deliverables" ON public.assist_deliverables
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assist_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
  );
CREATE POLICY "Tenant admins read tenant deliverables" ON public.assist_deliverables
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assist_requests r
            WHERE r.id = request_id AND has_role(auth.uid(),'admin') AND r.tenant_id = get_my_tenant())
  );
CREATE POLICY "Super admins manage deliverables" ON public.assist_deliverables
  FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- 4. Expert type auto-assign
CREATE OR REPLACE FUNCTION public.assist_expert_for_category(_cat text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _cat
    WHEN 'tax'         THEN 'Tax Advisor'
    WHEN 'accounting'  THEN 'Chartered Accountant'
    WHEN 'audit'       THEN 'Audit Specialist'
    WHEN 'assets'      THEN 'Asset Manager'
    WHEN 'fpa'         THEN 'Financial Analyst'
    WHEN 'strategy'    THEN 'Business Strategist'
    WHEN 'hr'          THEN 'HR Consultant'
    WHEN 'procurement' THEN 'Procurement Specialist'
    WHEN 'legal'       THEN 'Legal Advisor'
    WHEN 'erp'         THEN 'ERP & IT Consultant'
    WHEN 'banking'     THEN 'Banking Specialist'
    WHEN 'sales'       THEN 'Sales & CRM Consultant'
    WHEN 'inventory'   THEN 'Operations Consultant'
    WHEN 'training'    THEN 'Training Specialist'
    WHEN 'executive'   THEN 'Executive Advisor (AI)'
    ELSE 'General Consultant'
  END;
$$;

CREATE OR REPLACE FUNCTION public.assist_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.expert_type IS NULL OR NEW.expert_type = '' THEN
    NEW.expert_type := public.assist_expert_for_category(NEW.category_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assist_before_insert ON public.assist_requests;
CREATE TRIGGER trg_assist_before_insert BEFORE INSERT ON public.assist_requests
  FOR EACH ROW EXECUTE FUNCTION public.assist_before_insert();

-- 5. Status change → history + notify user via alerts (auto-pushes)
CREATE OR REPLACE FUNCTION public.assist_after_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_title text; v_msg text; v_sev text; v_event text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR (NEW.admin_notes IS DISTINCT FROM OLD.admin_notes) THEN
    v_event := CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status_change' ELSE 'note_added' END;
    INSERT INTO public.assist_status_history(request_id, from_status, to_status, changed_by, admin_notes, event)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NEW.admin_notes, v_event);

    -- Alert the requester
    v_title := CASE NEW.status
      WHEN 'in_progress' THEN 'Request in progress'
      WHEN 'completed'   THEN 'Request completed ✓'
      WHEN 'rejected'    THEN 'Request rejected'
      WHEN 'cancelled'   THEN 'Request cancelled'
      ELSE 'Request updated'
    END;
    v_msg := NEW.service_name || COALESCE(' — ' || NULLIF(NEW.admin_notes,''), '');
    v_sev := CASE NEW.status
      WHEN 'completed' THEN 'success'
      WHEN 'rejected'  THEN 'warning'
      ELSE 'info'
    END;
    INSERT INTO public.alerts(user_id, tenant_id, title, message, severity, category)
    VALUES (NEW.user_id, NEW.tenant_id, v_title, v_msg, v_sev, 'assist');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assist_after_update ON public.assist_requests;
CREATE TRIGGER trg_assist_after_update AFTER UPDATE ON public.assist_requests
  FOR EACH ROW EXECUTE FUNCTION public.assist_after_update();

-- 6. New request → seed history + alert super admins (via alerts table — user_id = super_admins)
CREATE OR REPLACE FUNCTION public.assist_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sa_id uuid;
BEGIN
  INSERT INTO public.assist_status_history(request_id, from_status, to_status, changed_by, event)
  VALUES (NEW.id, NULL, NEW.status, NEW.user_id, 'created');

  FOR sa_id IN SELECT user_id FROM public.user_roles WHERE role='super_admin' LOOP
    INSERT INTO public.alerts(user_id, tenant_id, title, message, severity, category)
    VALUES (sa_id, NEW.tenant_id, 'New Assist Request', NEW.service_name || ' — ' || COALESCE(NEW.expert_type,'General'), 'info', 'assist');
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assist_after_insert ON public.assist_requests;
CREATE TRIGGER trg_assist_after_insert AFTER INSERT ON public.assist_requests
  FOR EACH ROW EXECUTE FUNCTION public.assist_after_insert();

-- 7. Backfill expert_type for existing rows
UPDATE public.assist_requests SET expert_type = public.assist_expert_for_category(category_id)
WHERE expert_type IS NULL;
