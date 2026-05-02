import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sun, Plus, Calendar, MapPin, Clock, Check } from "lucide-react";
import { toast } from "sonner";

interface Run {
  id: string;
  distance_km: number;
  run_date: string;
  time_taken_minutes: number | null;
  notes: string | null;
}

interface UpcomingEvent {
  id: string;
  title: string;
  event_date: string;
  meetup_time: string | null;
  location: string | null;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[]>([]);
  const [profile, setProfile] = useState<{ display_name: string; show_on_leaderboard: boolean } | null>(null);
  const [upcomingEvent, setUpcomingEvent] = useState<UpcomingEvent | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoadingData(true);
    const today = new Date().toISOString().split("T")[0];
    const [runsRes, profileRes, eventRes] = await Promise.all([
      supabase.from("runs").select("id, distance_km, run_date, time_taken_minutes, notes").order("run_date", { ascending: false }),
      supabase.from("profiles").select("display_name, show_on_leaderboard").eq("user_id", user!.id).single(),
      supabase
        .from("events")
        .select("id, title, event_date, meetup_time, location")
        .gte("event_date", today)
        .order("event_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    if (runsRes.data) setRuns(runsRes.data);
    if (profileRes.data) setProfile(profileRes.data);
    if (eventRes.data) {
      setUpcomingEvent(eventRes.data);
      const { data: joinData } = await supabase
        .from("event_participants")
        .select("id")
        .eq("event_id", eventRes.data.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      setHasJoined(!!joinData);
    } else {
      setUpcomingEvent(null);
      setHasJoined(false);
    }
    setLoadingData(false);
  };

  const joinEvent = async () => {
    if (!upcomingEvent || hasJoined) return;
    setJoining(true);
    const { error } = await supabase
      .from("event_participants")
      .insert({ event_id: upcomingEvent.id, user_id: user!.id });
    setJoining(false);
    if (error) {
      // Likely already joined elsewhere — sync state
      setHasJoined(true);
      toast.error("Couldn't join (you may already be in)");
      return;
    }
    setHasJoined(true);
    toast.success("You're in! See you there 🌅");
  };

  const toggleLeaderboard = async (checked: boolean) => {
    await supabase.from("profiles").update({ show_on_leaderboard: checked }).eq("user_id", user!.id);
    setProfile((p) => p ? { ...p, show_on_leaderboard: checked } : p);
    toast.success(checked ? "You're now on the leaderboard!" : "Removed from leaderboard");
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Sun className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const latestRun = runs[0] || null;
  const previousRun = runs[1] || null;
  const fastestPace = runs.reduce((best, run) => {
    if (run.time_taken_minutes && run.distance_km > 0) {
      const pace = run.time_taken_minutes / run.distance_km;
      return pace < best ? pace : best;
    }
    return best;
  }, Infinity);

  const totalKm = runs.reduce((sum, r) => sum + r.distance_km, 0);

  const greeting = getGreeting(profile?.display_name || "Runner");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{greeting}</h1>
            <p className="text-muted-foreground text-sm">Every step counts 💪</p>
          </div>
          <Link to="/add-run">
            <Button><Plus className="w-4 h-4 mr-1" /> Log Run</Button>
          </Link>
        </div>

        {/* Next Upcoming Event */}
        {upcomingEvent && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-primary font-semibold">Next Run</p>
                  <CardTitle className="text-lg mt-1">
                    <Link to={`/events/${upcomingEvent.id}`} className="hover:underline">
                      {upcomingEvent.title}
                    </Link>
                  </CardTitle>
                </div>
                {hasJoined ? (
                  <Button variant="outline" size="sm" disabled>
                    <Check className="w-4 h-4 mr-1" /> Joined
                  </Button>
                ) : (
                  <Button size="sm" onClick={joinEvent} disabled={joining}>
                    {joining ? "Joining..." : "Join"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(upcomingEvent.event_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </span>
                {upcomingEvent.meetup_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {upcomingEvent.meetup_time.slice(0, 5)}
                  </span>
                )}
                {upcomingEvent.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {upcomingEvent.location}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Runs</p>
              <p className="text-2xl font-bold text-foreground">{runs.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Distance</p>
              <p className="text-2xl font-bold text-foreground">{totalKm.toFixed(1)} km</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Fastest Pace</p>
              <p className="text-2xl font-bold text-foreground">
                {fastestPace === Infinity ? "—" : `${fastestPace.toFixed(1)} min/km`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Latest Distance</p>
              <p className="text-2xl font-bold text-foreground">
                {latestRun ? `${latestRun.distance_km.toFixed(1)} km` : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Latest vs Previous */}
        {latestRun && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Latest vs Previous Run</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Latest ({new Date(latestRun.run_date).toLocaleDateString()})</p>
                  <p className="font-bold text-foreground">{latestRun.distance_km.toFixed(1)} km</p>
                  {latestRun.time_taken_minutes && (
                    <p className="text-muted-foreground">{latestRun.time_taken_minutes} min ({(latestRun.time_taken_minutes / latestRun.distance_km).toFixed(1)} min/km)</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">
                    {previousRun ? `Previous (${new Date(previousRun.run_date).toLocaleDateString()})` : "Previous"}
                  </p>
                  {previousRun ? (
                    <>
                      <p className="font-bold text-foreground">{previousRun.distance_km.toFixed(1)} km</p>
                      {previousRun.time_taken_minutes && (
                        <p className="text-muted-foreground">{previousRun.time_taken_minutes} min ({(previousRun.time_taken_minutes / previousRun.distance_km).toFixed(1)} min/km)</p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">No previous run yet</p>
                  )}
                </div>
              </div>
              {latestRun && previousRun && (
                <p className="mt-3 text-sm font-medium text-foreground">
                  Distance change: {(latestRun.distance_km - previousRun.distance_km) > 0 ? "+" : ""}
                  {(latestRun.distance_km - previousRun.distance_km).toFixed(1)} km
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Leaderboard toggle */}
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <Label className="font-medium">Show on Leaderboard</Label>
              <p className="text-xs text-muted-foreground">Share your stats publicly</p>
            </div>
            <Switch checked={profile?.show_on_leaderboard ?? false} onCheckedChange={toggleLeaderboard} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}! 🌅`;
  if (hour < 17) return `Hey ${name}! ☀️`;
  return `Evening, ${name}! 🌙`;
}
