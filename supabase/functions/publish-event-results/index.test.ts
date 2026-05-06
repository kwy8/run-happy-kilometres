import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/publish-event-results`;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function makeUser(role?: "admin") {
  const email = `pub+${crypto.randomUUID()}@example.com`;
  const password = "Passw0rd!test";
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw error;
  if (role === "admin") {
    await admin.from("user_roles").insert({ user_id: data.user!.id, role: "admin" });
  }
  const c = createClient(SUPABASE_URL, ANON);
  const { data: sess } = await c.auth.signInWithPassword({ email, password });
  return { userId: data.user!.id, token: sess!.session!.access_token };
}

async function makeEvent(with_distance: boolean) {
  const { data, error } = await admin.from("events").insert({
    title: `pub-test-${Date.now()}`,
    event_date: new Date().toISOString().slice(0, 10),
    qr_enabled: true,
    start_qr_token: "s",
    finish_qr_token: "f",
    route_distance_m: with_distance ? 5000 : null,
    route_elevation_gain_m: 100,
    alpha: 5,
  }).select().single();
  if (error) throw error;
  return data.id as string;
}

async function call(token: string, body: unknown) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "apikey": ANON,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function cleanup(eventId: string, ...userIds: string[]) {
  await admin.from("event_results").delete().eq("event_id", eventId);
  await admin.from("events").delete().eq("id", eventId);
  for (const id of userIds) {
    await admin.from("user_roles").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id);
  }
}

Deno.test({ name: "publish: 401 unauthenticated", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "apikey": ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: "x" }),
  });
  await res.text();
  assertEquals(res.status, 401);
} });

Deno.test({ name: "publish: 403 for non-admin", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const u = await makeUser();
  const eventId = await makeEvent(true);
  const r = await call(u.token, { event_id: eventId });
  assertEquals(r.status, 403);
  await cleanup(eventId, u.userId);
} });

Deno.test({ name: "publish: 400 missing event_id", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const u = await makeUser("admin");
  const r = await call(u.token, {});
  assertEquals(r.status, 400);
  await cleanup("00000000-0000-0000-0000-000000000000", u.userId);
} });

Deno.test({ name: "publish: 404 unknown event", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const u = await makeUser("admin");
  const r = await call(u.token, { event_id: "00000000-0000-0000-0000-000000000000" });
  assertEquals(r.status, 404);
  await cleanup("00000000-0000-0000-0000-000000000000", u.userId);
} });

Deno.test({ name: "publish: 400 when route distance missing", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const u = await makeUser("admin");
  const eventId = await makeEvent(false);
  const r = await call(u.token, { event_id: eventId });
  assertEquals(r.status, 400);
  await cleanup(eventId, u.userId);
} });

Deno.test({ name: "publish: snapshots params, computes score, sets results_published", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const admin_u = await makeUser("admin");
  const runner = await makeUser();
  const eventId = await makeEvent(true);

  // Seed a completed result via service role
  const start = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const finish = new Date().toISOString();
  await admin.from("event_results").insert({
    event_id: eventId,
    user_id: runner.userId,
    source: "qr",
    start_time: start,
    finish_time: finish,
    status: "pending",
  });

  const r = await call(admin_u.token, { event_id: eventId });
  assertEquals(r.status, 200);
  assertEquals(r.json.results_published, true);

  const { data: ev } = await admin.from("events").select("results_published").eq("id", eventId).single();
  assertEquals(ev!.results_published, true);

  const { data: result } = await admin.from("event_results")
    .select("distance_m, alpha_used, performance_score")
    .eq("event_id", eventId).eq("user_id", runner.userId).single();
  assertEquals(result!.distance_m, 5000);
  assertEquals(Number(result!.alpha_used), 5);
  assert(Number(result!.performance_score) > 0);

  // Unpublish
  const r2 = await call(admin_u.token, { event_id: eventId, publish: false });
  assertEquals(r2.json.results_published, false);

  await cleanup(eventId, admin_u.userId, runner.userId);
} });
