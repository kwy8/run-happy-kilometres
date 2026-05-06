import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  event_id?: string;
  token?: string;
  phase?: "start" | "finish";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
        Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      token,
    );
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claims.claims.sub as string;

    const body = (await req.json().catch(() => ({}))) as Body;
    const { event_id, token: scanToken, phase } = body;
    if (
      !event_id || !scanToken || !phase ||
      (phase !== "start" && phase !== "finish")
    ) {
      return json({ error: "Missing parameters" }, 400);
    }

    // Service-role client to enforce server-side timestamps
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ev, error: evErr } = await admin
      .from("events")
      .select(
        "id, qr_enabled, start_qr_token, finish_qr_token, results_published",
      )
      .eq("id", event_id)
      .maybeSingle();
    if (evErr || !ev) return json({ error: "Event not found" }, 404);
    if (!ev.qr_enabled) return json({ error: "QR timing disabled" }, 403);

    const expected = phase === "start"
      ? ev.start_qr_token
      : ev.finish_qr_token;
    if (!expected || expected !== scanToken) {
      return json({ error: "Invalid QR token" }, 403);
    }

    // Auto-join event
    await admin.from("event_participants").upsert(
      { event_id, user_id: userId },
      { onConflict: "event_id,user_id", ignoreDuplicates: true },
    );

    // Load existing result row
    const { data: existing } = await admin
      .from("event_results")
      .select("*")
      .eq("event_id", event_id)
      .eq("user_id", userId)
      .maybeSingle();

    const now = new Date().toISOString();

    if (phase === "start") {
      if (!existing) {
        const { data, error } = await admin
          .from("event_results")
          .insert({
            event_id,
            user_id: userId,
            source: "qr",
            start_time: now,
            status: "pending",
          })
          .select()
          .single();
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, action: "started", result: data });
      }
      if (existing.start_time) {
        return json({
          ok: true,
          action: "already_started",
          result: existing,
        });
      }
      // Has finish but no start (rare) → mark incomplete
      const { data, error } = await admin
        .from("event_results")
        .update({ start_time: now, status: "incomplete" })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, action: "started_late", result: data });
    }

    // phase === "finish"
    if (!existing) {
      const { data, error } = await admin
        .from("event_results")
        .insert({
          event_id,
          user_id: userId,
          source: "qr",
          finish_time: now,
          status: "incomplete",
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, action: "finished_no_start", result: data });
    }
    if (existing.finish_time) {
      return json({ ok: true, action: "already_finished", result: existing });
    }
    if (existing.start_time && new Date(now) < new Date(existing.start_time)) {
      return json({ error: "Finish before start" }, 409);
    }
    const { data, error } = await admin
      .from("event_results")
      .update({
        finish_time: now,
        status: existing.start_time ? "pending" : "incomplete",
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, action: "finished", result: data });
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
