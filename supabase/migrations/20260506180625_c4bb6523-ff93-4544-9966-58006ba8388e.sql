
DELETE FROM public.event_results WHERE id = '56dc6d87-9312-49db-a9ba-7e337c7ddc86';
UPDATE public.events
SET qr_enabled = true,
    results_published = false,
    route_distance_m = NULL,
    route_elevation_gain_m = NULL
WHERE id = '31d7aa3f-d18c-4aa4-9ea9-776700621f93';
