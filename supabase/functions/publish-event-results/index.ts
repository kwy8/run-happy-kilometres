import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
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
      .select("id, route_distance_m, route_elevation_gain_m, route_elevation_loss_m, alpha")
      .eq("id", event_id).maybeSingle();
    if (evErr || !ev) return json({ error: "Event not found" }, 404);

    if (publish !== false) {
      if (!ev.route_distance_m || ev.route_distance_m <= 0) {
        return json({ error: "Set route distance before publishing" }, 400);
      }
      if (ev.alpha === null || ev.alpha === undefined) {
        return json({ error: "Set alpha before publishing" }, 400);
      }

      // Snapshot route params + alpha onto each result; trigger recomputes scores.
      const { error: upErr } = await admin
        .from("event_results")
        .update({
          distance_m: ev.route_distance_m,
          elevation_gain_m: ev.route_elevation_gain_m,
          elevation_loss_m: ev.route_elevation_loss_m,
          alpha_used: ev.alpha,
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
