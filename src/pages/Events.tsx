import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun, Calendar, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Event {
  id: string;
  title: string;
  event_date: string;
  route: string | null;
  location: string | null;
  participant_count?: number;
}

export default function Events() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchEvents();
  }, [user]);

  const fetchEvents = async () => {
    setLoadingData(true);
    const { data: eventsData } = await supabase
      .from("events")
      .select("*");

    if (eventsData) {
      const today = new Date().toISOString().split("T")[0];
      // Upcoming first (ascending), then past (descending)
      const sorted = [...eventsData].sort((a, b) => {
        const aUpcoming = a.event_date >= today;
        const bUpcoming = b.event_date >= today;
        if (aUpcoming && !bUpcoming) return -1;
        if (!aUpcoming && bUpcoming) return 1;
        if (aUpcoming) return a.event_date.localeCompare(b.event_date);
        return b.event_date.localeCompare(a.event_date);
      });

      const withCounts = await Promise.all(
        sorted.map(async (event) => {
          const { count } = await supabase
            .from("event_participants")
            .select("*", { count: "exact", head: true })
            .eq("event_id", event.id);
          return { ...event, participant_count: count || 0 };
        })
      );
      setEvents(withCounts);
    }
    setLoadingData(false);
  };

  const deleteEvent = async (eventId: string, title: string) => {
    const confirmed = window.confirm(`Delete "${title}"? This will remove joins for this event and detach any linked runs.`);
    if (!confirmed) return;

    setDeletingEventId(eventId);

    const [{ error: participantsError }, { error: runsError }] = await Promise.all([
      supabase.from("event_participants").delete().eq("event_id", eventId),
      supabase.from("runs").update({ event_id: null }).eq("event_id", eventId),
    ]);

    if (participantsError || runsError) {
      toast.error("Failed to prepare event deletion");
      setDeletingEventId(null);
      return;
    }

    const { error } = await supabase.from("events").delete().eq("id", eventId);

    if (error) {
      toast.error("Failed to delete event");
      setDeletingEventId(null);
      return;
    }

    toast.success("Event deleted");
    setDeletingEventId(null);
    fetchEvents();
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Sun className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-foreground">Events</h1>
          {isAdmin && (
            <Link to="/admin/create-event">
              <Button><Plus className="w-4 h-4 mr-1" /> Create Event</Button>
            </Link>
          )}
        </div>

        {events.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No events yet. Check back soon!
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <Card key={event.id} className="mb-3 transition-colors hover:bg-muted/50">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <Link to={`/events/${event.id}`} className="min-w-0 flex-1">
                      <div>
                        <h3 className="font-bold text-foreground">{event.title}</h3>
                        <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(event.event_date).toLocaleDateString()}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </span>
                          )}
                        </div>
                        {event.route && <p className="mt-1 text-xs text-muted-foreground">Route: {event.route}</p>}
                      </div>
                    </Link>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">{event.participant_count}</p>
                        <p className="text-xs text-muted-foreground">joined</p>
                      </div>

                      {isAdmin && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={deletingEventId === event.id}
                          onClick={() => deleteEvent(event.id, event.title)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
