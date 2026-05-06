
-- Extend events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS qr_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS start_qr_token text,
  ADD COLUMN IF NOT EXISTS finish_qr_token text,
  ADD COLUMN IF NOT EXISTS route_distance_m integer,
  ADD COLUMN IF NOT EXISTS route_elevation_gain_m integer,
  ADD COLUMN IF NOT EXISTS route_elevation_loss_m integer,
  ADD COLUMN IF NOT EXISTS alpha numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS results_published boolean NOT NULL DEFAULT false;

-- event_results table
CREATE TABLE IF NOT EXISTS public.event_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'qr' CHECK (source IN ('qr','manual','strava')),
  start_time timestamptz,
  finish_time timestamptz,
  duration_s integer,
  distance_m integer,
  elevation_gain_m integer,
  elevation_loss_m integer,
  alpha_used numeric,
  performance_score numeric,
  rpe smallint CHECK (rpe BETWEEN 1 AND 10),
  rpe_notes text,
  session_load numeric,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','incomplete','corrected','disqualified')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- Recompute trigger
CREATE OR REPLACE FUNCTION public.recompute_event_result()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.finish_time IS NOT NULL THEN
    NEW.duration_s := GREATEST(0, EXTRACT(EPOCH FROM (NEW.finish_time - NEW.start_time))::integer);
  ELSE
    NEW.duration_s := NULL;
  END IF;

  IF NEW.duration_s IS NOT NULL AND NEW.duration_s > 0
     AND NEW.distance_m IS NOT NULL AND NEW.distance_m > 0
     AND NEW.alpha_used IS NOT NULL THEN
    NEW.performance_score :=
      (NEW.distance_m::numeric / NEW.duration_s)
      * (1 + NEW.alpha_used * (COALESCE(NEW.elevation_gain_m, 0)::numeric / NEW.distance_m));
  ELSE
    NEW.performance_score := NULL;
  END IF;

  IF NEW.duration_s IS NOT NULL AND NEW.rpe IS NOT NULL THEN
    NEW.session_load := (NEW.duration_s::numeric / 60) * NEW.rpe;
  ELSE
    NEW.session_load := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_event_result ON public.event_results;
CREATE TRIGGER trg_recompute_event_result
BEFORE INSERT OR UPDATE ON public.event_results
FOR EACH ROW EXECUTE FUNCTION public.recompute_event_result();

-- Owner-only-rpe trigger: non-admin users can only modify rpe/rpe_notes
CREATE OR REPLACE FUNCTION public.event_results_owner_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service role / triggers
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  -- Only allow rpe & rpe_notes to change for owner
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.start_time IS DISTINCT FROM OLD.start_time
     OR NEW.finish_time IS DISTINCT FROM OLD.finish_time
     OR NEW.distance_m IS DISTINCT FROM OLD.distance_m
     OR NEW.elevation_gain_m IS DISTINCT FROM OLD.elevation_gain_m
     OR NEW.elevation_loss_m IS DISTINCT FROM OLD.elevation_loss_m
     OR NEW.alpha_used IS DISTINCT FROM OLD.alpha_used
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.admin_note IS DISTINCT FROM OLD.admin_note THEN
    RAISE EXCEPTION 'owners may only update RPE fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_results_owner_guard ON public.event_results;
CREATE TRIGGER trg_event_results_owner_guard
BEFORE UPDATE ON public.event_results
FOR EACH ROW EXECUTE FUNCTION public.event_results_owner_guard();

-- RLS
ALTER TABLE public.event_results ENABLE ROW LEVEL SECURITY;

-- Helper: is this event's results published?
CREATE OR REPLACE FUNCTION public.event_results_published(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT results_published FROM public.events WHERE id = _event_id), false)
$$;

DROP POLICY IF EXISTS "View own result" ON public.event_results;
CREATE POLICY "View own result" ON public.event_results
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "View published results" ON public.event_results;
CREATE POLICY "View published results" ON public.event_results
FOR SELECT TO authenticated
USING (public.event_results_published(event_id));

DROP POLICY IF EXISTS "Admins view all results" ON public.event_results;
CREATE POLICY "Admins view all results" ON public.event_results
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins insert results" ON public.event_results;
CREATE POLICY "Admins insert results" ON public.event_results
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update results" ON public.event_results;
CREATE POLICY "Admins update results" ON public.event_results
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete results" ON public.event_results;
CREATE POLICY "Admins delete results" ON public.event_results
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Owners can update their own row (the trigger restricts which columns)
DROP POLICY IF EXISTS "Owners update RPE" ON public.event_results;
CREATE POLICY "Owners update RPE" ON public.event_results
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Public-safe events view (omits QR tokens)
CREATE OR REPLACE VIEW public.events_public AS
SELECT
  id, title, event_date, route, location, created_by, created_at,
  gpx_file_url, meetup_time, qr_enabled,
  route_distance_m, route_elevation_gain_m, route_elevation_loss_m,
  alpha, results_published
FROM public.events;

GRANT SELECT ON public.events_public TO authenticated, anon;
