CREATE OR REPLACE FUNCTION public.super_admin_cron_status()
RETURNS TABLE(
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  last_run_started timestamptz,
  last_run_finished timestamptz,
  last_status text,
  last_return_message text,
  total_runs bigint,
  failed_runs bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    j.jobid, j.jobname, j.schedule, j.active,
    (SELECT start_time FROM cron.job_run_details d WHERE d.jobid = j.jobid ORDER BY start_time DESC LIMIT 1),
    (SELECT end_time   FROM cron.job_run_details d WHERE d.jobid = j.jobid ORDER BY start_time DESC LIMIT 1),
    (SELECT status     FROM cron.job_run_details d WHERE d.jobid = j.jobid ORDER BY start_time DESC LIMIT 1),
    (SELECT return_message FROM cron.job_run_details d WHERE d.jobid = j.jobid ORDER BY start_time DESC LIMIT 1),
    (SELECT count(*)   FROM cron.job_run_details d WHERE d.jobid = j.jobid),
    (SELECT count(*)   FROM cron.job_run_details d WHERE d.jobid = j.jobid AND status <> 'succeeded')
  FROM cron.job j
  ORDER BY j.jobname;
END $$;

CREATE OR REPLACE FUNCTION public.super_admin_cron_history(_jobid bigint, _limit int DEFAULT 20)
RETURNS TABLE(
  runid bigint, start_time timestamptz, end_time timestamptz, status text, return_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT d.runid, d.start_time, d.end_time, d.status, d.return_message
  FROM cron.job_run_details d
  WHERE d.jobid = _jobid
  ORDER BY d.start_time DESC
  LIMIT _limit;
END $$;

CREATE OR REPLACE FUNCTION public.super_admin_platform_pulse()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT jsonb_build_object(
    'alerts_24h',          (SELECT count(*) FROM public.alerts WHERE created_at > now() - interval '24 hours'),
    'alerts_critical_24h', (SELECT count(*) FROM public.alerts WHERE created_at > now() - interval '24 hours' AND severity='critical'),
    'alerts_unread',       (SELECT count(*) FROM public.alerts WHERE read_at IS NULL),
    'tx_24h',              (SELECT count(*) FROM public.transactions WHERE created_at > now() - interval '24 hours'),
    'new_tenants_7d',      (SELECT count(*) FROM public.tenants WHERE created_at > now() - interval '7 days'),
    'new_users_7d',        (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'pending_quotas',      (SELECT count(*) FROM public.quota_requests WHERE status='pending'),
    'pending_resets',      (SELECT count(*) FROM public.password_reset_requests WHERE status='pending'),
    'disabled_users',      (SELECT count(*) FROM auth.users WHERE banned_until IS NOT NULL AND banned_until > now()),
    'top_alert_tenants',   COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT t.business_name, count(a.id) as cnt
        FROM public.alerts a
        LEFT JOIN public.tenants t ON t.id = a.tenant_id
        WHERE a.created_at > now() - interval '7 days'
        GROUP BY t.business_name
        ORDER BY cnt DESC LIMIT 5
      ) t
    ), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

GRANT EXECUTE ON FUNCTION public.super_admin_cron_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_cron_history(bigint, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_platform_pulse() TO authenticated;