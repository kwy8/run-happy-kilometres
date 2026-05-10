## Goal

Remove QR-based timing from the app entirely. Keep manual submissions (time + optional RPE) and admin-entered results. RR auto-calculates on submit and on route alpha change.

## What gets removed

**Frontend**
- `src/pages/Scan.tsx` (QR scan page) — delete
- All QR-related UI in `src/pages/EventTiming.tsx`: QR enable toggle, token regenerate, downloadable start/finish QR images, scan URLs. Page becomes a pure admin results editor (add/edit/delete results for any participant).
- QR-related route in `src/App.tsx` (`/scan`).
- Any "Scan QR" buttons / links on `EventDetails.tsx`, `Dashboard.tsx`, nav.
- `SourceBadge` usage tied to qr/manual distinction (already hidden on EventDetails — remove file if no other consumers).

**Backend (edge functions)**
- Delete `supabase/functions/scan-event/`
- Delete `supabase/functions/regenerate-qr-tokens/`
- Keep `submit-manual-result`, `publish-event-results`, `recommend-alpha`, `apply-alpha-decision`.

**Database (migration)**
- `events` table: drop `qr_enabled`, `start_qr_token`, `finish_qr_token`.
- `event_results.source` column: keep for now (values become `'manual'` or `'admin'`) but drop the default `'qr'` and update existing `'qr'` rows to `'manual'`. Optional: drop column later — leaving it is harmless and avoids cascading code changes.
- Update RLS policy `Owners insert manual result` (already requires `source='manual'` — fine).
- Add admin-insert path: admins already have `Admins insert results` policy — no change needed.

## What gets added / changed

**Manual submission (existing `SubmitResult.tsx`)** — leave as-is per user request. It already sets `source='manual'`, `status='pending'`, captures duration + RPE.

**Admin manual entry on `EventTiming.tsx`** — replace the QR admin panel with:
- A table of participants with editable inline fields: distance (m), duration (mm:ss), RPE, notes, status (pending/verified/rejected).
- "Add result for participant" dropdown to create a row for any joined member who hasn't submitted.
- Save writes directly to `event_results` (admin RLS allows it). Existing `recompute_event_result` trigger recalculates `performance_score` automatically.

**Auto-RR recompute on route alpha change**
- Add a DB trigger on `routes` AFTER UPDATE OF `current_alpha`: for every `event_results` row whose `event_id` belongs to events with that `route_id`, copy the new alpha into `alpha_used`. The existing `recompute_event_result` BEFORE UPDATE trigger then refreshes `performance_score` automatically.
- On manual submit, the edge function should stamp `alpha_used` from the event's route's `current_alpha` (it likely already does — verify in implementation).

**Verification flow** — unchanged. Admin still verifies pending manual submissions on EventDetails (or in EventTiming).

## Files touched

```text
DELETE  src/pages/Scan.tsx
DELETE  supabase/functions/scan-event/
DELETE  supabase/functions/regenerate-qr-tokens/
EDIT    src/App.tsx                 (remove /scan route)
EDIT    src/pages/EventTiming.tsx   (replace QR panel with admin results editor)
EDIT    src/pages/EventDetails.tsx  (remove any "Scan" CTAs if present)
EDIT    src/pages/Dashboard.tsx     (remove QR CTAs if present)
EDIT    src/components/SourceBadge.tsx (delete if unused)
MIGRATE drop QR columns on events; backfill source='manual'; add route-alpha cascade trigger
```

## Open questions

1. **Existing QR results in the DB** — keep them (relabel `source` to `'manual'`) or delete them? Recommended: keep, since they have valid times.
2. **Admin manual entry UX**: inline-editable table on `EventTiming`, or a simple "Add result" modal per participant? I'd default to inline table for speed.

If you confirm both (keep historical rows; inline table), I'll implement straight through.
