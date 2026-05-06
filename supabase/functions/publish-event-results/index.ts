import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SCORING_VERSION = 1;

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
    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const { event_id, publish } = await req.json();
    if (!event_id) return json({ error: "Missing event_id" }, 400);

    const { data: ev, error: evErr } = await admin
      .from("events")
      .select("id, route_id, route_distance_m, route_elevation_gain_m, route_elevation_loss_m, alpha")
      .eq("id", event_id).maybeSingle();
    if (evErr || !ev) return json({ error: "Event not found" }, 404);

    // Prefer route-level data when an event has a route assigned.
    let distance_m = ev.route_distance_m;
    let elevation_gain_m = ev.route_elevation_gain_m;
    let elevation_loss_m = ev.route_elevation_loss_m;
    let alpha_used = ev.alpha;
    let route_id: string | null = ev.route_id;

    if (route_id) {
      const { data: rt } = await admin
        .from("routes")
        .select("distance_m, elevation_gain_m, elevation_loss_m, current_alpha")
        .eq("id", route_id).maybeSingle();
      if (rt) {
        distance_m = rt.distance_m ?? distance_m;
        elevation_gain_m = rt.elevation_gain_m ?? elevation_gain_m;
        elevation_loss_m = rt.elevation_loss_m ?? elevation_loss_m;
        alpha_used = rt.current_alpha ?? alpha_used;
      }
    }

    if (publish !== false) {
      if (!distance_m || distance_m <= 0) {
        return json({ error: "Set route distance before publishing" }, 400);
      }
      if (alpha_used === null || alpha_used === undefined) {
        return json({ error: "Set alpha before publishing" }, 400);
      }

      const { error: upErr } = await admin
        .from("event_results")
        .update({
          distance_m,
          elevation_gain_m,
          elevation_loss_m,
          alpha_used,
          route_id,
          scoring_formula_version: SCORING_VERSION,
        })
        .eq("event_id", event_id);
      if (upErr) return json({ error: upErr.message }, 500);
    }

    const { error: pubErr } = await admin
      .from("events")
      .update({ results_published: publish !== false })
      .eq("id", event_id);
    if (pubErr) return json({ error: pubErr.message }, 500);

    return json({ ok: true, results_published: publish !== false });
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
