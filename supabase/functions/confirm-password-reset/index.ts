// Confirms a password reset using the super-admin-issued code.
// PUBLIC endpoint (verify_jwt = false) — relies on the DB-side verify_reset_code
// for code validation + attempt limiting.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, code, new_password } = await req.json();
    if (!email || !code || !new_password) {
      return json({ error: "email, code and new_password are required" }, 400);
    }
    if (typeof new_password !== "string" || new_password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userId, error: vErr } = await admin.rpc("verify_reset_code", {
      _email: email, _code: code,
    });
    if (vErr || !userId) return json({ error: vErr?.message ?? "Invalid code" }, 400);

    const { error: uErr } = await admin.auth.admin.updateUserById(userId as string, {
      password: new_password,
    });
    if (uErr) return json({ error: uErr.message }, 400);

    await admin.rpc("mark_reset_used", { _user_id: userId });
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
