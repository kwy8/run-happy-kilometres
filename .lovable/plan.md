## Issue 1 — RR not showing for kwy & Tian

**Root cause:** the DB trigger `recompute_event_result()` runs BEFORE INSERT/UPDATE on `event_results` and contains:

```sql
IF NEW.start_time IS NOT NULL AND NEW.finish_time IS NOT NULL THEN
  NEW.duration_s := EXTRACT(EPOCH FROM (NEW.finish_time - NEW.start_time))::integer;
ELSE
  NEW.duration_s := NULL;   -- wipes the value!
END IF;
```

Manual submissions send `duration_s` directly (no start/finish times) — the trigger immediately nulls it, so `performance_score` stays null. Both verified rows in the DB have `distance_m=5555`, `alpha_used=8`, `duration_s=null`.

**Fix (migration):**
- Rewrite `recompute_event_result()` so it only derives `duration_s` from start/finish when both are present, and otherwise **keeps the value the caller supplied** (or falls back to `submitted_duration_s`).
- Backfill: set `duration_s = submitted_duration_s` for any row where it's null, then re-trigger an UPDATE so `performance_score` recomputes.

## Issue 2 — Remove the Results section from the admin Timing page

Admin no longer needs to approve/reject. The "Results" card in `EventTiming.tsx` exists only for that workflow now and should be removed entirely. Keep:
- Route Parameters card (still needed)
- Add Result for Participant card (admin manual entry)

Also delete the now-unused helpers (`setResultStatus`, `approveAllPending`, status badge logic, inline edit fields, etc.).

## Issue 3 — Admin still needs a way to delete bad rows

(You mentioned this earlier re: the test "Sunday Run #4" entries.) Move that to the public participants table on `EventDetails.tsx`: when `isAdmin`, show a small **Delete** icon-button in each row. Replaces the removed "Verify" column.

## Other cleanup

- `SubmitResult.tsx` toast still says "An admin will verify it shortly" — change to "Result submitted! 🎉" since results auto-verify now.

## Files touched

```text
MIGRATE  fix recompute_event_result trigger; backfill duration_s & RR
EDIT     src/pages/EventTiming.tsx     (remove Results card + dead helpers)
EDIT     src/pages/EventDetails.tsx    (admin Delete button per participant)
EDIT     src/pages/SubmitResult.tsx    (update toast message)
```

No open questions — proceeding straight to implementation on approval.
