
DROP VIEW IF EXISTS public.routes_public;
CREATE VIEW public.routes_public
WITH (security_invoker = true) AS
SELECT id, name, description, distance_m, elevation_gain_m, elevation_loss_m,
       surface_type, technicality_rating, terrain_notes, gpx_file_url,
       current_alpha, alpha_status, created_at, updated_at
FROM public.routes;

CREATE OR REPLACE FUNCTION public.route_alpha_history_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'route_alpha_history is append-only';
END;
$$;
