ALTER TABLE public.event_bonus_challenges
ADD COLUMN IF NOT EXISTS lock_at timestamptz;

UPDATE public.event_bonus_challenges
SET lock_at = (timestamp '2026-06-05 20:00:00' AT TIME ZONE 'Europe/Berlin')
WHERE lock_at IS NULL;

CREATE OR REPLACE FUNCTION public.event_bonus_pick_lock_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_date date;
  challenge_lock_at timestamptz;
  lock_at timestamptz;
BEGIN
  IF has_role(auth.uid(),'admin') THEN
    RETURN NEW;
  END IF;

  SELECT e.event_date, c.lock_at
  INTO ev_date, challenge_lock_at
  FROM public.events e
  LEFT JOIN public.event_bonus_challenges c ON c.event_id = e.id
  WHERE e.id = NEW.event_id;

  IF ev_date IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  lock_at := COALESCE(
    challenge_lock_at,
    ((ev_date::text || ' 20:00:00')::timestamp AT TIME ZONE 'Europe/Berlin')
  );

  IF now() >= lock_at THEN
    RAISE EXCEPTION 'Picks are locked for this event';
  END IF;

  RETURN NEW;
END;
$$;
