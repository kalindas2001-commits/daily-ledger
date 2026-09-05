CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_url text := 'https://zdtyaxvfcfllrwgeoivs.supabase.co/functions/v1/send-push';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdHlheHZmY2ZsbHJ3Z2VvaXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDQyNzMsImV4cCI6MjA5MDgyMDI3M30.qhUwE3ubBlKJfu6JYqQQskcDLnV9CId2FT091sJ_XtY';
BEGIN
  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon_key),
    body := jsonb_build_object(
      'broadcast', true,
      'title', NEW.title,
      'message', NEW.body,
      'severity', 'info',
      'tag', 'cc-notif-'||NEW.id::text,
      'url', '/'
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_on_notification ON public.notifications;
CREATE TRIGGER trg_notify_push_on_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_notification();

CREATE OR REPLACE FUNCTION public.notify_push_on_edit_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_url text := 'https://zdtyaxvfcfllrwgeoivs.supabase.co/functions/v1/send-push';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdHlheHZmY2ZsbHJ3Z2VvaXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDQyNzMsImV4cCI6MjA5MDgyMDI3M30.qhUwE3ubBlKJfu6JYqQQskcDLnV9CId2FT091sJ_XtY';
  v_event text;
  v_title text;
  v_message text;
  v_stamp text;
BEGIN
  v_stamp := to_char(COALESCE(NEW.reviewed_at, NEW.updated_at, now()) AT TIME ZONE 'Africa/Kigali', 'Mon DD, YYYY · HH12:MI AM');

  IF NEW.status = 'approved' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := 'approved';
    v_title := 'Edit request approved';
  ELSIF NEW.status = 'rejected' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := 'rejected';
    v_title := 'Edit request declined';
  ELSIF NEW.admin_notes IS NOT NULL AND NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
    v_event := 'notes';
    v_title := 'New admin note on your edit request';
  ELSE
    RETURN NEW;
  END IF;

  v_message := v_stamp || COALESCE(' — Admin note: ' || NEW.admin_notes, '');

  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon_key),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', v_title,
      'message', v_message,
      'severity', CASE WHEN v_event = 'rejected' THEN 'warning' ELSE 'info' END,
      'pref_event', v_event,
      'tag', 'cc-edit-'||NEW.id::text||'-'||v_event,
      'url', '/transactions'
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_on_edit_request ON public.transaction_edit_requests;
CREATE TRIGGER trg_notify_push_on_edit_request
AFTER UPDATE ON public.transaction_edit_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_edit_request();