CREATE OR REPLACE FUNCTION public.recompute_event_result()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Derive duration from start/finish only when both present.
  -- Otherwise preserve the value the caller supplied (or fall back to submitted_duration_s).
  IF NEW.start_time IS NOT NULL AND NEW.finish_time IS NOT NULL THEN
    NEW.duration_s := GREATEST(0, EXTRACT(EPOCH FROM (NEW.finish_time - NEW.start_time))::integer);
  ELSIF NEW.duration_s IS NULL AND NEW.submitted_duration_s IS NOT NULL THEN
    NEW.duration_s := NEW.submitted_duration_s;
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
$function$;