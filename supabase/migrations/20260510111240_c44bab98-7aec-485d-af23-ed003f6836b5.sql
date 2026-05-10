
UPDATE public.event_results SET source = 'manual' WHERE source = 'qr';

DROP VIEW IF EXISTS public.events_public;

ALTER TABLE public.events
  DROP COLUMN IF EXISTS qr_enabled,
  DROP COLUMN IF EXISTS start_qr_token,
  DROP COLUMN IF EXISTS finish_qr_token;

CREATE VIEW public.events_public AS
SELECT id, title, event_date, route, location, created_by, created_at,
       gpx_file_url, meetup_time, route_distance_m, route_elevation_gain_m,
       route_elevation_loss_m, alpha, results_published
FROM public.events;

ALTER TABLE public.event_results ALTER COLUMN source SET DEFAULT 'manual';

CREATE OR REPLACE FUNCTION public.cascade_route_alpha_to_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_alpha IS DISTINCT FROM OLD.current_alpha THEN
    UPDATE public.event_results er
    SET alpha_used = NEW.current_alpha
    FROM public.events e
    WHERE er.event_id = e.id
      AND e.route_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS routes_alpha_cascade ON public.routes;
CREATE TRIGGER routes_alpha_cascade
AFTER UPDATE OF current_alpha ON public.routes
FOR EACH ROW
EXECUTE FUNCTION public.cascade_route_alpha_to_results();

DROP TRIGGER IF EXISTS event_results_recompute ON public.event_results;
CREATE TRIGGER event_results_recompute
BEFORE INSERT OR UPDATE ON public.event_results
FOR EACH ROW
EXECUTE FUNCTION public.recompute_event_result();
