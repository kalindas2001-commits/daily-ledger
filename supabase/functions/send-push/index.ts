// @ts-nocheck
import webpush from 'npm:web-push@3.6.7';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY = 'BO56kMgGELrS8sOY2wUeghV158DGgm4V_i1e4LTvBYfDheLyRpJeDzo2tAbXeSsQOoYt4uR0UU9_-IKSqqM8fVE';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@rossets.rw';

if (VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    if (!VAPID_PRIVATE_KEY) return json({ error: 'VAPID_PRIVATE_KEY not configured' }, 500);

    const body = await req.json().catch(() => ({}));
    const { user_id, user_ids, broadcast, title, message, severity, url, alert_id, tag } = body;
    if (!title) return json({ error: 'title required' }, 400);

    // Resolve target audience: single user, list of users, or every subscribed device.
    let query = admin.from('push_subscriptions').select('*');
    if (broadcast === true) {
      // no filter — every registered device
    } else if (Array.isArray(user_ids) && user_ids.length > 0) {
      query = query.in('user_id', user_ids);
    } else if (user_id) {
      query = query.eq('user_id', user_id);
    } else {
      return json({ error: 'user_id, user_ids or broadcast required' }, 400);
    }

    const { data: subs, error } = await query;
    if (error) throw error;

    const payload = JSON.stringify({
      title,
      body: message ?? '',
      severity: severity ?? 'info',
      url: url ?? '/',
      tag: tag ?? alert_id ?? `cungacash-${Date.now()}`,
    });

    const results = await Promise.allSettled(
      (subs ?? []).map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          return { endpoint: s.endpoint, ok: true };
        } catch (e: any) {
          // 404/410 = subscription expired -> delete
          if (e.statusCode === 404 || e.statusCode === 410) {
            await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          }
          return { endpoint: s.endpoint, ok: false, error: String(e?.message ?? e) };
        }
      }),
    );

    return json({ sent: results.length, results });
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
