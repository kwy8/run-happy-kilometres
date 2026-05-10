
DROP POLICY IF EXISTS "Owners insert manual result" ON public.event_results;

CREATE POLICY "Owners insert manual result"
ON public.event_results
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND source = 'manual'
  AND status IN ('pending', 'verified')
  AND NOT EXISTS (
    SELECT 1 FROM public.event_results er2
    WHERE er2.event_id = event_results.event_id
      AND er2.user_id = event_results.user_id
  )
);

UPDATE public.event_results SET status = 'verified' WHERE status = 'pending';
