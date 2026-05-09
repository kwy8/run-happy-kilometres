
-- 1. Extend event_results
ALTER TABLE public.event_results
  ADD COLUMN IF NOT EXISTS proof_image_url text,
  ADD COLUMN IF NOT EXISTS submitted_duration_s integer,
  ADD COLUMN IF NOT EXISTS notes text;

-- Unique constraint to support upsert on (event_id, user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_results_event_user_unique'
  ) THEN
    ALTER TABLE public.event_results
      ADD CONSTRAINT event_results_event_user_unique UNIQUE (event_id, user_id);
  END IF;
END $$;

-- 2. Extend owner guard to allow notes/proof_image_url updates
CREATE OR REPLACE FUNCTION public.event_results_owner_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.event_id IS DISTINCT FROM OLD.event_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.start_time IS DISTINCT FROM OLD.start_time
       OR NEW.finish_time IS DISTINCT FROM OLD.finish_time
       OR NEW.distance_m IS DISTINCT FROM OLD.distance_m
       OR NEW.elevation_gain_m IS DISTINCT FROM OLD.elevation_gain_m
       OR NEW.elevation_loss_m IS DISTINCT FROM OLD.elevation_loss_m
       OR NEW.alpha_used IS DISTINCT FROM OLD.alpha_used
       OR NEW.submitted_duration_s IS DISTINCT FROM OLD.submitted_duration_s
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.admin_note IS DISTINCT FROM OLD.admin_note THEN
      RAISE EXCEPTION 'owners may only update RPE, notes and proof fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS event_results_owner_guard_trg ON public.event_results;
CREATE TRIGGER event_results_owner_guard_trg
  BEFORE UPDATE ON public.event_results
  FOR EACH ROW EXECUTE FUNCTION public.event_results_owner_guard();

-- Make sure recompute trigger exists
DROP TRIGGER IF EXISTS recompute_event_result_trg ON public.event_results;
CREATE TRIGGER recompute_event_result_trg
  BEFORE INSERT OR UPDATE ON public.event_results
  FOR EACH ROW EXECUTE FUNCTION public.recompute_event_result();

-- Owners can INSERT a manual row for themselves (only when none exists)
DROP POLICY IF EXISTS "Owners insert manual result" ON public.event_results;
CREATE POLICY "Owners insert manual result"
ON public.event_results
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND source = 'manual'
  AND status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.event_results er2
    WHERE er2.event_id = event_results.event_id
      AND er2.user_id = event_results.user_id
  )
);

-- 3. casual_runs table
CREATE TABLE IF NOT EXISTS public.casual_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  route_name text NOT NULL,
  terrain_type surface_type NOT NULL DEFAULT 'road',
  distance_m integer NOT NULL,
  elevation_gain_m integer NOT NULL DEFAULT 0,
  elevation_loss_m integer,
  alpha_used numeric NOT NULL DEFAULT 5,
  duration_s integer NOT NULL,
  performance_score numeric,
  rpe smallint,
  notes text,
  weather_notes text,
  included_in_calibration boolean NOT NULL DEFAULT false,
  scoring_formula_version smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.casual_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage casual runs" ON public.casual_runs;
CREATE POLICY "Admins manage casual runs"
ON public.casual_runs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.recompute_casual_run()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.duration_s IS NOT NULL AND NEW.duration_s > 0
     AND NEW.distance_m IS NOT NULL AND NEW.distance_m > 0
     AND NEW.alpha_used IS NOT NULL THEN
    NEW.performance_score :=
      (NEW.distance_m::numeric / NEW.duration_s)
      * (1 + NEW.alpha_used * (COALESCE(NEW.elevation_gain_m, 0)::numeric / NEW.distance_m));
  ELSE
    NEW.performance_score := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS recompute_casual_run_trg ON public.casual_runs;
CREATE TRIGGER recompute_casual_run_trg
  BEFORE INSERT OR UPDATE ON public.casual_runs
  FOR EACH ROW EXECUTE FUNCTION public.recompute_casual_run();

-- 4. Storage bucket for manual-submission proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('result-proofs', 'result-proofs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Result proofs publicly readable" ON storage.objects;
CREATE POLICY "Result proofs publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'result-proofs');

DROP POLICY IF EXISTS "Users upload own result proofs" ON storage.objects;
CREATE POLICY "Users upload own result proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'result-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users update own result proofs" ON storage.objects;
CREATE POLICY "Users update own result proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'result-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users delete own result proofs" ON storage.objects;
CREATE POLICY "Users delete own result proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'result-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
