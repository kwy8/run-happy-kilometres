import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/scan-event`;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function makeUser() {
  const email = `test+${crypto.randomUUID()}@example.com`;
  const password = "Passw0rd!test";
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw error;
  const userClient = createClient(SUPABASE_URL, ANON);
  const { data: sess, error: sErr } = await userClient.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  return { userId: data.user!.id, token: sess.session!.access_token };
}

async function makeEvent(opts: { qr_enabled: boolean; with_distance?: boolean }) {
  const startTok = crypto.randomUUID();
  const finishTok = crypto.randomUUID();
  const { data, error } = await admin.from("events").insert({
    title: `qr-test-${Date.now()}`,
    event_date: new Date().toISOString().slice(0, 10),
    qr_enabled: opts.qr_enabled,
    start_qr_token: startTok,
    finish_qr_token: finishTok,
    route_distance_m: opts.with_distance ? 5000 : null,
    route_elevation_gain_m: 50,
    alpha: 5,
  }).select().single();
  if (error) throw error;
  return { eventId: data.id as string, startTok, finishTok };
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

async function cleanup(eventId: string, userId: string) {
  await admin.from("event_results").delete().eq("event_id", eventId);
  await admin.from("event_participants").delete().eq("event_id", eventId);
  await admin.from("events").delete().eq("id", eventId);
  await admin.auth.admin.deleteUser(userId);
}

Deno.test({ name: "scan-event: rejects unauthenticated", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "apikey": ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: "x", token: "x", phase: "start" }),
  });
  await res.text();
  assertEquals(res.status, 401);
} });

Deno.test({ name: "scan-event: 404 for unknown event", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const u = await makeUser();
  const r = await call(u.token, {
    event_id: "00000000-0000-0000-0000-000000000000",
    token: "x",
    phase: "start",
  });
  assertEquals(r.status, 404);
  await admin.auth.admin.deleteUser(u.userId);
} });

Deno.test({ name: "scan-event: 403 when QR disabled", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const u = await makeUser();
  const e = await makeEvent({ qr_enabled: false });
  const r = await call(u.token, { event_id: e.eventId, token: e.startTok, phase: "start" });
  assertEquals(r.status, 403);
  assertEquals(r.json.error, "QR timing disabled");
  await cleanup(e.eventId, u.userId);
} });

Deno.test({ name: "scan-event: 403 on wrong token", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const u = await makeUser();
  const e = await makeEvent({ qr_enabled: true });
  const r = await call(u.token, { event_id: e.eventId, token: "nope", phase: "start" });
  assertEquals(r.status, 403);
  await cleanup(e.eventId, u.userId);
} });

Deno.test({ name: "scan-event: rejects start token used as finish", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const u = await makeUser();
  const e = await makeEvent({ qr_enabled: true });
  const r = await call(u.token, { event_id: e.eventId, token: e.startTok, phase: "finish" });
  assertEquals(r.status, 403);
  await cleanup(e.eventId, u.userId);
} });

Deno.test({ name: "scan-event: 400 on missing params", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const u = await makeUser();
  const r = await call(u.token, { event_id: "x" });
  assertEquals(r.status, 400);
  await admin.auth.admin.deleteUser(u.userId);
} });

Deno.test({ name: "scan-event: full happy path + idempotency", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const u = await makeUser();
  const e = await makeEvent({ qr_enabled: true });

  const s1 = await call(u.token, { event_id: e.eventId, token: e.startTok, phase: "start" });
  assertEquals(s1.status, 200);
  assertEquals(s1.json.action, "started");

  const s2 = await call(u.token, { event_id: e.eventId, token: e.startTok, phase: "start" });
  assertEquals(s2.json.action, "already_started");

  const f1 = await call(u.token, { event_id: e.eventId, token: e.finishTok, phase: "finish" });
  assertEquals(f1.json.action, "finished");

  const f2 = await call(u.token, { event_id: e.eventId, token: e.finishTok, phase: "finish" });
  assertEquals(f2.json.action, "already_finished");

  // Auto-joined as participant
  const { data: parts } = await admin.from("event_participants")
    .select("user_id").eq("event_id", e.eventId).eq("user_id", u.userId);
  assertEquals(parts?.length, 1);

  await cleanup(e.eventId, u.userId);
} });

Deno.test({ name: "scan-event: finish without start creates incomplete row", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const u = await makeUser();
  const e = await makeEvent({ qr_enabled: true });
  const r = await call(u.token, { event_id: e.eventId, token: e.finishTok, phase: "finish" });
  assertEquals(r.json.action, "finished_no_start");
  assertEquals(r.json.result.status, "incomplete");
  await cleanup(e.eventId, u.userId);
} });
