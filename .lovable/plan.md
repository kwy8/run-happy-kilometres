## Diagnostics summary

- The dashboard itself is not CPU-heavy: ~226ms script time, small DOM, low memory, no console errors.
- The visible delay is data loading: five dashboard database reads took ~4.4s and admin role lookup took ~5.7s.
- The dashboard currently fetches data twice on first load because `isAdmin` changes after auth, causing the main dashboard `useEffect` to run once before admin is known and again after.
- Some reads are broader than needed: `runs` on Dashboard is not filtered by current user, and result/history queries do not have optimal query indexes for the filters being used.
- Backend status is up, but the DB health endpoint timed out once, so code should reduce unnecessary database pressure rather than relying on retries.

## Fix plan

1. **Stop duplicate dashboard loads**
   - Update auth state so the app knows when the admin role check is complete.
   - On Dashboard/Profile, wait for auth + admin status to settle before fetching admin-dependent data.
   - This prevents the initial double fetch visible in the network trace.

2. **Tighten dashboard queries**
   - Filter legacy `runs` by the current user on Dashboard, matching Profile.
   - Add small limits/order to history sources where Dashboard only needs summary/latest values.
   - Keep casual admin runs included for admins only, as requested previously.

3. **Make realtime refetch stable**
   - Ensure realtime subscriptions don’t capture stale callbacks and don’t accidentally refetch with old state.
   - Keep the existing behavior of refreshing when event results change.

4. **Add database indexes for the slow read patterns**
   - `runs(user_id, run_date desc)` for personal run history/dashboard reads.
   - `event_results(user_id, status)` for verified result reads.
   - `events(event_date)` for upcoming event lookup.
   - `casual_runs(user_id, created_at desc)` for admin-added casual run history.
   - These are additive performance indexes only; no data model or access rule changes.

5. **Validate after implementation**
   - Re-run browser performance/network diagnostics on `/dashboard`.
   - Confirm only one initial dashboard data batch runs and that the page no longer waits on duplicated reads.