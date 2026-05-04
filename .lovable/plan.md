## Goal
Enhance the "Latest vs Previous Run" card on the Dashboard with richer comparisons (Distance, Duration, Pace) and clear visual cues showing whether each metric improved, regressed, or stayed flat.

## Scope
- File: `src/pages/Dashboard.tsx` (only)
- No DB changes, no new dependencies (lucide-react `ArrowUp`/`ArrowDown`/`Minus` already available)
- Skip PB and 4-week rolling average per your direction

## New comparison card design

Replace the current two-column block with a 3-row metric comparison table:

```text
                  Latest          Previous         Change
Distance          5.2 km          4.8 km           ↑ +0.4 km   (green)
Duration          28:30           27:00            ↓ +1:30      (red — slower)
Pace              5:29 /km        5:37 /km         ↑ -0:08 /km (green — faster)
```

Header row above shows the two run dates.

### Visual cue rules
- **Distance**: more = better → green ↑, less = red ↓
- **Duration**: alone it's neutral (longer can mean longer run). Show delta but color it neutral (muted) — only meaningful alongside distance.
- **Pace** (min/km): lower = better → green ↑ when faster, red ↓ when slower
- Equal values → muted `Minus` icon, "No change"
- Missing data on either side → render `—` and skip the cue
- Use existing semantic tokens: `text-primary` (warm coral) for positive, `text-destructive` for negative, `text-muted-foreground` for neutral. No hardcoded colors.

### Edge cases handled
- Only one run logged → keep current "No previous run yet" empty state
- Latest or previous run missing `time_taken_minutes` → Duration and Pace rows show `—` and no delta
- `distance_km` of 0 (shouldn't happen but) → guard pace calc to avoid div-by-zero (already partially done)

## Implementation notes (technical)
- Build a small inline helper `compareMetric(latest, previous, { lowerIsBetter })` that returns `{ delta, direction: 'up'|'down'|'flat'|'na', tone: 'positive'|'negative'|'neutral' }`.
- Format deltas using existing `formatMinSec` (for duration & pace deltas; sign prefix added manually).
- Render with `framer-motion` fade-in consistent with rest of dashboard.
- Keep the card title "Latest vs Previous Run".

## Out of scope (per your call)
- Personal best comparison
- 4-week rolling average
- Strava / Apple Health integration
