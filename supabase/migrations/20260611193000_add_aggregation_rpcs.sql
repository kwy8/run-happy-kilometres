CREATE OR REPLACE FUNCTION public.get_events_with_participant_counts()
RETURNS TABLE (
  id uuid,
  title text,
  event_date date,
  route text,
  location text,
  participant_count integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.title,
    e.event_date,
    e.route,
    e.location,
    COUNT(ep.user_id)::integer AS participant_count
  FROM public.events e
  LEFT JOIN public.event_participants ep ON ep.event_id = e.id
  GROUP BY e.id, e.title, e.event_date, e.route, e.location
  ORDER BY e.event_date DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_event_participants(_event_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  distance_km numeric,
  time_taken_minutes numeric,
  performance_score numeric,
  rpe_notes text,
  result_id uuid,
  source text,
  status text,
  proof_image_url text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH best_runs AS (
    SELECT DISTINCT ON (r.user_id)
      r.user_id,
      r.distance_km,
      r.time_taken_minutes
    FROM public.runs r
    WHERE r.event_id = _event_id
    ORDER BY r.user_id, r.distance_km DESC NULLS LAST
  )
  SELECT
    ep.user_id,
    COALESCE(p.display_name, 'Runner') AS display_name,
    COALESCE(
      CASE
        WHEN er.distance_m IS NOT NULL THEN er.distance_m::numeric / 1000
        WHEN ev.route_distance_m IS NOT NULL THEN ev.route_distance_m::numeric / 1000
        ELSE NULL
      END,
      br.distance_km
    ) AS distance_km,
    COALESCE(
      CASE WHEN er.duration_s IS NOT NULL THEN er.duration_s::numeric / 60 ELSE NULL END,
      br.time_taken_minutes
    ) AS time_taken_minutes,
    CASE WHEN er.status = 'verified' THEN er.performance_score ELSE NULL END AS performance_score,
    er.rpe_notes,
    er.id AS result_id,
    er.source,
    er.status,
    er.proof_image_url
  FROM public.event_participants ep
  JOIN public.events ev ON ev.id = ep.event_id
  LEFT JOIN public.profiles p ON p.user_id = ep.user_id
  LEFT JOIN best_runs br ON br.user_id = ep.user_id
  LEFT JOIN public.event_results er ON er.event_id = ep.event_id AND er.user_id = ep.user_id
  WHERE ep.event_id = _event_id
  ORDER BY
    COALESCE(
      CASE WHEN er.duration_s IS NOT NULL THEN er.duration_s::numeric / 60 ELSE NULL END,
      br.time_taken_minutes,
      999999999
    ) ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_leaderboard_summary()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  best_rr numeric,
  best_event_title text,
  best_event_date date,
  avg_rr numeric,
  avg_rr_count integer,
  total_km numeric,
  total_runs integer,
  fastest_pace numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible_profiles AS (
    SELECT p.user_id, p.display_name
    FROM public.profiles p
    WHERE p.show_on_leaderboard = true
      AND auth.uid() IS NOT NULL
  ),
  verified_results AS (
    SELECT
      er.user_id,
      er.performance_score,
      er.event_id,
      er.distance_m,
      er.duration_s,
      e.title AS event_title,
      e.event_date,
      e.route_distance_m
    FROM public.event_results er
    JOIN visible_profiles vp ON vp.user_id = er.user_id
    LEFT JOIN public.events e ON e.id = er.event_id
    WHERE er.status = 'verified'
      AND er.performance_score IS NOT NULL
  ),
  event_distances AS (
    SELECT
      er.user_id,
      er.distance_m,
      er.duration_s,
      e.route_distance_m
    FROM public.event_results er
    JOIN visible_profiles vp ON vp.user_id = er.user_id
    LEFT JOIN public.events e ON e.id = er.event_id
  ),
  best_results AS (
    SELECT DISTINCT ON (vr.user_id)
      vr.user_id,
      vr.performance_score AS best_rr,
      vr.event_title AS best_event_title,
      vr.event_date AS best_event_date
    FROM verified_results vr
    ORDER BY vr.user_id, vr.performance_score DESC NULLS LAST
  ),
  recent_results AS (
    SELECT
      vr.user_id,
      vr.performance_score,
      ROW_NUMBER() OVER (PARTITION BY vr.user_id ORDER BY vr.event_date DESC NULLS LAST) AS rn
    FROM verified_results vr
  ),
  avg_results AS (
    SELECT
      rr.user_id,
      AVG(rr.performance_score) FILTER (WHERE rr.rn <= 4) AS avg_rr,
      COUNT(*) FILTER (WHERE rr.rn <= 4)::integer AS avg_rr_count
    FROM recent_results rr
    GROUP BY rr.user_id
  ),
  casual_distances AS (
    SELECT
      r.user_id,
      r.distance_km::numeric AS distance_km,
      r.time_taken_minutes::numeric AS time_minutes
    FROM public.runs r
    JOIN visible_profiles vp ON vp.user_id = r.user_id
  ),
  official_distances AS (
    SELECT
      ed.user_id,
      COALESCE(ed.distance_m, ed.route_distance_m)::numeric / 1000 AS distance_km,
      ed.duration_s::numeric / 60 AS time_minutes
    FROM event_distances ed
    WHERE COALESCE(ed.distance_m, ed.route_distance_m) IS NOT NULL
  ),
  admin_casual_distances AS (
    SELECT
      cr.user_id,
      cr.distance_m::numeric / 1000 AS distance_km,
      cr.duration_s::numeric / 60 AS time_minutes
    FROM public.casual_runs cr
    JOIN visible_profiles vp ON vp.user_id = cr.user_id
    WHERE cr.distance_m IS NOT NULL
  ),
  all_distances AS (
    SELECT * FROM casual_distances
    UNION ALL
    SELECT * FROM official_distances
    UNION ALL
    SELECT * FROM admin_casual_distances
  ),
  distance_totals AS (
    SELECT
      ad.user_id,
      COALESCE(SUM(ad.distance_km), 0) AS total_km,
      COUNT(*)::integer AS total_runs,
      MIN(ad.time_minutes / NULLIF(ad.distance_km, 0)) FILTER (
        WHERE ad.time_minutes IS NOT NULL AND ad.distance_km > 0
      ) AS fastest_pace
    FROM all_distances ad
    GROUP BY ad.user_id
  )
  SELECT
    vp.user_id,
    vp.display_name,
    br.best_rr,
    COALESCE(br.best_event_title, 'Event') AS best_event_title,
    br.best_event_date,
    ar.avg_rr,
    COALESCE(ar.avg_rr_count, 0) AS avg_rr_count,
    COALESCE(dt.total_km, 0) AS total_km,
    COALESCE(dt.total_runs, 0) AS total_runs,
    dt.fastest_pace
  FROM visible_profiles vp
  LEFT JOIN best_results br ON br.user_id = vp.user_id
  LEFT JOIN avg_results ar ON ar.user_id = vp.user_id
  LEFT JOIN distance_totals dt ON dt.user_id = vp.user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_events_with_participant_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_event_participants(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard_summary() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_events_with_participant_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_participants(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_summary() TO authenticated;
