// Admin creates a user inside their own tenant. Enforces quota.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const { data: { user }, error: uerr } = await userClient.auth.getUser();
    if (uerr || !user) return json({ error: "Not authenticated" }, 401);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) return json({ error: "Not authorized" }, 403);

    const { data: prof } = await admin.from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
    const tenantId = prof?.tenant_id;
    if (!tenantId) return json({ error: "No tenant" }, 400);

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.full_name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const role = body.role === "admin" ? "admin" : "user";

    if (!email.includes("@")) return json({ error: "Valid email required" }, 400);
    if (password.length < 6) return json({ error: "Password must be at least 6 chars" }, 400);
    if (!fullName) return json({ error: "Full name required" }, 400);

    // Quota check
    const { data: tenant } = await admin.from("tenants").select("max_users").eq("id", tenantId).single();
    const { count } = await admin.from("profiles").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
    if ((count ?? 0) >= (tenant?.max_users ?? 0)) {
      return json({ error: "Tenant has reached its user limit. Ask the platform admin to raise the quota." }, 400);
    }

    // Create the auth user (skip the default trigger's new-tenant path by passing invite_code? No - we must use service role and then fix tenant)
    const { data: created, error: cerr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName, phone, created_by_admin: true },
    });
    if (cerr || !created.user) return json({ error: cerr?.message ?? "Failed to create user" }, 400);

    const newUserId = created.user.id;
    // The handle_new_profile trigger just created a brand-new tenant for them; move them into the admin's tenant.
    const { data: newProf } = await admin.from("profiles").select("tenant_id").eq("user_id", newUserId).maybeSingle();
    const orphanTenant = newProf?.tenant_id;

    await admin.from("profiles").update({ tenant_id: tenantId, full_name: fullName, phone }).eq("user_id", newUserId);
    await admin.from("user_roles").delete().eq("user_id", newUserId);
    await admin.from("user_roles").insert({ user_id: newUserId, role });
    if (orphanTenant && orphanTenant !== tenantId) {
      // delete the auto-created empty tenant
      await admin.from("tenants").delete().eq("id", orphanTenant).eq("owner_user_id", newUserId);
    }

    return json({ ok: true, user_id: newUserId });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
