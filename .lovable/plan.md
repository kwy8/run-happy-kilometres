## Goal

Refine the run-tracking architecture around three first-class entities only — **QR-timed event runs**, **manual event submissions**, and an **admin-only casual run beta** — and standardise everything around **Run Rating (RR)**. Drop any future plans involving a Start/End-Run button system.

---

## 1. Result methods (the only three)

| Method | Who | Where stored | Affects leaderboards | Affects calibration |
|---|---|---|---|---|
| QR Timing | Any joined member | `event_results.source = 'qr'` | Yes (when verified) | Yes |
| Manual event submission | Any joined member | `event_results.source = 'manual'` | Yes (when verified) | Yes |
| Casual run (beta) | Admins only (MVP) | `casual_runs` (new table) | No | Yes |

Casual `runs` (the old table) become **legacy** — keep reading them for history, stop creating new rows. AddRun page is repurposed (see §4).

---

## 2. Database design changes

### 2a. `event_results` — extend, don't replace

Add columns:
- `proof_image_url text` — optional manual-submission screenshot
- `submitted_duration_s integer` — raw user-entered duration for manual rows (kept separate from QR-derived `duration_s` for auditability)

Keep existing: `source`, `start_time`, `finish_time`, `duration_s`, `distance_m`, `elevation_gain_m`, `alpha_used`, `performance_score` (= RR), `rpe`, `rpe_notes`, `status`, `admin_note`, `route_id`, `scoring_formula_version`.

`source` enum becomes `'qr' | 'manual'` (drop any other future values). `status` flow:
- `pending` — created by user (QR or manual), awaiting admin verification
- `verified` — counted on leaderboards & RR
- `rejected` — visible only to owner + admins, never scored
- `incomplete` — QR scan missing a phase (already used)

Uniqueness: one row per `(event_id, user_id)` (already implicit). Manual submission UPSERTs onto an existing QR row instead of creating a duplicate (see §6).

### 2b. New table `casual_runs`

```
id uuid pk
user_id uuid (RLS: admin only for MVP)
route_name text
terrain_type surface_type
distance_m integer
elevation_gain_m integer
elevation_loss_m integer
alpha_used numeric
duration_s integer
performance_score numeric  -- computed by trigger, same v1 formula
rpe smallint
notes text
weather_notes text
scoring_formula_version smallint default 1
created_at, updated_at
```

Reuse the existing `recompute_event_result` logic via a sibling trigger `recompute_casual_run` that populates `performance_score` from the v1 formula. No FK to `routes` — casual runs are exploratory, route is free text.

### 2c. Legacy `runs` table

- Stop writing to it from new flows.
- Keep RLS as-is.
- Profile/history pages continue to read it as "Legacy casual" rows until backfill is done.

---

## 3. Backend flows (simplified)

### QR (unchanged)
`scan-event` edge function → inserts/updates `event_results` row with `source='qr'`. Trigger recomputes RR once both timestamps exist.

### Manual event submission (new edge function `submit-manual-result`)
Inputs: `event_id`, `duration_s`, optional `notes`, optional `proof_image_url`.
1. Verify caller has joined the event.
2. Verify event is in the past (or admin override).
3. Pull route data (distance/elevation/alpha) from `events.route_id` → `routes`.
4. UPSERT `event_results` row by `(event_id, user_id)`:
   - if existing QR row with `start_time` & `finish_time` → reject (conflict, see §6)
   - else write `source='manual'`, `submitted_duration_s`, `duration_s`, denormalised route fields, `alpha_used`, `scoring_formula_version`, `status='pending'`.
5. Trigger computes RR.

### Casual run (admin only)
Direct insert into `casual_runs` from a dedicated admin page. RR computed by trigger.

### Verification
Admin UI on Event Timing page shows pending rows (both `qr` and `manual`) with a "Verify" / "Reject" toggle. Verification is a single column flip; lightweight.

---

## 4. Frontend changes

### Repurpose `AddRun.tsx` → `SubmitResult.tsx` (event-scoped only)
- Always requires an `event` query param (linked from Event Details).
- Fields: duration (min:sec), optional notes, optional proof image upload (storage bucket `result-proofs`).
- Removes free distance/date entry (route distance + event date are authoritative).
- Free-form "log any km" entry is removed for non-admins.

### Event Details
- "Log Run for This Event" button → routes to new submit page.
- Participant table gets a small badge next to each row: `QR` (sun icon) or `Manual` (pencil icon), plus a paper-clip icon if proof attached.
- Pending rows shown in muted style with "awaiting verification" tooltip.

### Profile / history
- Section 1: **Official runs** — verified `event_results` (QR + manual), with method badge.
- Section 2: **Casual (beta)** — `casual_runs` rows, admin-only visibility.
- Section 3: **Legacy** — old `runs` rows (collapsed by default).

### Admin Casual Beta page (`/admin/casual-runs`)
Form with all casual fields; table of recent casual runs with RR, terrain, alpha used. "Promote to calibration sample" button (sets a flag `included_in_calibration`).

### Run Rating UX (consistent surface)
Wherever RR appears, render a small chip:

```
RR 12.4   ▸ Strong run for this route (+0.6 vs your avg)
α 0.42 · 5.0 km · +120 m · RPE 7
```

Rules for the interpretation line (deterministic, no AI):
- Compare to user's avg RR on the same `route_id` (last 4):
  - ≥ +0.5 → "Strong run for this route difficulty"
  - within ±0.5 → "On par with your usual"
  - ≤ −0.5 → "Off-pace today — recovery run?"
- If RPE dropped while RR rose → "Improved RR at lower effort"
- If `surface_type ∈ {trail, mixed}` and `technicality_rating ≥ 3` → append "Technical-trail adjustment applied"

Centralise these in `src/lib/rrInterpretation.ts` so Profile, EventDetails, and Casual share copy.

### Mobile/desktop polish
Method badge, RR chip, and proof thumbnail must wrap cleanly on narrow viewports — handled inside a single `RrCell` component.

---

## 5. Calibration data architecture

- `event_results` (verified) and `casual_runs` (where `included_in_calibration = true`) are both eligible inputs.
- Existing `recommend-alpha` edge function gets a flag `include_casual: boolean` (admin choice in `/admin/calibration`).
- Casual runs without a `route_id` cannot calibrate a known route; instead they feed a future "terrain prior" — store but do not auto-apply.
- Historical reproducibility unchanged: every scored row keeps `alpha_used` + `scoring_formula_version`.

---

## 6. Edge cases & policies

| Case | Handling |
|---|---|
| User scans QR then submits manual | Manual submission is rejected with "QR result already recorded — ask an admin to override" |
| User submits manual then scans QR later | QR scan overwrites duration; row becomes `source='qr'`, manual fields preserved in `submitted_duration_s` for audit |
| Duplicate manual submit | Idempotent UPSERT on `(event_id, user_id)`; second submit updates first while `status='pending'`, blocked once `verified` |
| Route edited after results published | Past `event_results` keep their snapshotted `distance_m`/`elevation_gain_m`/`alpha_used`; new submissions use new route values |
| Alpha changed later | Same — snapshot per row |
| Missing RPE | Allowed; `session_load` stays null, RR still computed |
| Missing proof | Allowed; manual rows just lack the paper-clip badge |
| Casual run duplicated by accident | Admin can soft-delete (DELETE policy admin-only); UI shows "delete" on rows < 24h old |
| Manual submit on event with no route | Blocked at edge function — "admin must set route first" |

---

## 7. RLS / security plan

### `event_results`
- Existing policies kept.
- Add: owners may INSERT a row only when `source='manual'` AND no row exists for `(event_id, user_id)` — enforced in `event_results_owner_guard` trigger (new branch).
- Owners may UPDATE only `rpe`, `rpe_notes`, `notes`, `proof_image_url` (extend trigger whitelist).

### `casual_runs`
- RLS enabled.
- SELECT: `has_role(auth.uid(), 'admin')`.
- INSERT/UPDATE/DELETE: `has_role(auth.uid(), 'admin')`.
- (When opened to all users post-MVP, swap to `auth.uid() = user_id`.)

### `routes`
- Unchanged — admin-only writes.

### Storage
- New bucket `result-proofs`, public-read, write only by authenticated user to `proofs/{user_id}/...`.

---

## 8. MVP simplifications

- No anti-cheat (no GPS verification, no IP throttling beyond Supabase defaults).
- Verification is a one-click admin toggle, no review queue UI beyond a filter.
- Casual runs admin-only — no per-user opt-in flow yet.
- Interpretation lines are rule-based, not ML.
- Reuse existing v1 scoring trigger for both tables; no new scoring version.

## 9. Future scalability

- Open `casual_runs` to all members with `show_on_leaderboard`-style opt-in for a "personal training" tab.
- Promote `casual_runs.route_name` to a real `route_id` via fuzzy matching once route catalog is richer.
- Add `terrain_priors` table fed by casual data to bootstrap alpha for new routes.
- Versioned scoring (`v2` adding terrain & weather modifiers — types already reserved in `src/lib/scoring/types.ts`).
- Swap rule-based interpretation for a small embeddings-based "similar past runs" recommender.

---

## 10. Technical changes summary (when implementing)

- Migration: extend `event_results` (`proof_image_url`, `submitted_duration_s`); create `casual_runs` + trigger; create `result-proofs` bucket; extend `event_results_owner_guard`; tighten owner INSERT policy.
- Edge functions: new `submit-manual-result`; small update to `recommend-alpha` for casual inclusion flag.
- Frontend: rebuild `AddRun` → `SubmitResult`, new `/admin/casual-runs`, new `RrCell` + `rrInterpretation.ts`, badge updates on Event Details & Profile.
- Memory updates after build: record new method-badge UX, casual-runs admin scope, manual-overrides-only-when-pending rule.

## Out of scope

- Backfilling legacy `runs` into `event_results`.
- Public casual-run feature.
- Any Start/End-Run button system (explicitly rejected).
- New scoring formula version.
