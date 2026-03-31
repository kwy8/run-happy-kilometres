import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [route, setRoute] = useState("");
  const [location, setLocation] = useState("");
  const [komootUrl, setKomootUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/dashboard");
  }, [user, loading, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) { toast.error("Title and date are required"); return; }
    setSubmitting(true);
    const trimmedUrl = komootUrl.trim();
    if (trimmedUrl && !trimmedUrl.match(/^https:\/\/(www\.)?komoot\.(com|de)\/(tour|collection)\/\d+/i)) {
      toast.error("Please enter a valid Komoot tour URL (e.g. https://www.komoot.com/tour/123456)");
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from("events").insert({
      title: title.trim(),
      event_date: eventDate,
      route: route.trim() || null,
      location: location.trim() || null,
      komoot_url: trimmedUrl || null,
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
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Event"}</Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
