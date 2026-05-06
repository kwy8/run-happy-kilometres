import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sun, Calendar, MapPin, Plus, Clock } from "lucide-react";
import { toast } from "sonner";
import { GpxMap } from "@/components/GpxMap";
import { formatMinSec, formatPace } from "@/lib/time";
import { formatRR, RR_ABBR } from "@/lib/score";
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch";
import { EventComments } from "@/components/EventComments";

interface EventData {
  id: string;
  title: string;
  event_date: string;
  meetup_time: string | null;
  route: string | null;
  location: string | null;
  gpx_file_url: string | null;
  route_distance_m: number | null;
}

interface Participant {
  user_id: string;
  display_name: string;
  distance_km?: number;
  time_taken_minutes?: number;
  performance_score?: number | null;
  rpe_notes?: string | null;
}

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [hasJoined, setHasJoined] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && id) fetchData();
  }, [user, id]);

  useRealtimeRefetch("event_results", () => {
    if (user && id) fetchData();
  });

  const fetchData = async () => {
    setLoadingData(true);
    const { data: eventData, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", id!)
      .maybeSingle();
    if (eventErr || !eventData) {
      setEvent(null);
      setLoadingData(false);
      return;
    }
    setEvent(eventData as unknown as EventData);

    const { data: parts } = await supabase
      .from("event_participants")
      .select("user_id")
      .eq("event_id", id!);

    if (parts && parts.length > 0) {
      setHasJoined(parts.some((p) => p.user_id === user!.id));

      const userIds = parts.map((p) => p.user_id);
      const [{ data: profilesData }, { data: runsData }, { data: resultsData }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
        supabase
          .from("runs")
          .select("user_id, distance_km, time_taken_minutes")
          .eq("event_id", id!)
          .in("user_id", userIds),
        supabase
          .from("event_results")
          .select("user_id, duration_s, distance_m, performance_score, rpe_notes, status")
          .eq("event_id", id!)
          .eq("status", "verified")
          .in("user_id", userIds),
      ]);

      const profileMap = new Map((profilesData || []).map((p) => [p.user_id, p.display_name]));
      const runMap = new Map<string, { distance_km: number; time_taken_minutes: number | null }>();
      (runsData || []).forEach((r) => {
        const existing = runMap.get(r.user_id);
        if (!existing || r.distance_km > existing.distance_km) {
          runMap.set(r.user_id, { distance_km: r.distance_km, time_taken_minutes: r.time_taken_minutes });
        }
      });
      // Verified official results take precedence
      const officialMap = new Map<string, { distance_km?: number; time_taken_minutes?: number; performance_score?: number | null; rpe_notes?: string | null }>();
      const eventDistanceKm = eventData.route_distance_m ? eventData.route_distance_m / 1000 : undefined;
      (resultsData || []).forEach((r: any) => {
        officialMap.set(r.user_id, {
          distance_km: r.distance_m ? r.distance_m / 1000 : eventDistanceKm,
          time_taken_minutes: r.duration_s != null ? r.duration_s / 60 : undefined,
          performance_score: r.performance_score,
          rpe_notes: r.rpe_notes,
        });
      });

      const enriched: Participant[] = parts.map((p) => {
        const off = officialMap.get(p.user_id);
        const casual = runMap.get(p.user_id);
        return {
          user_id: p.user_id,
          display_name: profileMap.get(p.user_id) || "Runner",
          distance_km: off?.distance_km ?? casual?.distance_km,
          time_taken_minutes: off?.time_taken_minutes ?? casual?.time_taken_minutes ?? undefined,
          performance_score: off?.performance_score ?? null,
          rpe_notes: off?.rpe_notes ?? null,
        };
      });
      enriched.sort((a, b) => {
        const at = a.time_taken_minutes ?? Infinity;
        const bt = b.time_taken_minutes ?? Infinity;
        return at - bt;
      });
      setParticipants(enriched);
    } else {
      setParticipants([]);
      setHasJoined(false);
    }
    setLoadingData(false);
  };

  const joinEvent = async () => {
    if (hasJoined) return;
    const { error } = await supabase.from("event_participants").insert({ event_id: id!, user_id: user!.id });
    if (error) {
      // Likely already joined from another tab — refresh state
      toast.error("Couldn't join (you may already be in)");
      fetchData();
      return;
    }
    setHasJoined(true);
    toast.success("You've joined the event!");
    fetchData();
  };

  const leaveEvent = async () => {
    await supabase.from("event_participants").delete().eq("event_id", id!).eq("user_id", user!.id);
    setHasJoined(false);
    toast.success("You've left the event");
    fetchData();
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Sun className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!event) return <AppLayout><p className="text-muted-foreground">Event not found.</p></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{event.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(event.event_date).toLocaleDateString()}</span>
            {event.meetup_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {event.meetup_time.slice(0, 5)}</span>}
            {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>}
          </div>
          {event.route && <p className="text-sm text-muted-foreground mt-1">Route: {event.route}</p>}
        </div>

        {event.gpx_file_url && (
          <Card>
            <CardHeader><CardTitle>Route Map</CardTitle></CardHeader>
            <CardContent>
              <GpxMap gpxUrl={event.gpx_file_url} />
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 flex-wrap">
          {hasJoined ? (
            <>
              <Button variant="outline" onClick={leaveEvent}>Leave Event</Button>
              <Link to={`/add-run?event=${id}`}><Button><Plus className="w-4 h-4 mr-1" /> Log Run for This Event</Button></Link>
            </>
          ) : (
            <Button onClick={joinEvent}>Join Event</Button>
          )}
          {isAdmin && (
            <Link to={`/admin/events/${id}/timing`}>
              <Button variant="outline"><Settings className="w-4 h-4 mr-1" /> Timing & Results</Button>
            </Link>
          )}
        </div>

        <Card>
          <CardHeader><CardTitle>Participants ({participants.length})</CardTitle></CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <p className="text-muted-foreground text-sm">No participants yet. Be the first to join!</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Distance</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Pace</TableHead>
                    <TableHead>{RR_ABBR}</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p) => (
                    <TableRow key={p.user_id}>
                      <TableCell className="font-medium">{p.display_name}</TableCell>
                      <TableCell>{p.distance_km ? `${p.distance_km.toFixed(1)} km` : "—"}</TableCell>
                      <TableCell>{formatMinSec(p.time_taken_minutes)}</TableCell>
                      <TableCell>
                        {p.distance_km && p.time_taken_minutes
                          ? formatPace(p.time_taken_minutes / p.distance_km)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {p.performance_score != null ? p.performance_score.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate text-muted-foreground" title={p.rpe_notes || ""}>
                        {p.rpe_notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <EventComments eventId={id!} currentUserId={user!.id} />
      </div>
    </AppLayout>
  );
}
