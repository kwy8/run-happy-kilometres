## What's actually happening

**1. "Approved results don't show up on the event page or profile"**

Two separate data tracks exist and they don't talk to each other:

- **`runs`** — casual self-logged runs. Used by Dashboard (recent runs, stats) and the EventDetails participants table.
- **`event_results`** — QR-timed results with `status = pending → verified`. Used by the admin Timing page and (eventually) the published leaderboard.

Today, when an admin approves an `event_results` row:
- ✅ Its status flips to `verified` in the timing dashboard.
- ❌ The event page (`EventDetails.tsx`) only reads from `runs`, so the verified time/distance never appears there.
- ❌ The Dashboard only reads from `runs`, so the runner doesn't see the event in their recent activity / stats.
- ❌ Even the timing page itself doesn't auto-refresh — you have to reload to see another admin's change.

So "it isn't updating" is correct — nothing wires verified `event_results` into the runner-facing surfaces.

**2. "What if a runner scans a QR without an account?"**

Right now `Scan.tsx` redirects them to `/auth?next=/scan/...`, which shows the **login** form by default. They can toggle to "Sign up" but there's no nudge, and no message explaining why they landed on a login page mid-scan. After signing up they'd hit the same scan URL and it would work — but the flow is unfriendly and unclear, which matches your earlier complaint about "why am I on the Lovable login page".

---

## Plan

### A. Make verified results visible everywhere

**`src/pages/EventDetails.tsx` — Participants table reads from `event_results` (verified) first, falls back to `runs`**

- Fetch `event_results` for the event with `status = 'verified'` alongside `runs`.
- For each participant, prefer the verified QR result (duration → time, distance from event/route) over any casual `runs` row.
- Add a small badge next to the time: **"Official"** (sage) when from `event_results`, plain when from `runs`.
- Sort participants by official time ascending when present.

**`src/pages/Dashboard.tsx` — Recent activity includes verified event results**

- In addition to `runs`, fetch the user's `event_results` where `status = 'verified'`, joined with `events.title`.
- Merge into one chronological "Recent activity" list, with event results shown as `🏁 {event title} — {duration}` styled distinctly from casual runs.
- Stats cards already aggregate `runs`; we'll leave personal stats unchanged for now (event results are official-only and shouldn't double-count). Will revisit if you want them folded in.

**Realtime auto-refresh on three pages**

Add a tiny `useRealtimeRefetch(table, refetchFn)` hook (subscribe to `postgres_changes` on `event_results`, call refetch on any change, cleanup on unmount). Wire it into:
- `EventTiming.tsx` — so admins see each others' approvals instantly.
- `EventDetails.tsx` — so participants see official times appear when admin approves.
- `Dashboard.tsx` — so a runner sees their own approval land.

Enable realtime via migration:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_results;
```

### B. Friendlier first-time scan flow

**`src/pages/Auth.tsx`**
- Read `?next=` and detect when it points at `/scan/...`. If so, show a banner at the top:
  > *You're being checked in for an event. Sign in or create an account to record your time.*
- Default the form to **Sign up** (not Sign in) when arriving from a scan link, since a brand-new runner is the more likely case. Toggle still available.
- After successful signup, redirect to `next` exactly as today (already works).

**`src/pages/Scan.tsx`**
- Before redirecting to `/auth`, append `&newRunner=1` so the auth page knows to default to Sign up.

No backend or RLS changes needed for this part — `handle_new_user` already provisions a profile on signup, and the existing `/scan/.../?t=...` URL is reusable post-signup.

### Out of scope
- Folding `event_results` into personal stats / leaderboard scoring (separate decision — your memory says leaderboards are strictly opt-in and QR results currently feed scoring via `event_results.performance_score`, untouched here).
- Email magic-link or passwordless flows for first-time scanners.
- Automatic profile creation for an *unauthenticated* scan (would require a guest-token flow — flagging as a future option if you want it).

### Files touched
- `src/pages/EventDetails.tsx` — read verified `event_results`, "Official" badge, official-time sort.
- `src/pages/Dashboard.tsx` — merge verified `event_results` into recent activity.
- `src/pages/EventTiming.tsx` — realtime auto-refresh.
- `src/pages/Auth.tsx` — scan-aware banner + default-to-signup.
- `src/pages/Scan.tsx` — pass `newRunner=1` on auth redirect.
- `src/hooks/useRealtimeRefetch.ts` *(new, ~20 lines)*.
- One migration to add `event_results` to the realtime publication.
