import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sun } from "lucide-react";
import { toast } from "sonner";

export default function CreateEvent() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId?: string }>();
  const isEdit = Boolean(eventId);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [meetupTime, setMeetupTime] = useState("");
  const [route, setRoute] = useState("");
  const [location, setLocation] = useState("");
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [existingGpxUrl, setExistingGpxUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(isEdit);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/dashboard");
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => {
    if (!isEdit || !eventId) return;
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("title, event_date, meetup_time, route, location, gpx_file_url")
        .eq("id", eventId)
        .maybeSingle();
      if (error || !data) {
        toast.error("Event not found");
        navigate("/events");
        return;
      }
      setTitle(data.title || "");
      setEventDate(data.event_date || "");
      setMeetupTime(data.meetup_time ? data.meetup_time.slice(0, 5) : "");
      setRoute(data.route || "");
      setLocation(data.location || "");
      setExistingGpxUrl((data as any).gpx_file_url || null);
      setLoadingEvent(false);
    })();
  }, [isEdit, eventId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) { toast.error("Title and date are required"); return; }
    if (title.trim().length > 120) { toast.error("Title must be under 120 characters"); return; }
    if (!isEdit) {
      const today = new Date().toISOString().split("T")[0];
      if (eventDate < today) { toast.error("Event date can't be in the past"); return; }
    }
    setSubmitting(true);

    let gpxFileUrl: string | null = existingGpxUrl;

    if (gpxFile) {
      if (!gpxFile.name.toLowerCase().endsWith(".gpx")) {
        toast.error("Please upload a .gpx file");
        setSubmitting(false);
        return;
      }
      if (gpxFile.size === 0) {
        toast.error("GPX file is empty");
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

    const payload = {
      title: title.trim(),
      event_date: eventDate,
      meetup_time: meetupTime || null,
      route: route.trim() || null,
      location: location.trim() || null,
      gpx_file_url: gpxFileUrl,
    };

    if (isEdit && eventId) {
      const { error } = await supabase.from("events").update(payload as any).eq("id", eventId);
      if (error) {
        toast.error("Failed to update event");
      } else {
        toast.success("Event updated!");
        navigate(`/events/${eventId}`);
      }
    } else {
      const { error } = await supabase.from("events").insert({ ...payload, created_by: user!.id } as any);
      if (error) {
        toast.error("Failed to create event");
      } else {
        toast.success("Event created!");
        navigate("/events");
      }
    }
    setSubmitting(false);
  };

  if (loading || loadingEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Sun className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <AppLayout>
      <Card className="max-w-lg mx-auto">
        <CardHeader><CardTitle>{isEdit ? "Edit Event" : "Create Event"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunday Morning Run" required maxLength={120} /></div>
            <div><Label>Date *</Label><Input type="date" min={isEdit ? undefined : new Date().toISOString().split("T")[0]} value={eventDate} onChange={(e) => setEventDate(e.target.value)} required /></div>
            <div><Label>Meet-up Time</Label><Input type="time" value={meetupTime} onChange={(e) => setMeetupTime(e.target.value)} /></div>
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
              {existingGpxUrl && !gpxFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  Current file kept unless you choose a new one. <a href={existingGpxUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">View current</a>
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Export a .gpx file from Komoot, Strava, Garmin etc.</p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : isEdit ? "Save Changes" : "Create Event"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
