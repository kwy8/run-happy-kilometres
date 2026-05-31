CREATE INDEX IF NOT EXISTS idx_runs_user_date ON public.runs (user_id, run_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_results_user_status ON public.event_results (user_id, status);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events (event_date);
CREATE INDEX IF NOT EXISTS idx_casual_runs_user_created ON public.casual_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON public.event_participants (user_id);