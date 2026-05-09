import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SCORING_VERSION = 1;

interface Body {
  event_id?: string;
  duration_s?: number;
  notes?: string | null;
  proof_image_url?: string | null;
}

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

    const body = (await req.json().catch(() => ({}))) as Body;
    const { event_id, duration_s, notes, proof_image_url } = body;

    if (!event_id || !duration_s || duration_s <= 0 || duration_s > 86400) {
      return json({ error: "event_id and a valid duration_s (1-86400) are required" }, 400);
    }
    if (notes && notes.length > 1000) return json({ error: "Notes too long" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Verify joined
    const { data: part } = await admin
      .from("event_participants")
      .select("id")
      .eq("event_id", event_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!part) return json({ error: "Join the event before submitting a result" }, 403);

    // 2. Load event + route
    const { data: ev, error: evErr } = await admin
      .from("events")
      .select("id, event_date, route_id, route_distance_m, route_elevation_gain_m, route_elevation_loss_m, alpha")
      .eq("id", event_id).maybeSingle();
    if (evErr || !ev) return json({ error: "Event not found" }, 404);

    let distance_m = ev.route_distance_m;
    let elevation_gain_m = ev.route_elevation_gain_m;
    let elevation_loss_m = ev.route_elevation_loss_m;
    let alpha_used = ev.alpha;
    const route_id = ev.route_id;

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

    if (!distance_m || distance_m <= 0) {
      return json({ error: "This event has no route distance configured yet — ask an admin." }, 409);
    }
    if (alpha_used == null) {
      return json({ error: "This event has no alpha configured yet — ask an admin." }, 409);
    }

    // 3. Conflict check
    const { data: existing } = await admin
      .from("event_results")
      .select("id, source, status, start_time, finish_time")
      .eq("event_id", event_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      if (existing.source === "qr" && existing.start_time && existing.finish_time) {
        return json({
          error: "QR result already recorded — ask an admin to override if needed.",
        }, 409);
      }
      if (existing.status === "verified") {
        return json({ error: "Your result is already verified and locked." }, 409);
      }
      // Update existing pending row
      const { data, error } = await admin
        .from("event_results")
        .update({
          source: "manual",
          submitted_duration_s: duration_s,
          duration_s,
          start_time: null,
          finish_time: null,
          distance_m,
          elevation_gain_m,
          elevation_loss_m,
          alpha_used,
          route_id,
          scoring_formula_version: SCORING_VERSION,
          notes: notes ?? null,
          proof_image_url: proof_image_url ?? null,
          status: "pending",
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, action: "updated", result: data });
    }

    // 4. Insert new manual row
    const { data, error } = await admin
      .from("event_results")
      .insert({
        event_id,
        user_id: userId,
        source: "manual",
        submitted_duration_s: duration_s,
        duration_s,
        distance_m,
        elevation_gain_m,
        elevation_loss_m,
        alpha_used,
        route_id,
        scoring_formula_version: SCORING_VERSION,
        notes: notes ?? null,
        proof_image_url: proof_image_url ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, action: "created", result: data });
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
