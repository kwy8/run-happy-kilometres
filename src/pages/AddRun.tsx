import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sun } from "lucide-react";
import { toast } from "sonner";

interface EventOption {
  id: string;
  title: string;
  event_date: string;
}

export default function AddRun() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedEvent = searchParams.get("event") || "";

  const [distance, setDistance] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [timeTaken, setTimeTaken] = useState("");
  const [notes, setNotes] = useState("");
  const [eventId, setEventId] = useState(preselectedEvent);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && !preselectedEvent) {
      supabase.from("events").select("id, title, event_date").order("event_date", { ascending: false }).then(({ data }) => {
        if (data) setEvents(data);
      });
    }
  }, [user, preselectedEvent]);

  useEffect(() => {
    if (preselectedEvent) {
      supabase.from("events").select("event_date").eq("id", preselectedEvent).maybeSingle().then(({ data }) => {
        if (data?.event_date) setDate(data.event_date);
      });
    }
  }, [preselectedEvent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const km = parseFloat(distance);
    if (isNaN(km) || km <= 0 || km > 200) {
      toast.error("Distance must be between 0.01 and 200 km");
      return;
    }

    setSubmitting(true);

    const minutes = timeTaken ? parseFloat(timeTaken) : null;

    const { error } = await supabase.from("runs").insert({
      user_id: user!.id,
      distance_km: km,
      run_date: date,
      time_taken_minutes: minutes,
      notes: notes || null,
      photo_url: null,
      event_id: eventId || null,
    });

    if (error) {
      toast.error("Failed to log run");
    } else {
      toast.success("Run logged! 🎉");
      navigate("/dashboard");
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
        <CardHeader>
          <CardTitle>Log a Run</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Distance (km) *</Label>
              <Input type="number" step="0.01" min="0.01" max="200" value={distance} onChange={(e) => setDistance(e.target.value)} required />
            </div>
            {!preselectedEvent && (
              <div>
                <Label>Date *</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            )}
            <div>
              <Label>Time Taken (minutes)</Label>
              <Input type="number" step="0.1" min="0" value={timeTaken} onChange={(e) => setTimeTaken(e.target.value)} placeholder="e.g. 30" />
            </div>
            <div>
              <Label>Event (optional)</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="No event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No event</SelectItem>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.title} — {new Date(ev.event_date).toLocaleDateString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Log Run"}</Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
