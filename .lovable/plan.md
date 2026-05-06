## Goal

1. Give every user a dedicated page showing the full history of all their runs (casual + official).
2. Rebuild the leaderboard around the new performance score, branded as **Run Rating (RR)**, with multiple ranking tabs.

---

## 1. Profile page (`/profile`)

New route + nav link ("Profile") in `AppLayout`.

**Header**
- Display name, member-since date, opt-in leaderboard toggle (moved from Dashboard so the Dashboard stays focused on "what's next").
- Lifetime stats row: Total km · Total runs · Best RR · Avg RR (last 4).

**Run history**
- Single unified table, newest first, merging:
  - `runs` (casual) — labeled "Casual"
  - `event_results` where `status = 'verified'` — labeled with the event title
- Columns: Date · Type/Event · Distance · Time · Pace · RR (only for official rows).
- Filters: All / Casual / Official. Simple client-side pagination (20 per page).
- Click an official row → navigates to that event page.

The existing "Recent runs" card on the Dashboard stays but is trimmed to the latest 5 with a "View full history" link to `/profile`.

---

## 2. Leaderboard rework — "Run Rating (RR)"

Rename the performance score everywhere user-facing to **Run Rating** (abbrev. **RR**). Internal column names (`performance_score`) stay unchanged. Add a small tooltip / info popover explaining: *"RR adjusts pace for elevation using the route's calibrated alpha. Higher = better."*

Leaderboard becomes tabbed (shadcn `Tabs`):

1. **Best RR** — each opted-in runner's single highest RR across all verified `event_results`. Columns: # · Name · Best RR · Event · Date.
2. **Avg RR (last 4)** — average RR of the runner's 4 most recent verified results (requires ≥1; runners with fewer results still listed but sorted last). Columns: # · Name · Avg RR · Results counted.
3. **Total Distance** — current behavior (km + runs + fastest pace) preserved as the "all-time effort" view.

Only profiles with `show_on_leaderboard = true` appear in any tab.

Visuals: top-3 rows get a subtle coral/orange accent + medal icon; consistent with existing minimalist warm-sunrise style.

---

## Technical details

- **New file**: `src/pages/Profile.tsx`. Route added in `src/App.tsx`. Nav entry in `src/components/AppLayout.tsx`.
- **Leaderboard.tsx**: refactor into three tab components fed by one fetch. Pull `event_results` (verified, score not null) joined with `events(title, event_date)` for opted-in users (filter via profiles list). Cap query and aggregate client-side — small club, fine for now.
- **Score helper**: `src/lib/score.ts` exporting `formatRR(score)` (e.g. `(score * 60).toFixed(1)` → display as "12.4 RR" — pick a friendly scale during build) and the tooltip copy, so naming is consistent across Dashboard, EventDetails, Profile, Leaderboard.
- **Dashboard.tsx**: trim run list to 5 + "View full history" link; remove the leaderboard-toggle Switch (now on Profile).
- **EventDetails.tsx**: relabel "Score" column header to "RR".
- No DB migrations needed — all data already exists in `runs` and `event_results`.

---

## Out of scope

- Changing how RR is calculated (formula stays in `recompute_event_result`).
- Backfilling RR for casual `runs` (they remain RR-less by design — no calibrated alpha).
