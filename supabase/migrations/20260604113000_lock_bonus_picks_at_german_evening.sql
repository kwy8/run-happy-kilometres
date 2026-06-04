CREATE OR REPLACE FUNCTION public.event_bonus_pick_lock_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_date date;
  lock_at timestamptz;
BEGIN
  IF has_role(auth.uid(),'admin') THEN
    RETURN NEW;
  END IF;

  SELECT event_date INTO ev_date FROM public.events WHERE id = NEW.event_id;
  IF ev_date IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  lock_at := ((ev_date::text || ' 20:00:00')::timestamp AT TIME ZONE 'Europe/Berlin');
  IF now() >= lock_at THEN
    RAISE EXCEPTION 'Picks are locked for this event';
  END IF;

  RETURN NEW;
END;
$$;
