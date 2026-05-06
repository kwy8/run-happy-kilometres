// Admin-only: accept/reject an experiment, or apply a manual override or reset.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow } = await admin.from("user_roles").select("role")
      .eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    // action: "accept" | "reject" | "manual" | "reset" | "mark_calibrated"
    const { action, route_id, experiment_id, new_alpha, reason, alpha_status } = body;
    if (!action || !route_id) return json({ error: "Missing action/route_id" }, 400);

    const { data: route } = await admin.from("routes").select("*").eq("id", route_id).maybeSingle();
    if (!route) return json({ error: "Route not found" }, 404);

    if (action === "reject") {
      if (!experiment_id) return json({ error: "Missing experiment_id" }, 400);
      await admin.from("alpha_experiments").update({
        status: "rejected", rejected_at: new Date().toISOString(), reviewer_id: userId, notes: reason ?? null,
      }).eq("id", experiment_id);
      await admin.from("routes").update({ suggested_alpha: null }).eq("id", route_id);
      return json({ ok: true });
    }

    if (action === "mark_calibrated") {
      await admin.from("routes").update({ alpha_status: "calibrated" }).eq("id", route_id);
      return json({ ok: true });
    }

    let target: number | null = null;
    let source: "experiment" | "manual" | "reset" = "manual";
    let expId: string | null = null;

    if (action === "accept") {
      if (!experiment_id) return json({ error: "Missing experiment_id" }, 400);
      const { data: exp } = await admin.from("alpha_experiments").select("*").eq("id", experiment_id).maybeSingle();
      if (!exp) return json({ error: "Experiment not found" }, 404);
      target = Number(exp.proposed_alpha);
      source = "experiment";
      expId = experiment_id;
    } else if (action === "manual") {
      if (typeof new_alpha !== "number") return json({ error: "Missing new_alpha" }, 400);
      target = new_alpha;
      source = "manual";
    } else if (action === "reset") {
      target = 5;
      source = "reset";
    } else {
      return json({ error: "Unknown action" }, 400);
    }

    if (target === null || Number.isNaN(target)) return json({ error: "Invalid alpha" }, 400);

    const { error: histErr } = await admin.from("route_alpha_history").insert({
      route_id,
      previous_alpha: route.current_alpha,
      new_alpha: target,
      source,
      experiment_id: expId,
      changed_by: userId,
      reason: reason ?? null,
    });
    if (histErr) return json({ error: histErr.message }, 500);

    const updates: Record<string, unknown> = {
      current_alpha: target,
      alpha_last_updated_at: new Date().toISOString(),
      suggested_alpha: null,
    };
    if (alpha_status) updates.alpha_status = alpha_status;
    await admin.from("routes").update(updates).eq("id", route_id);

    if (expId) {
      await admin.from("alpha_experiments").update({
        status: "approved", approved_at: new Date().toISOString(), reviewer_id: userId, notes: reason ?? null,
      }).eq("id", expId);
    }

    return json({ ok: true, current_alpha: target });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
