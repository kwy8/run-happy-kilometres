
ALTER VIEW public.events_public SET (security_invoker = true);

REVOKE SELECT ON public.event_bonus_challenges FROM authenticated;
GRANT SELECT (id, event_id, question, option_a, option_b, penalty_m, created_at, updated_at)
  ON public.event_bonus_challenges TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_bonus_challenges TO authenticated;
GRANT ALL ON public.event_bonus_challenges TO service_role;

CREATE OR REPLACE FUNCTION public.bonus_correct_answer(_event_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ans text;
  ev_date date;
  ev_time time;
  lock_at timestamptz;
BEGIN
  SELECT correct_answer INTO ans FROM public.event_bonus_challenges WHERE event_id = _event_id;
  IF ans IS NULL THEN RETURN NULL; END IF;
  IF public.has_role(auth.uid(), 'admin') THEN RETURN ans; END IF;
  SELECT event_date, meetup_time INTO ev_date, ev_time FROM public.events WHERE id = _event_id;
  IF ev_date IS NULL THEN RETURN NULL; END IF;
  lock_at := (ev_date + COALESCE(ev_time, time '23:59:59'))::timestamptz;
  IF now() >= lock_at THEN RETURN ans; END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.bonus_correct_answer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bonus_correct_answer(uuid) TO authenticated;

DROP POLICY IF EXISTS "Authenticated read picks" ON public.event_bonus_picks;
CREATE POLICY "Users see own or post-lock picks"
  ON public.event_bonus_picks
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_bonus_picks.event_id
        AND now() >= (e.event_date + COALESCE(e.meetup_time, time '23:59:59'))::timestamptz
    )
  );

DROP POLICY IF EXISTS "Result proofs publicly readable" ON storage.objects;
CREATE POLICY "Result proofs readable by owner or admin"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'result-proofs'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can upload run photos" ON storage.objects;
CREATE POLICY "Users upload own run photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'run-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Anyone can view run photos" ON storage.objects;
CREATE POLICY "Owners or admins list run photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'run-photos'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "Anyone can view gpx files" ON storage.objects;
CREATE POLICY "Admins list gpx files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'gpx-files'
    AND public.has_role(auth.uid(), 'admin')
  );

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cascade_route_alpha_to_results() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_results_owner_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_bonus_pick_lock_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.event_results_published(uuid) FROM PUBLIC, anon;
