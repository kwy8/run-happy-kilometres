ALTER TABLE public.events DROP COLUMN IF EXISTS komoot_url;
ALTER TABLE public.events ADD COLUMN gpx_file_url text DEFAULT NULL;