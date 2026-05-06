# QR-Based Timing & Adjusted Performance — Architecture & Implementation Plan

## 1. Recommended Architecture

Keep the existing app intact (`runs`, `events`, `event_participants`, `profiles`, `user_roles`) and add a **parallel "official timing" layer** alongside it. Manual run logging stays as-is for casual/random runs; QR timing produces *event results* in a new dedicated table. The two never overwrite each other.

Modular boundaries:

```text
┌─ Casual logging (existing) ──────────┐    ┌─ Official QR timing (new) ─────────┐
│  runs, AddRun.tsx, Dashboard stats   │    │  event_results, scan-token edge fn │
└──────────────────────────────────────┘    │  scan pages, RPE form, results UI  │
                                            └────────────────────────────────────┘
                          ▲                                ▲
                          └────── shared: events, profiles, user_roles ──────┘

Future: Strava import → writes into event_results with source='strava' (no coupling to QR).
```

Key decisions:
- Server-authoritative timing via an **edge function** (`scan-event`). The browser never writes timestamps; it just calls the function with the scanned token.
- QR codes encode a URL like `/scan/<event_id>?t=<token>&p=start|finish` — the token is a 32-byte random secret stored on the event row.
- RPE never touches `performance_score`. It lives on `event_results` for personal interpretation and future calibration.
- Performance score is **computed in SQL** (generated column or trigger) so admins can't accidentally save inconsistent values.

## 2. Implementation Phases

**Phase 1 — Schema & QR foundations (MVP)**
- Migration: extend `events`, add `event_results`, `alpha_settings`.
- Edge function `scan-event` (start/finish, with token + state machine).
- Admin UI: enable QR on event, generate/regenerate tokens, view & download QR codes (PNG via `qrcode` npm pkg).
- Public route `/scan/:eventId` that calls the edge function and shows confirmation.

**Phase 2 — Results & RPE**
- After-finish RPE prompt (1–10 + notes).
- Admin page to enter route params (distance, elevation gain/loss, alpha) and publish results.
- Runner-facing results page (only when `results_published = true`).

**Phase 3 — Personal progress & interpretation**
- Compute interpretation labels client-side (or in a view) from latest vs. previous same-route result + RPE delta.
- Per-user history view filtered by route.

**Phase 4 — Admin corrections & status**
- Manual time edits, status transitions (verified / corrected / incomplete / disqualified), admin notes.
- `alpha_experiments` table + recompute-scores SQL function for calibration runs.

**Phase 5 (later, optional)** — Strava import as a separate edge function writing rows with `source='strava'`. No changes to QR code paths.

## 3. Database Design

Improvements over your draft: split route metadata from event metadata is **not** worth it yet (1 route per event); keep alpha on event AND snapshot `alpha_used` on the result so re-publishing alpha doesn't silently rewrite history. Use seconds (integer) everywhere for durations to avoid float drift. Drop `alpha_settings` table — a single `app_config` row or a default constant is enough until experiments start.

```text
events  (extend existing)
  + qr_enabled                boolean default false
  + start_qr_token            text     -- 32-byte url-safe random
  + finish_qr_token           text
  + qr_window_start           timestamptz null  -- optional scan window
  + qr_window_end             timestamptz null
  + route_distance_m          integer  null
  + route_elevation_gain_m    integer  null
  + route_elevation_loss_m    integer  null
  + alpha                     numeric  default 5
  + results_published         boolean  default false

event_results  (new)
  id                 uuid pk
  event_id           uuid not null  → events.id
  user_id            uuid not null
  source             text not null check (source in ('qr','manual','strava'))
  start_time         timestamptz null
  finish_time        timestamptz null
  duration_s         integer      null   -- generated: extract(epoch from finish-start)
  distance_m         integer      null   -- snapshot from event at publish time
  elevation_gain_m   integer      null
  elevation_loss_m   integer      null
  alpha_used         numeric      null
  performance_score  numeric      null   -- generated; null when inputs missing
  rpe                smallint     null check (rpe between 1 and 10)
  rpe_notes          text         null
  session_load       numeric      null   -- generated: (duration_s/60)*rpe
  progress_label     text         null   -- cached interpretation
  status             text not null default 'pending'
                       check (status in ('pending','verified','corrected','incomplete','disqualified'))
  admin_note         text null
  created_at, updated_at
  unique (event_id, user_id)             -- one official result per runner per event

alpha_experiments  (new, optional in Phase 4)
  id, name, alpha_value, description, start_date, end_date, notes, created_at
```

**Why generated columns**: prevents drift between stored score and inputs. Implemented as a trigger if Postgres `GENERATED` can't reference NULL-tolerant math, otherwise as a `BEFORE INSERT/UPDATE` trigger that recomputes `duration_s`, `performance_score`, `session_load`.

**Why keep `runs` separate**: casual runs (random Tuesday jog) don't belong in `event_results`. If admin wants to also count an event toward personal stats, an optional trigger can mirror a finished `event_result` into `runs` — but default off.

## 4. QR Flow Design

Each event with `qr_enabled = true` has 2 tokens:

```text
Start QR  →  https://app/scan/<event_id>?t=<start_token>&p=start
Finish QR →  https://app/scan/<event_id>?t=<finish_token>&p=finish
```

State machine per (event, user):
```text
none ──scan start──▶ started ──scan finish──▶ finished
              │                            │
              └─scan finish first──▶ rejected (finish before start)
              └─re-scan start──▶ ignored (already started, no overwrite)
```

Edge function `scan-event` does:
1. Validate JWT → get `user_id` (if missing, frontend redirects to `/auth?next=/scan/...`).
2. Load event by id, check `qr_enabled`, check token matches the right phase, check `now()` within `qr_window_*` if set.
3. Auto-insert into `event_participants` if not joined.
4. Upsert into `event_results`:
   - `p=start`: insert row with `start_time = now()` if none; if row exists with start, ignore (idempotent); if row has finish but no start → mark `status='incomplete'`.
   - `p=finish`: require existing start; set `finish_time = now()`. If `finish < start` → reject. If no start row → insert with `status='incomplete'`.
5. Return `{ status, start_time, finish_time, duration_s }` so the page can show confirmation.

Client `/scan/:eventId` page: minimal — spinner → outcome card → "Submit RPE" CTA when `finished`.

## 5. User Flows

**Runner — race day**
1. Opens camera, scans Start QR → if logged out, redirected through `/auth?next=...` then back.
2. Auto-joined to event. Sees "Started at 09:03:12. Have a great run!"
3. Crosses finish, scans Finish QR → "Finished. 32:14 elapsed."
4. Sees RPE prompt (1–10 + optional notes). Can skip.
5. Results hidden until admin publishes; receives a toast/notification when published.

**Runner — viewing**
- Event page shows their own pending result with status; full leaderboard appears once `results_published`.
- Personal progress section: latest vs previous result *on the same event/route*, with interpretation label.

## 6. Admin Flows

1. Create event → toggle "QR Timing". Tokens auto-generated; download/print Start + Finish QR PDFs.
2. After event: enter route distance, elevation gain (loss optional), confirm alpha.
3. Review results table:
   - Edit any `start_time` / `finish_time` (status auto → `corrected`).
   - Mark incomplete / disqualified.
   - Add admin note.
4. Click **Publish Results** → snapshots `distance_m`, `elevation_gain_m`, `alpha_used` into each row, recomputes scores, sets `results_published = true`.
5. Re-publishing after edits is allowed and snapshots again.

## 7. API / Backend Requirements

Edge functions (Lovable Cloud):
- `scan-event` (POST) — the core endpoint above.
- `publish-event-results` (POST, admin only) — snapshots route params + alpha into all rows, recomputes scores, flips `results_published`.
- `regenerate-qr-tokens` (POST, admin only) — replaces tokens (for leak recovery).

All other reads/writes use the supabase-js client + RLS.

## 8. Edge Cases & How They're Handled

| Case | Handling |
|---|---|
| Finish before start | Edge fn rejects with 409; result row marked `incomplete` if user insists. |
| Multiple start scans | Idempotent — first start wins, later scans return existing time. |
| Multiple finish scans | First finish wins; later scans return existing finish. |
| Forgotten finish | Row stays `started`; admin can manually enter finish or mark `incomplete`. |
| Scan outside `qr_window_*` | Edge fn returns 403; admin can still manual-enter. |
| Leaked token | Admin runs `regenerate-qr-tokens`; old QR stops working immediately. |
| Admin changes alpha after publish | Recompute happens only on next "Publish"; row's `alpha_used` remains until then (auditable). |
| Route data missing at publish | Publish blocked with clear error. |
| User not logged in | Scan page bounces through `/auth?next=` and resumes. |
| User not joined | Auto-joined on start scan. |
| RPE skipped | `rpe` stays null; interpretation simply omits effort comparison. |
| Duplicate scans / network retry | Edge fn is idempotent on (event, user, phase). |
| Network drop mid-scan | Frontend retries the same call; idempotent → safe. |

## 9. Security Considerations

- **Server-side timestamps only** — the edge function writes `now()`; client values are never trusted.
- **Tokens**: 32 bytes from `crypto.getRandomValues`, base64url-encoded. Stored on `events` row; never exposed except to admins (RLS column-level via a separate admin-only view, or just gate via existing `has_role(auth.uid(),'admin')`).
- **RLS on `event_results`**:
  - SELECT own row: `auth.uid() = user_id`.
  - SELECT all rows when `results_published = true` (join via security-definer function reading `events.results_published`).
  - SELECT all: admins.
  - INSERT/UPDATE: **forbidden from client**; only the edge function (service role) writes. Add a policy `WITH CHECK (false)` for non-admins to make this explicit. Admin manual edits go through admin-only UPDATE policy gated by `has_role(...,'admin')`.
  - UPDATE rpe by owner: narrow policy allowing only `rpe`, `rpe_notes` columns (enforced via a `BEFORE UPDATE` trigger that rejects changes to other fields when not admin).
- **Events**: token columns must not be readable by non-admins — wrap public event reads in a view that omits `*_qr_token`, or use column privileges.
- **HIBP password check**: enable in auth settings (independent improvement).

## 10. Future Scalability

- `alpha_experiments` + a `recompute_scores(experiment_id)` SQL function lets the club A/B different alphas without touching production data — write computed scores to a separate `event_result_score_runs` table when the time comes.
- `source` column on `event_results` is the seam for Strava (Phase 5) and future GPS watch imports — no schema change needed.
- A single `event_results` view per (user, route) is enough for personal trend charts; can later be a materialized view if event count grows.
- Interpretation logic stays in TS today; can move to a SQL function later if surfaced in admin analytics.

## 11. MVP Simplifications

For the very first ship, drop:
- `qr_window_start/end` (skip time-window enforcement; admin can disable QR after the event).
- `alpha_experiments` table (hardcode default alpha = 5, editable per event).
- Status values beyond `pending` / `verified` / `incomplete` (add `corrected`/`disqualified` in Phase 4).
- `progress_label` cached column (compute in the client from the last 2 same-event results).
- Strava anything.

That gets you: QR timing → results table → publish → personal "you vs last time" with RPE notes. ~2 migrations, 1 edge function, 3 new pages (admin QR panel, scan page, results page), 1 small RPE dialog.

---

**Open questions before building** (would be good to confirm during implementation kickoff, not now):
1. Should an "official" finished `event_result` also create a row in `runs` so it counts toward weekly km stats? (Recommend: yes, via trigger, with a flag to suppress.)
2. Are events always single-route, or could one event have multiple route options (e.g. 5k & 10k)? Plan above assumes single-route per event.
3. Do you want public results (anyone with the link) or always require login? Plan above keeps login-required.
