# Result approval + QR landing previews

Two small additions to the timing flow.

## 1. Approve / reject results

**Why it says "pending"**: when a runner scans Start then Finish, `scan-event` writes the result with `status = 'pending'`. That's by design — it means "timed, waiting for admin sign-off". Today nothing in the UI lets you advance it. We'll add that.

Status lifecycle:

```text
pending      → both scans recorded, awaiting admin review
verified     → admin approved (counts toward leaderboards / scoring)
incomplete   → only one scan (start OR finish), needs admin decision
disqualified → admin marked invalid (won't count)
```

### Changes

- **`src/pages/EventTiming.tsx`** — in the Results table, add an Actions column with:
  - `pending` row → **Approve** (→ `verified`) and **Disqualify** buttons
  - `incomplete` row → **Approve as-is**, **Disqualify**, plus an inline "set missing time" mini-form (datetime input for whichever of start/finish is missing) — saving recomputes duration via the existing `recompute_event_result` trigger
  - `verified` / `disqualified` row → **Revert to pending**
  - Status displayed as a coloured badge (sage = verified, coral = pending, muted = disqualified, amber = incomplete)
- All actions are plain `supabase.from("event_results").update({ status, [start_time|finish_time] })` — admin RLS already permits this, and the existing `recompute_event_result` trigger recomputes `duration_s`, `performance_score`, `session_load`.
- Bulk action: an **"Approve all pending"** button above the table for the common case.
- Publishing already exists; we'll surface a small hint: "Only verified results appear in published standings" and (optionally) filter the published view to `status = 'verified'` later — out of scope for this change.

### No schema changes
The `status` column and admin RLS already support all of this.

## 2. Preview the scan landing pages

**Why a preview is needed**: visiting the real `/scan/...?t=...` URL writes a real `event_results` row and consumes your start/finish. We need a non-destructive way for an admin to see exactly what runners see.

### Approach: `?preview=1` flag on `/scan`

- In `src/pages/Scan.tsx`, if `searchParams.get("preview") === "1"` AND the user `isAdmin`:
  - **Skip** the `scan-event` edge function call entirely
  - Synthesise local mock data:
    - `start` preview → `startTime = new Date()`, live timer counts up from 0 in real time (so the admin sees the welcome page + ticking clock animating exactly as a runner would)
    - `finish` preview → `finishDuration = 1847` (≈ 30:47), `resultId = null` so the RPE button is hidden
  - Show a small dismissable banner at the top: *"Preview mode — nothing is being recorded."*
- Non-admins hitting `?preview=1` get the normal scan flow (no privilege leak).

### Entry points in `src/pages/EventTiming.tsx`

Under each QR code, alongside the existing **Download** button, add **Preview** buttons:

```text
[ Download ]  [ Preview start landing ↗ ]
[ Download ]  [ Preview finish landing ↗ ]
```

They open `/scan/:eventId?p=start&preview=1` (and `p=finish`) in a new tab. No `t=` token needed since the edge function isn't called.

## Out of scope
- Auto-verifying results (e.g. by RPE or duration sanity checks) — admins approve manually for now
- Filtering published results to `verified` only — discuss separately
- Email/notification when a result is approved
- Bulk-import or CSV upload for incomplete fix-ups

## Files touched
- `src/pages/EventTiming.tsx` — actions column, approve/disqualify/revert buttons, inline missing-time form, status badges, "Approve all pending", "Preview" links under each QR
- `src/pages/Scan.tsx` — admin-only `?preview=1` short-circuit with mock state and a "Preview mode" banner
