# Bonus Challenge for Events

Let admins attach a fun 2-option pick to any event (e.g. "World Cup qualifier: Germany or Norway?"). Participants lock in their pick before the event starts. After the admin sets the correct answer, wrong pickers get a penalty distance (default 800m) added to the participant table display.

## User flow

**Admin (on event details / create event page)**
- Optional "Bonus Challenge" section: question, option A, option B, penalty meters (default 800).
- After the event, admin picks the correct answer from a dropdown. This locks results.

**Participant (on event details page)**
- If challenge exists and the meet-up time hasn't passed: see the question and two buttons to pick. Can change pick until lock time.
- After lock: pick is read-only; shows their choice.
- After correct answer set: each row shows a ✓ or ✗ next to the pick, and wrong pickers show `+800 m penalty` appended to their distance column.

## Scope rules

- Penalty is **display only** — appended visually to the distance cell on the EventDetails participants table. It does **not** modify `event_results.distance_m`, `performance_score`, leaderboards, stats, or scoring. (Matches the memory rule: scoring stays reproducible.)
- Picks lock at `event_date + meetup_time` (if no meetup_time set, lock at end of event_date).
- Only admins create/edit the challenge and set the correct answer.

## Technical changes

### Database (one migration)

New table `public.event_bonus_challenges`:
- `id`, `event_id` (unique, one challenge per event), `question` text, `option_a` text, `option_b` text, `correct_answer` text nullable (`'a'|'b'`), `penalty_m` int default 800, `created_at`, `updated_at`.
- Grants + RLS: authenticated SELECT; admins ALL.

New table `public.event_bonus_picks`:
- `id`, `event_id`, `user_id`, `pick` (`'a'|'b'`), `created_at`, `updated_at`.
- Unique `(event_id, user_id)`.
- Grants + RLS: authenticated SELECT (so everyone can see others' picks after lock); user can INSERT/UPDATE own row only if event's meet-up datetime is in the future (enforced via trigger checking `events.event_date`/`meetup_time`); admins ALL.

Both tables get `updated_at` trigger.

### Frontend

- `src/pages/CreateEvent.tsx`: add optional bonus-challenge fields (question, option A/B, penalty meters).
- `src/pages/EventDetails.tsx`:
  - Fetch challenge + picks alongside existing data (added to the existing `Promise.all`).
  - New `BonusChallenge` card above Participants: shows question, two pick buttons (or read-only state after lock), and admin-only correct-answer selector once locked.
  - In participants table: show pick badge (A/B + ✓/✗ once revealed). Distance cell appends ` +{penalty}m` for wrong pickers.
- Extend the existing `useRealtimeRefetch` subscription pattern for `event_bonus_picks` so picks update live.

### Non-goals

- No effect on `performance_score`, `casual_runs`, stats cards, or leaderboards.
- No notifications/emails (keep separate from the email-reminder discussion).
- No multi-option / free-form variants for now.
