CREATE INDEX IF NOT EXISTS idx_event_participants_event_user
ON public.event_participants (event_id, user_id);

CREATE INDEX IF NOT EXISTS idx_event_results_event_user
ON public.event_results (event_id, user_id);

CREATE INDEX IF NOT EXISTS idx_event_results_event_status
ON public.event_results (event_id, status);

CREATE INDEX IF NOT EXISTS idx_runs_event_user
ON public.runs (event_id, user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_leaderboard_user
ON public.profiles (show_on_leaderboard, user_id)
WHERE show_on_leaderboard = true;

CREATE INDEX IF NOT EXISTS idx_event_bonus_picks_event_user
ON public.event_bonus_picks (event_id, user_id);
