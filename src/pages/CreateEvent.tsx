import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sun, Upload } from "lucide-react";
import { toast } from "sonner";

export default function CreateEvent() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [meetupTime, setMeetupTime] = useState("");
  const [route, setRoute] = useState("");
  const [location, setLocation] = useState("");
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/dashboard");
  }, [user, loading, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) { toast.error("Title and date are required"); return; }
    setSubmitting(true);

    let gpxFileUrl: string | null = null;

    if (gpxFile) {
      if (!gpxFile.name.toLowerCase().endsWith(".gpx")) {
        toast.error("Please upload a .gpx file");
        setSubmitting(false);
        return;
      }
      if (gpxFile.size > 5 * 1024 * 1024) {
        toast.error("GPX file must be under 5MB");
        setSubmitting(false);
        return;
      }

      const fileName = `${Date.now()}-${gpxFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("gpx-files")
        .upload(fileName, gpxFile, { contentType: "application/gpx+xml" });

      if (uploadError) {
        toast.error("Failed to upload GPX file");
        setSubmitting(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("gpx-files").getPublicUrl(fileName);
      gpxFileUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from("events").insert({
      title: title.trim(),
      event_date: eventDate,
      meetup_time: meetupTime || null,
      route: route.trim() || null,
      location: location.trim() || null,
      gpx_file_url: gpxFileUrl,
      created_by: user!.id,
    } as any);

    if (error) {
      toast.error("Failed to create event");
    } else {
      toast.success("Event created!");
      navigate("/events");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Sun className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <AppLayout>
      <Card className="max-w-lg mx-auto">
        <CardHeader><CardTitle>Create Event</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunday Morning Run" required /></div>
            <div><Label>Date *</Label><Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required /></div>
            <div><Label>Route</Label><Input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="e.g. Park loop 5km" /></div>
            <div><Label>Meet-up Point</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Central Park" /></div>
            <div>
              <Label>Route GPX File</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="file"
                  accept=".gpx"
                  onChange={(e) => setGpxFile(e.target.files?.[0] || null)}
                  className="file:mr-2 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Export a .gpx file from Komoot, Strava, Garmin etc.</p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Event"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
