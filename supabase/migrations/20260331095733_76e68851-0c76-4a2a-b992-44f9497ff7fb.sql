INSERT INTO storage.buckets (id, name, public) VALUES ('gpx-files', 'gpx-files', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload gpx files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'gpx-files' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete gpx files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'gpx-files' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view gpx files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'gpx-files');