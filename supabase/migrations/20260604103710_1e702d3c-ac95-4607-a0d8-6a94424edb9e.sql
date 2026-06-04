
CREATE TABLE public.event_bonus_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE,
  question text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  correct_answer text CHECK (correct_answer IN ('a','b')),
  penalty_m integer NOT NULL DEFAULT 800 CHECK (penalty_m >= 0 AND penalty_m <= 100000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_bonus_challenges TO authenticated;
GRANT ALL ON public.event_bonus_challenges TO service_role;
ALTER TABLE public.event_bonus_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read challenges" ON public.event_bonus_challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage challenges" ON public.event_bonus_challenges FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER tg_ebc_updated_at BEFORE UPDATE ON public.event_bonus_challenges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_bonus_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  pick text NOT NULL CHECK (pick IN ('a','b')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_bonus_picks TO authenticated;
GRANT ALL ON public.event_bonus_picks TO service_role;
ALTER TABLE public.event_bonus_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read picks" ON public.event_bonus_picks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own pick" ON public.event_bonus_picks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pick" ON public.event_bonus_picks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own pick" ON public.event_bonus_picks FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage picks" ON public.event_bonus_picks FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER tg_ebp_updated_at BEFORE UPDATE ON public.event_bonus_picks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lock picks at event start time
CREATE OR REPLACE FUNCTION public.event_bonus_pick_lock_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_date date;
  ev_time time;
  lock_at timestamptz;
BEGIN
  IF has_role(auth.uid(),'admin') THEN
    RETURN NEW;
  END IF;
  SELECT event_date, meetup_time INTO ev_date, ev_time FROM public.events WHERE id = NEW.event_id;
  IF ev_date IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  lock_at := (ev_date + COALESCE(ev_time, time '23:59:59'))::timestamptz;
  IF now() >= lock_at THEN
    RAISE EXCEPTION 'Picks are locked for this event';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_ebp_lock_guard
BEFORE INSERT OR UPDATE ON public.event_bonus_picks
FOR EACH ROW EXECUTE FUNCTION public.event_bonus_pick_lock_guard();
