// @ts-nocheck
import webpush from 'npm:web-push@3.6.7';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY = 'BO56kMgGELrS8sOY2wUeghV158DGgm4V_i1e4LTvBYfDheLyRpJeDzo2tAbXeSsQOoYt4uR0UU9_-IKSqqM8fVE';

/** Normalize to URL-safe base64 without padding (web-push requirement). */
const b64url = (s?: string | null) =>
  (s ?? '').trim().replace(/[^A-Za-z0-9+/=_-]/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const VAPID_PRIVATE_KEY = b64url(Deno.env.get('VAPID_PRIVATE_KEY'));

// Sanitize: strip angle brackets/spaces so a value like "mailto: <a@b.c>" stays valid.
const cleanedSubject = (Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@rossets.rw').replace(/[<>\s]/g, '');
const VAPID_SUBJECT = /^(mailto:|https?:\/\/)/.test(cleanedSubject) ? cleanedSubject : `mailto:${cleanedSubject}`;

let vapidError: string | null = null;
if (VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (e) {
    // Never crash the worker at boot — surface the problem in the response instead.
    vapidError = String(e?.message ?? e);
  }
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
    if (vapidError) return json({ error: `VAPID configuration invalid: ${vapidError}` }, 500);

    const body = await req.json().catch(() => ({}));
    const { user_id, user_ids, broadcast, title, message, severity, url, alert_id, tag, pref_event } = body;
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

    const { data: subsRaw, error } = await query;
    if (error) throw error;

    // Respect saved per-event web-alert preferences (approved / rejected / notes).
    let subs = subsRaw ?? [];
    if (pref_event && subs.length > 0) {
      const ids = [...new Set(subs.map((s: any) => s.user_id))];
      const { data: prefRows } = await admin
        .from('notification_preferences')
        .select('user_id, prefs')
        .in('user_id', ids);
      const disabled = new Set(
        (prefRows ?? [])
          .filter((r: any) => r?.prefs?.[pref_event]?.web === false)
          .map((r: any) => r.user_id),
      );
      subs = subs.filter((s: any) => !disabled.has(s.user_id));
    }


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
          const code = e?.statusCode;
          // Expired, revoked, or legacy (retired FCM /fcm/send/) endpoints -> drop so the
          // device re-registers a fresh subscription next time it opens the app.
          if ([400, 401, 403, 404, 410].includes(code) || s.endpoint.includes('/fcm/send/')) {
            await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          }
          return { endpoint: s.endpoint, ok: false, statusCode: code ?? null, error: String(e?.message ?? e) };
        }
      }),
    );

    return json({ sent: results.length, results });
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
