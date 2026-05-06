
-- Enums
CREATE TYPE public.surface_type AS ENUM ('road','trail','mixed','track','gravel');
CREATE TYPE public.alpha_status AS ENUM ('default','testing','calibrated','needs_review');
CREATE TYPE public.alpha_history_source AS ENUM ('manual','experiment','reset');
CREATE TYPE public.experiment_status AS ENUM ('proposed','testing','approved','rejected','archived');

-- routes
CREATE TABLE public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  distance_m integer,
  elevation_gain_m integer,
  elevation_loss_m integer,
  surface_type public.surface_type NOT NULL DEFAULT 'road',
  technicality_rating smallint CHECK (technicality_rating BETWEEN 1 AND 5),
  terrain_notes text,
  gpx_file_url text,
  current_alpha numeric NOT NULL DEFAULT 5,
  suggested_alpha numeric,
  alpha_status public.alpha_status NOT NULL DEFAULT 'default',
  calibration_confidence numeric,
  calibration_sample_size integer NOT NULL DEFAULT 0,
  alpha_last_updated_at timestamptz,
  alpha_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER routes_set_updated_at
BEFORE UPDATE ON public.routes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

-- Public-safe view (omits calibration internals)
CREATE OR REPLACE VIEW public.routes_public AS
SELECT id, name, description, distance_m, elevation_gain_m, elevation_loss_m,
       surface_type, technicality_rating, terrain_notes, gpx_file_url,
       current_alpha, alpha_status, created_at, updated_at
FROM public.routes;

-- RLS: admins full access; non-admins read full row blocked, but routes_public exposes safe cols
CREATE POLICY "Admins manage routes" ON public.routes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Authenticated read basic route fields" ON public.routes
  FOR SELECT TO authenticated USING (true);
-- Note: column-level hiding handled in app via routes_public view; RLS row-level still allows read,
-- but the app should query routes_public for non-admin contexts. Admin pages query routes directly.

-- route_alpha_history
CREATE TABLE public.route_alpha_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  previous_alpha numeric,
  new_alpha numeric NOT NULL,
  source public.alpha_history_source NOT NULL,
  experiment_id uuid,
  changed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.route_alpha_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read history" ON public.route_alpha_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert history" ON public.route_alpha_history
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Append-only guard
CREATE OR REPLACE FUNCTION public.route_alpha_history_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'route_alpha_history is append-only';
END;
$$;
CREATE TRIGGER route_alpha_history_no_update BEFORE UPDATE ON public.route_alpha_history
  FOR EACH ROW EXECUTE FUNCTION public.route_alpha_history_append_only();
CREATE TRIGGER route_alpha_history_no_delete BEFORE DELETE ON public.route_alpha_history
  FOR EACH ROW EXECUTE FUNCTION public.route_alpha_history_append_only();

-- alpha_experiments
CREATE TABLE public.alpha_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  previous_alpha numeric,
  proposed_alpha numeric NOT NULL,
  reason text,
  confidence_score numeric,
  sample_size integer,
  metrics jsonb,
  status public.experiment_status NOT NULL DEFAULT 'proposed',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  reviewer_id uuid,
  notes text
);

ALTER TABLE public.alpha_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage experiments" ON public.alpha_experiments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Extend events
ALTER TABLE public.events ADD COLUMN route_id uuid REFERENCES public.routes(id);

-- Extend event_results
ALTER TABLE public.event_results ADD COLUMN route_id uuid REFERENCES public.routes(id);
ALTER TABLE public.event_results ADD COLUMN scoring_formula_version smallint NOT NULL DEFAULT 1;

-- Backfill: create one route per existing event (auto-named), link both events and event_results
DO $$
DECLARE
  e RECORD;
  new_route_id uuid;
BEGIN
  FOR e IN SELECT * FROM public.events WHERE route_id IS NULL LOOP
    INSERT INTO public.routes (
      name, description, distance_m, elevation_gain_m, elevation_loss_m,
      gpx_file_url, current_alpha, surface_type, created_by
    ) VALUES (
      COALESCE(NULLIF(e.route, ''), e.title || ' route'),
      'Auto-created from event: ' || e.title,
      e.route_distance_m, e.route_elevation_gain_m, e.route_elevation_loss_m,
      e.gpx_file_url, COALESCE(e.alpha, 5), 'road', e.created_by
    ) RETURNING id INTO new_route_id;

    UPDATE public.events SET route_id = new_route_id WHERE id = e.id;
    UPDATE public.event_results SET route_id = new_route_id WHERE event_id = e.id;
  END LOOP;
END $$;

-- Indexes
CREATE INDEX idx_event_results_route ON public.event_results(route_id);
CREATE INDEX idx_events_route ON public.events(route_id);
CREATE INDEX idx_alpha_experiments_route_status ON public.alpha_experiments(route_id, status);
CREATE INDEX idx_route_alpha_history_route ON public.route_alpha_history(route_id, created_at DESC);
