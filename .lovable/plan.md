# Editable Routes + Live Start-Scan Welcome Page

Two small additions to existing pages — no schema changes.

## 1. Edit routes from the calibration dashboard

Currently the "Edit" dialog at `/admin/calibration` only lets admins override α. Expand it to a full route editor.

Editable fields (all already on the `routes` table):
- name, description
- distance_m, elevation_gain_m, elevation_loss_m
- surface_type (road / trail / mixed / track / gravel)
- technicality_rating (1–5)
- terrain_notes

Behaviour:
- Open the same dialog from the existing **Edit** button on each row.
- Two clear sections: "Route details" (the fields above) and "Alpha controls" (the existing manual override / reset / mark calibrated / accept-reject).
- Saving route details is a plain `supabase.from("routes").update(...)` — no new edge function needed.
- α changes still go through `apply-alpha-decision` so they're audited in `route_alpha_history`.

## 2. Welcome / live-timer page after scanning the Start QR

Today `Scan.tsx` shows a one-shot confirmation card. Replace the **start** branch with a richer welcome screen:

```text
┌─────────────────────────────────────┐
│  ✓ You're in!                       │
│  [Event title]                      │
│  Welcome, [display_name]            │
│                                     │
│           00 : 12 : 47              │  ← counts up live (mm:ss or hh:mm:ss)
│           ELAPSED                   │
│                                     │
│  Started at 09:03:12                │
│  Scan the Finish QR when you're     │
│  done.                              │
│                                     │
│  [ Back to event ]                  │
└─────────────────────────────────────┘
```

Implementation notes:
- After `scan-event` returns `start_time`, store it and run a `setInterval(…, 1000)` that computes `now() - start_time`.
- Show `hh:mm:ss` once elapsed ≥ 1 hour, else `mm:ss`.
- Idempotent re-scans (`already_started`) use the existing `start_time` from the response so the timer keeps the original elapsed value.
- Minimal style: large tabular-nums monospace number, coral accent, framer-motion fade-in on mount (matches the warm-sunrise aesthetic).
- Finish-scan branch stays as-is (shows final elapsed + RPE prompt).
- Page stops the interval on unmount.

## Out of scope
- No timer pings server (purely client-side count-up; server `start_time` is the source of truth).
- No push notifications.
- No changes to the scan edge function or QR generation.

## Files touched
- `src/pages/AdminCalibration.tsx` — extend the edit dialog with route-detail fields and a save handler.
- `src/pages/Scan.tsx` — split start vs finish UI; add live elapsed timer for start.
