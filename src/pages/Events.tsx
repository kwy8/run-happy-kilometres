import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun, Calendar, MapPin, Plus } from "lucide-react";

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
      .select("*")
      .order("event_date", { ascending: false });

    if (eventsData) {
      const withCounts = await Promise.all(
        eventsData.map(async (event) => {
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
              <Link key={event.id} to={`/events/${event.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer mb-3">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-foreground">{event.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
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
                        {event.route && <p className="text-xs text-muted-foreground mt-1">Route: {event.route}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">{event.participant_count}</p>
                        <p className="text-xs text-muted-foreground">joined</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
