// Admin-only: analyze a route and propose an alpha change.
// Per-runner residual method with RPE banding, medians, winsorization.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_RESULTS = 20;
const MIN_REPEAT_RUNNERS = 5;
const MIN_RPE_RESULTS = 10;
const ALPHA_MIN = 0;
const ALPHA_MAX = 20;
const DAMP = 0.5;

type Band = "easy" | "moderate" | "hard" | "maximal";
const bandOf = (rpe: number): Band =>
  rpe <= 3 ? "easy" : rpe <= 6 ? "moderate" : rpe <= 8 ? "hard" : "maximal";

const median = (xs: number[]): number => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const quantile = (xs: number[], q: number): number => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
};

const winsorize = (xs: number[]): number[] => {
  if (xs.length < 4) return xs;
  const lo = quantile(xs, 0.05), hi = quantile(xs, 0.95);
  return xs.map((x) => Math.min(hi, Math.max(lo, x)));
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

    const { route_id } = await req.json();
    if (!route_id) return json({ error: "Missing route_id" }, 400);

    const { data: route, error: rErr } = await admin
      .from("routes").select("*").eq("id", route_id).maybeSingle();
    if (rErr || !route) return json({ error: "Route not found" }, 404);

    // Pull all verified results for this route + all results from those same runners (for baselines)
    const { data: routeResults } = await admin
      .from("event_results")
      .select("id, user_id, performance_score, rpe, distance_m, elevation_gain_m, alpha_used")
      .eq("route_id", route_id)
      .in("status", ["pending", "verified", "corrected"])
      .not("performance_score", "is", null)
      .not("rpe", "is", null);

    const results = routeResults ?? [];
    const ruids = [...new Set(results.map((r) => r.user_id))];

    // Minimum gating
    const reasons: string[] = [];
    if (results.length < MIN_RESULTS)
      reasons.push(`Need ≥${MIN_RESULTS} results with RPE (have ${results.length})`);
    if (results.length < MIN_RPE_RESULTS)
      reasons.push(`Need ≥${MIN_RPE_RESULTS} RPE-scored results`);

    // Pull all results from same runners across ALL routes for baselines
    const { data: allByRunners } = ruids.length
      ? await admin
          .from("event_results")
          .select("user_id, route_id, performance_score, rpe")
          .in("user_id", ruids)
          .in("status", ["pending", "verified", "corrected"])
          .not("performance_score", "is", null)
          .not("rpe", "is", null)
      : { data: [] as any[] };

    const byRunner = new Map<string, any[]>();
    for (const r of allByRunners ?? []) {
      if (!byRunner.has(r.user_id)) byRunner.set(r.user_id, []);
      byRunner.get(r.user_id)!.push(r);
    }
    const repeatRunners = [...byRunner.entries()].filter(([_, rs]) => {
      const routeIds = new Set(rs.map((x) => x.route_id));
      return routeIds.size >= 2;
    });

    if (repeatRunners.length < MIN_REPEAT_RUNNERS)
      reasons.push(`Need ≥${MIN_REPEAT_RUNNERS} runners with results on ≥2 routes (have ${repeatRunners.length})`);

    if (reasons.length) {
      return json({
        insufficient: true,
        reasons,
        sample_size: results.length,
        repeat_runners: repeatRunners.length,
      });
    }

    // Compute residuals per runner per band
    const residuals: Record<Band, number[]> = { easy: [], moderate: [], hard: [], maximal: [] };
    let mean_grade_sum = 0, mean_grade_n = 0;

    for (const [uid, allRuns] of repeatRunners) {
      // group runner's runs by route+band
      const perRouteBand = new Map<string, number[]>();
      for (const r of allRuns) {
        const b = bandOf(r.rpe);
        const k = `${r.route_id}|${b}`;
        if (!perRouteBand.has(k)) perRouteBand.set(k, []);
        perRouteBand.get(k)!.push(Number(r.performance_score));
      }

      for (const b of ["easy", "moderate", "hard", "maximal"] as Band[]) {
        const thisRouteScores = perRouteBand.get(`${route_id}|${b}`);
        if (!thisRouteScores?.length) continue;

        // baseline = median of (mean per other route in same band)
        const otherRouteMeans: number[] = [];
        for (const [k, scores] of perRouteBand) {
          const [rid, band] = k.split("|");
          if (rid === route_id || band !== b) continue;
          otherRouteMeans.push(scores.reduce((a, c) => a + c, 0) / scores.length);
        }
        if (!otherRouteMeans.length) continue;

        const routeMean = thisRouteScores.reduce((a, c) => a + c, 0) / thisRouteScores.length;
        const baseline = median(otherRouteMeans);
        if (!baseline) continue;
        residuals[b].push((routeMean - baseline) / baseline);
      }
    }

    // route mean grade for alpha-solve
    for (const r of results) {
      if (r.distance_m && r.distance_m > 0) {
        mean_grade_sum += (r.elevation_gain_m ?? 0) / r.distance_m;
        mean_grade_n++;
      }
    }
    const meanGrade = mean_grade_n ? mean_grade_sum / mean_grade_n : 0;

    // weighted median across bands (weight by count)
    const flat: { v: number; w: number }[] = [];
    for (const b of ["easy", "moderate", "hard", "maximal"] as Band[]) {
      const w = residuals[b].length;
      if (!w) continue;
      flat.push({ v: median(winsorize(residuals[b])), w });
    }
    if (!flat.length) {
      return json({ insufficient: true, reasons: ["No comparable runners across routes"], sample_size: results.length, repeat_runners: repeatRunners.length });
    }
    flat.sort((a, b) => a.v - b.v);
    const totalW = flat.reduce((a, c) => a + c.w, 0);
    let acc = 0, routeResidual = flat[0].v;
    for (const f of flat) {
      acc += f.w;
      if (acc >= totalW / 2) { routeResidual = f.v; break; }
    }

    const currentAlpha = Number(route.current_alpha);
    let proposed = currentAlpha;
    if (meanGrade > 0.0001 && Math.abs(routeResidual) > 0.001) {
      // current_score * (1 + a' * g) / (1 + alpha * g) = baseline
      // routeResidual = (current_score - baseline) / baseline => current_score = baseline*(1+r)
      // => (1 + a' g) = (1 + alpha g) / (1 + r)
      const algebraic = ((1 + currentAlpha * meanGrade) / (1 + routeResidual) - 1) / meanGrade;
      proposed = currentAlpha + DAMP * (algebraic - currentAlpha);
    }
    proposed = Math.max(ALPHA_MIN, Math.min(ALPHA_MAX, proposed));
    proposed = Math.round(proposed * 100) / 100;

    // Confidence
    const sizeFactor = Math.min(1, results.length / 50);
    const repeatFactor = Math.min(1, repeatRunners.length / 15);
    const rpeCoverage = 1; // we already filtered on rpe not null
    const allRes = (["easy", "moderate", "hard", "maximal"] as Band[]).flatMap((b) => residuals[b]);
    const iqr = quantile(allRes, 0.75) - quantile(allRes, 0.25);
    const stability = Math.max(0, 1 - Math.min(1, iqr / 0.5));
    const confidence = Math.round(((sizeFactor + repeatFactor + rpeCoverage + stability) / 4) * 100) / 100;

    const direction = proposed > currentAlpha ? "increase" : proposed < currentAlpha ? "decrease" : "no change";
    const reason =
      `Median residual ${routeResidual.toFixed(3)} across ${repeatRunners.length} repeat runners ` +
      `(${results.length} results, mean grade ${(meanGrade * 100).toFixed(2)}%). ` +
      `Suggests alpha ${direction} from ${currentAlpha} to ${proposed}.`;

    const metrics = {
      sample_size: results.length,
      repeat_runners: repeatRunners.length,
      route_residual: routeResidual,
      mean_grade: meanGrade,
      residuals_by_band: Object.fromEntries(
        (["easy", "moderate", "hard", "maximal"] as Band[]).map((b) => [b, residuals[b]]),
      ),
      iqr,
    };

    // Insert experiment + update route suggested_alpha
    const { data: exp, error: expErr } = await admin
      .from("alpha_experiments")
      .insert({
        route_id,
        previous_alpha: currentAlpha,
        proposed_alpha: proposed,
        reason,
        confidence_score: confidence,
        sample_size: results.length,
        metrics,
        status: "proposed",
        created_by: userId,
      })
      .select().single();
    if (expErr) return json({ error: expErr.message }, 500);

    await admin.from("routes").update({
      suggested_alpha: proposed,
      calibration_confidence: confidence,
      calibration_sample_size: results.length,
    }).eq("id", route_id);

    return json({ ok: true, experiment: exp });
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
