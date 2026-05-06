# Route Calibration & Alpha Tuning — Architecture Plan

Goal: turn `alpha` from an event-level number into a **route-level, admin-tunable, history-preserving** coefficient, with a recommendation engine that suggests changes from real data but never auto-applies them.

---

## 1. Recommended Architecture

Three loosely-coupled layers so calibration can evolve without touching timing or the UI:

```text
┌─ Timing (existing, unchanged) ──────┐
│ scan-event → event_results row      │
└────────────┬────────────────────────┘
             │ writes alpha_used, formula_version, route_id
             ▼
┌─ Scoring Engine (new, pure) ────────┐
│ score(D, T, E, alpha, version)      │
│ versioned, deterministic, testable  │
└────────────┬────────────────────────┘
             │ historical results stay valid
             ▼
┌─ Calibration Engine (new, offline) ─┐
│ analyze_route(route_id) → suggestion│
│ runs on-demand or cron, writes to   │
│ alpha_experiments + routes.suggested│
└────────────┬────────────────────────┘
             ▼
┌─ Admin Calibration Dashboard ───────┐
│ review / accept / reject / override │
└─────────────────────────────────────┘
```

Key principles:
- **Routes become first-class.** `events` reference a route; `alpha` lives on the route, not the event.
- **Reproducibility:** every result snapshots `alpha_used` + `scoring_formula_version`. Recomputing old scores is opt-in.
- **Recommendations are inert.** They live in `alpha_experiments` until an admin approves them; approval writes a new row to `route_alpha_history` and updates `routes.current_alpha`.
- **Pure scoring functions** in TS (client/edge) and SQL (trigger), kept in lockstep by version number. Both sides have unit tests for each version.

---

## 2. Database Design

### 2.1 New: `routes`
```text
routes
  id, name, description
  distance_m, elevation_gain_m, elevation_loss_m
  surface_type            enum('road','trail','mixed','track','gravel')
  technicality_rating     smallint 1–5    -- admin's subjective input
  terrain_notes           text
  gpx_file_url            text            -- moved from events
  current_alpha           numeric not null default 5
  suggested_alpha         numeric null
  alpha_status            enum('default','testing','calibrated','needs_review')
  calibration_confidence  numeric null    -- 0–1
  calibration_sample_size integer default 0
  alpha_last_updated_at   timestamptz null
  alpha_notes             text
  created_by, created_at, updated_at
```

### 2.2 New: `route_alpha_history` (audit log)
```text
route_alpha_history
  id, route_id
  previous_alpha, new_alpha
  source                  enum('manual','experiment','reset')
  experiment_id           uuid null → alpha_experiments
  changed_by, reason, created_at
```
Append-only. Powers the "recent alpha changes" timeline and lets admins revert.

### 2.3 New: `alpha_experiments`
```text
alpha_experiments
  id, route_id
  previous_alpha, proposed_alpha
  reason                  text         -- human-readable summary from engine
  confidence_score        numeric 0–1
  sample_size             integer
  metrics                 jsonb        -- raw stats: residuals, n_repeat_runners, RPE bands…
  status                  enum('proposed','testing','approved','rejected','archived')
  created_by              uuid null    -- null = system-generated
  created_at, approved_at, rejected_at
  reviewer_id, notes
```

### 2.4 Extend: `events`
- Add `route_id uuid` (nullable during migration; required afterwards).
- **Remove** route-ish columns from events over time (`route_distance_m`, `route_elevation_gain_m`, `route_elevation_loss_m`, `gpx_file_url`, `alpha`). Migration-friendly path: keep them as fallback, populate `route_id` for existing events by either creating one route per existing event or matching by GPX hash.

### 2.5 Extend: `event_results`
Add:
- `route_id uuid` — denormalized snapshot at publish time (so a later event→route reassignment doesn't break history).
- `scoring_formula_version smallint not null default 1`
- Keep existing `alpha_used`, `distance_m`, `elevation_gain_m`, `elevation_loss_m`, `performance_score`, `rpe`, `session_load`.

### 2.6 New: `scoring_formula_versions` (small reference table)
```text
id (smallint pk), name, description, created_at, deprecated_at
```
Lets the UI label "Score (v2)" and lets admins see which formula produced which row.

---

## 3. Calibration Strategy

The core question: **does route X consistently produce different adjusted scores than route Y for the same runner at the same effort?**

### 3.1 RPE bands
- easy: 1–3
- moderate: 4–6
- hard: 7–8
- maximal: 9–10

Only compare runs **within the same band** — RPE is the cheapest proxy for effort.

### 3.2 Per-runner residual method (recommended MVP approach)

For each runner with results on ≥2 routes:
1. Compute their mean adjusted score per (route, RPE-band).
2. Compute their **personal baseline** = mean of their per-route means across all routes (or median, more robust).
3. Per-route residual = `(route_mean - personal_baseline) / personal_baseline`.
4. Route-level signal = median of residuals across all qualifying runners (median, not mean — outlier-resistant).

Interpretation:
- Negative median residual → runners score lower here than their baseline → route is harder than alpha reflects → **suggest higher alpha**.
- Positive → route easier than alpha reflects → **suggest lower alpha**.

### 3.3 Suggested alpha update rule
Solve algebraically: how much extra alpha would close the residual gap?

```text
target_score = baseline
current_score = (D/T) * (1 + alpha * grade)        where grade = E_gain / D
proposed_alpha solves: current_score * (1 + a'*grade) / (1 + alpha*grade) = baseline
```

In practice use a damped step (don't jump fully):
```text
proposed_alpha = current_alpha + 0.5 * (algebraic_alpha - current_alpha)
clamp to [0, 20]
```

### 3.4 Minimums (block suggestions until met)
- ≥ 20 finished results on the route
- ≥ 5 runners with results on ≥ 2 different routes ("repeat runners")
- ≥ 10 results that include RPE
- Time span ≥ 3 events (avoid single-event noise)

Below thresholds: route stays `default`, dashboard shows "insufficient data — N/Y".

### 3.5 Confidence score (0–1)
Weighted average of:
- sample-size factor: `min(1, n_results / 50)`
- repeat-runner factor: `min(1, n_repeat_runners / 15)`
- RPE coverage: `fraction of results with RPE`
- residual stability: `1 - normalized_IQR_of_residuals`

Show confidence in the dashboard; don't gate on it (admin decides).

---

## 4. Alpha Recommendation Logic

Pseudo-code for `recommend_alpha(route_id)`:

```text
results = event_results WHERE route_id = X AND status='verified' AND rpe IS NOT NULL
if !meets_minimums(results): return null

per_runner = group(results) by user_id where user has ≥2 routes
for each runner:
  for each band in [easy,moderate,hard,maximal]:
    runner_route_mean[band] = mean(scores in band on this route)
    runner_baseline[band]   = median(per-route means in band across all their routes)
    residuals[band].push((runner_route_mean - baseline) / baseline)

route_residual = weighted_median(residuals across bands, weight by n)
proposed = solve_alpha(current_alpha, route_residual, mean_grade)
proposed = current + 0.5 * (proposed - current)
proposed = clamp(proposed, 0, 20)

confidence = compute_confidence(...)
return { proposed_alpha, confidence, sample_size, metrics }
```

Trigger:
- Manual: admin clicks "Re-analyze" on the route page → sync edge function call.
- Scheduled: weekly cron (Supabase scheduled edge function) loops over routes with new data since `alpha_last_updated_at`.

---

## 5. Anti-Outlier Strategy

- **Medians over means** at every aggregation step.
- **Winsorize** raw scores per route to [p5, p95] before stats.
- **Drop incomplete results** (status `incomplete`/`disqualified`).
- **Drop solo runners** (1 route only — no baseline possible).
- **RPE sanity check**: drop results where score percentile and RPE percentile disagree by >2 bands (e.g., fastest run logged as RPE 1).
- **Cooling-off**: if a route's alpha was changed in last 30 days, lower the recommendation weight or skip.
- **Damping factor 0.5** so suggestions converge, not oscillate.

---

## 6. Admin Calibration Dashboard

Route: `/admin/calibration` (admin-gated like `/admin`).

**List view** (table): route name • surface • current α • suggested α • Δ • confidence • sample size • repeat runners • last updated • status badge.

**Row actions**: Accept (writes history + updates `current_alpha`), Reject (archives experiment), Override (manual α input), Reset to default (5), Mark calibrated.

**Route detail view**: 
- Header: name, current α, status, last change.
- Stats: result count, finishers, avg RPE, score distribution sparkline, residual chart per RPE band.
- Pending experiment card: proposed α, reason, confidence, "Accept / Reject / Edit & Accept".
- History timeline: every α change with who/when/why.
- Experiment list with statuses.
- "Re-analyze now" button.

Normal users see none of this. Their event page shows just published results + their personal "vs last time" — no aggregates, no RPE distributions, no α metadata beyond a small "α 5.0" label if you want.

---

## 7. Scoring Engine Architecture

```text
src/lib/scoring/
  index.ts          // dispatch by version
  v1.ts             // (D/T) * (1 + alpha * E/D)
  v2.ts             // future: terrain multiplier, nonlinear E
  types.ts          // ScoreInput, ScoreOutput
  __tests__/        // golden-value tests per version
```

```ts
type ScoreInput = {
  distance_m: number;
  duration_s: number;
  elevation_gain_m: number;
  alpha: number;
  // forward-compatible:
  terrain?: TerrainModifiers;
  weather?: WeatherModifiers;
};

export function score(input: ScoreInput, version = CURRENT_VERSION): number;
```

SQL side: keep `recompute_event_result()` but switch on `NEW.scoring_formula_version`. Each version is a SQL `CASE` branch or a `score_v1()/score_v2()` function. Add a CI test that asserts SQL and TS produce identical values on a fixture set.

Future hooks (NOT implemented now):
- `route_terrain_modifier numeric` on routes.
- `weather_snapshot jsonb` on event_results.
- v2 formula could be `(D/T) * (1 + α·E/D)^β · terrain · weather` — version bump + new column, no migration of v1 rows.

---

## 8. Versioning Approach

- `scoring_formula_versions` table is the source of truth.
- Each `event_results` row pins its version. Old rows are **never silently recomputed**.
- "Recompute with v2" is an explicit admin action, writes to a sibling table `event_result_score_runs(result_id, version, score, computed_at)` — preserves the original.
- Dashboards show scores in their original version by default with a "Compare under v2" toggle once v2 ships.

---

## 9. Security / RLS Plan

New tables:

`routes`
- SELECT (authenticated): `true` for non-sensitive cols only — expose via a view `routes_public` that omits `suggested_alpha`, `calibration_confidence`, `calibration_sample_size`, `alpha_notes`.
- SELECT full row: `has_role(auth.uid(),'admin')`.
- INSERT/UPDATE/DELETE: admin only.

`route_alpha_history`
- SELECT: admin only.
- INSERT: admin only (or service role from edge function).
- UPDATE/DELETE: forbidden (append-only; enforce with trigger that raises on UPDATE/DELETE for non-superuser).

`alpha_experiments`
- SELECT/INSERT/UPDATE/DELETE: admin only.
- System-generated rows inserted by edge function with service role.

`event_results` (already correct) — no change beyond adding the new columns; existing policies cover it. The new `route_id` column is fine to expose.

`scoring_formula_versions` — public SELECT, admin-only writes.

Edge functions:
- `recommend-alpha` (admin-only via JWT + has_role check) — reads results, writes one `alpha_experiments` row + updates `routes.suggested_alpha`.
- `apply-alpha-decision` (admin-only) — accept/reject; on accept writes `route_alpha_history` and updates `routes.current_alpha`.
- `recompute-route-stats` (admin or cron) — refreshes confidence/sample_size on routes.

---

## 10. MVP vs Future Phases

**Phase A — Routes as first-class (foundation, no calibration yet)**
- `routes` table, migrate existing events to reference routes.
- Move `alpha`, distance, elevation, GPX from events → routes.
- `event_results` gets `route_id` + `scoring_formula_version=1`.
- Admin route CRUD page.
- Confirms reproducibility before any tuning logic ships.

**Phase B — Calibration MVP**
- `alpha_experiments` + `route_alpha_history`.
- `recommend-alpha` edge function with the per-runner residual method.
- Admin Calibration dashboard list + accept/reject.
- Manual "Re-analyze" only (no cron).

**Phase C — Polish**
- Scheduled weekly recompute.
- Route detail view with residual charts.
- Confidence visualization, history timeline.
- "Insufficient data" UX.

**Phase D — Scoring v2 hooks**
- `scoring_formula_versions` table.
- Versioned scoring engine (TS + SQL parity tests).
- Terrain/weather columns reserved but unused.

**Phase E — Advanced (only when data justifies)**
- Mixed-effects regression instead of residual medians.
- Per-surface baseline α priors.
- Optional ML model behind same `recommend-alpha` interface.

---

## 11. Simplifications & Risks

Simplifications taken:
- RPE bands instead of continuous regression — cheap, interpretable, good enough at small N.
- Median/winsorize instead of robust statistical models — no scipy needed.
- One route per event (not multi-distance events) — covered by current product.
- α only; no separate elevation-gain or pace coefficients yet.
- Residual method assumes runners' fitness is roughly stable across recent events; OK for a club, breaks if someone drastically improves mid-season — partly mitigated by cooling-off and band stratification.

Risks:
- **Cold start**: until ~20+ results per route exist, recommendations are silent. Communicate this clearly in the dashboard.
- **RPE honesty**: garbage in, garbage out. Add the RPE-vs-score sanity drop, and consider showing each runner their RPE distribution to encourage consistency.
- **Self-selection**: faster runners may avoid hard routes, biasing residuals. Repeat-runner requirement helps; surface_type-grouped baselines (Phase E) helps more.
- **Route changes**: if a real-world route changes (new detour), historical results become misleading. Mitigation: route versioning (`routes.parent_route_id`, "fork route" admin action) — Phase C+.
- **Score comparability across formula versions**: solved by pinning version per result and never silently recomputing.

---

**Open questions to confirm before Phase A:**
1. For existing events, do we auto-create a route per event, or have admins manually consolidate similar events into shared routes? (Recommend: auto-create, then admin merges.)
2. Should `runs` (casual logging) ever reference routes? (Recommend: no for MVP — routes are an event/calibration concept.)
3. Is α capped (e.g., 0–20) acceptable, or do you want unbounded? Cap is recommended to keep scores interpretable.
