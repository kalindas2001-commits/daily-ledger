
-- Add transaction time for differentiating same-day entries
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transaction_time TIME NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::time;
CREATE INDEX IF NOT EXISTS idx_transactions_user_datetime ON public.transactions (user_id, transaction_date DESC, transaction_time DESC);

-- Deep-link AI alerts to the /alerts page (with alert id for highlight)
CREATE OR REPLACE FUNCTION public.notify_push_on_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  edge_url text := 'https://zdtyaxvfcfllrwgeoivs.supabase.co/functions/v1/send-push';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdHlheHZmY2ZsbHJ3Z2VvaXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDQyNzMsImV4cCI6MjA5MDgyMDI3M30.qhUwE3ubBlKJfu6JYqQQskcDLnV9CId2FT091sJ_XtY';
  v_url text;
BEGIN
  v_url := '/alerts?id=' || NEW.id::text;
  IF NEW.tenant_id IS NOT NULL AND public.is_super_admin(NEW.user_id) THEN
    v_url := '/admin/tenants/' || NEW.tenant_id::text || '?alert=' || NEW.id::text;
  END IF;

  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon_key),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'severity', NEW.severity,
      'alert_id', NEW.id::text,
      'tenant_id', NEW.tenant_id,
      'url', v_url
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;
