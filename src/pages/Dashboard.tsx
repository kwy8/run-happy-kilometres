import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun, Plus, Calendar, MapPin, Clock, Check, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { formatMinSec, formatPace } from "@/lib/time";
import { formatRR } from "@/lib/score";
import { toast } from "sonner";
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch";

interface Run {
  id: string;
  distance_km: number;
  run_date: string;
  time_taken_minutes: number | null;
  notes: string | null;
  performance_score?: number | null;
  source?: "casual" | "official" | "casual_admin";
}

interface UpcomingEvent {
  id: string;
  title: string;
  event_date: string;
  meetup_time: string | null;
  location: string | null;
}

export default function Dashboard() {
  const { user, loading, isAdmin, adminLoading } = useAuth();
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

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    const today = new Date().toLocaleDateString("en-CA");
    const promises: any[] = [
      supabase.from("runs").select("id, distance_km, run_date, time_taken_minutes, notes").eq("user_id", user.id).order("run_date", { ascending: false }),
      supabase.from("profiles").select("display_name, show_on_leaderboard").eq("user_id", user.id).single(),
      supabase
        .from("events")
        .select("id, title, event_date, meetup_time, location")
        .gte("event_date", today)
        .order("event_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("event_results")
        .select("id, event_id, duration_s, distance_m, performance_score, events(title, event_date, route_distance_m)")
        .eq("user_id", user.id)
        .eq("status", "verified"),
    ];
    if (isAdmin) {
      promises.push(
        supabase.from("casual_runs").select("id, route_name, distance_m, duration_s, performance_score, created_at").eq("user_id", user.id),
      );
    }
    const [runsRes, profileRes, eventRes, orRes, casualAdminRes] = await Promise.all(promises);

    const casual: Run[] = (runsRes.data || []).map((r: any) => ({
      id: r.id,
      distance_km: r.distance_km,
      run_date: r.run_date,
      time_taken_minutes: r.time_taken_minutes,
      notes: r.notes,
      source: "casual",
    }));
    const official: Run[] = (orRes.data || []).map((r: any) => {
      const distM = r.distance_m ?? r.events?.route_distance_m ?? null;
      return {
        id: r.id,
        distance_km: distM ? distM / 1000 : 0,
        run_date: r.events?.event_date || new Date().toISOString().slice(0, 10),
        time_taken_minutes: r.duration_s != null ? r.duration_s / 60 : null,
        notes: r.events?.title ? `Event: ${r.events.title}` : null,
        performance_score: r.performance_score,
        source: "official",
      };
    });
    const casualAdmin: Run[] = (casualAdminRes?.data || []).map((r: any) => ({
      id: `ca-${r.id}`,
      distance_km: r.distance_m ? r.distance_m / 1000 : 0,
      run_date: r.created_at.slice(0, 10),
      time_taken_minutes: r.duration_s != null ? r.duration_s / 60 : null,
      notes: `🧪 ${r.route_name}`,
      performance_score: r.performance_score,
      source: "casual_admin",
    }));
    const merged = [...casual, ...official, ...casualAdmin].sort((a, b) =>
      a.run_date < b.run_date ? 1 : a.run_date > b.run_date ? -1 : 0
    );
    setRuns(merged);
    if (profileRes.data) setProfile(profileRes.data);
    if (eventRes.data) {
      setUpcomingEvent(eventRes.data);
      const { data: joinData } = await supabase
        .from("event_participants")
        .select("id")
        .eq("event_id", eventRes.data.id)
        .eq("user_id", user.id)
        .maybeSingle();
      setHasJoined(!!joinData);
    } else {
      setUpcomingEvent(null);
      setHasJoined(false);
    }
    setLoadingData(false);
  }, [user, isAdmin]);

  useEffect(() => {
    if (user?.id && !loading && !adminLoading) fetchData();
  }, [user?.id, loading, adminLoading, fetchData]);

  useRealtimeRefetch("event_results", fetchData);


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
          <Link to="/events">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Submit Result
            </Button>
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
              <p className="text-2xl font-bold text-foreground">{totalKm.toFixed(3)} km</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Fastest Pace</p>
              <p className="text-2xl font-bold text-foreground">
                {fastestPace === Infinity ? "—" : formatPace(fastestPace)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Latest Distance</p>
              <p className="text-2xl font-bold text-foreground">
                {latestRun ? `${latestRun.distance_km.toFixed(3)} km` : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Latest vs Previous */}
        {latestRun && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Latest vs Previous Run</CardTitle></CardHeader>
            <CardContent>
              {previousRun ? (
                <ComparisonTable latest={latestRun} previous={previousRun} />
              ) : (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Latest ({new Date(latestRun.run_date).toLocaleDateString()})</p>
                  <p className="font-bold text-foreground">{latestRun.distance_km.toFixed(3)} km</p>
                  {latestRun.time_taken_minutes != null && (
                    <p className="text-muted-foreground">
                      {formatMinSec(latestRun.time_taken_minutes)}
                      {latestRun.distance_km > 0 && ` (${formatPace(latestRun.time_taken_minutes / latestRun.distance_km)})`}
                    </p>
                  )}
                  <p className="text-muted-foreground mt-3">No previous run yet — log another to see your progress!</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}


        <div className="text-center">
          <Link to="/profile" className="text-sm text-primary hover:underline">View full run history →</Link>
        </div>

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

type Tone = "positive" | "negative" | "neutral";

function ComparisonTable({ latest, previous }: { latest: Run; previous: Run }) {
  const latestPace =
    latest.time_taken_minutes != null && latest.distance_km > 0
      ? latest.time_taken_minutes / latest.distance_km
      : null;
  const prevPace =
    previous.time_taken_minutes != null && previous.distance_km > 0
      ? previous.time_taken_minutes / previous.distance_km
      : null;

  const rows = [
    {
      label: "Distance",
      latest: `${latest.distance_km.toFixed(3)} km`,
      previous: `${previous.distance_km.toFixed(3)} km`,
      delta: formatDelta(latest.distance_km - previous.distance_km, (n) => `${n.toFixed(3)} km`),
      ...evalDirection(latest.distance_km, previous.distance_km, { lowerIsBetter: false }),
    },
    {
      label: "Duration",
      latest: latest.time_taken_minutes != null ? formatMinSec(latest.time_taken_minutes) : "—",
      previous: previous.time_taken_minutes != null ? formatMinSec(previous.time_taken_minutes) : "—",
      delta:
        latest.time_taken_minutes != null && previous.time_taken_minutes != null
          ? formatDeltaTime(latest.time_taken_minutes - previous.time_taken_minutes)
          : null,
      ...(latest.time_taken_minutes != null && previous.time_taken_minutes != null
        ? { ...evalDirection(latest.time_taken_minutes, previous.time_taken_minutes, { lowerIsBetter: false }), tone: "neutral" as Tone }
        : { direction: "na" as const, tone: "neutral" as Tone }),
    },
    {
      label: "Pace",
      latest: latestPace != null ? formatPace(latestPace) : "—",
      previous: prevPace != null ? formatPace(prevPace) : "—",
      delta:
        latestPace != null && prevPace != null
          ? `${formatDeltaTime(latestPace - prevPace)} /km`
          : null,
      ...(latestPace != null && prevPace != null
        ? evalDirection(latestPace, prevPace, { lowerIsBetter: true })
        : { direction: "na" as const, tone: "neutral" as Tone }),
    },
    {
      label: "RR",
      latest: latest.performance_score != null ? formatRR(latest.performance_score) : "—",
      previous: previous.performance_score != null ? formatRR(previous.performance_score) : "—",
      delta:
        latest.performance_score != null && previous.performance_score != null
          ? formatDelta(latest.performance_score - previous.performance_score, (n) => formatRR(n))
          : null,
      ...(latest.performance_score != null && previous.performance_score != null
        ? evalDirection(latest.performance_score, previous.performance_score, { lowerIsBetter: false })
        : { direction: "na" as const, tone: "neutral" as Tone }),
    },
  ];

  return (
    <div className="text-sm">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-2 items-center">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">Metric</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide text-right">
          Latest<br /><span className="normal-case font-normal">{new Date(latest.run_date).toLocaleDateString()}</span>
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide text-right">
          Previous<br /><span className="normal-case font-normal">{new Date(previous.run_date).toLocaleDateString()}</span>
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide text-right">Change</div>

        {rows.map((row) => (
          <RowCells key={row.label} row={row} />
        ))}
      </div>
    </div>
  );
}

function RowCells({ row }: { row: { label: string; latest: string; previous: string; delta: string | null; direction: "up" | "down" | "flat" | "na"; tone: Tone } }) {
  const toneClass =
    row.tone === "positive" ? "text-primary" : row.tone === "negative" ? "text-destructive" : "text-muted-foreground";
  const Icon = row.direction === "up" ? ArrowUp : row.direction === "down" ? ArrowDown : Minus;

  return (
    <>
      <div className="font-medium text-foreground">{row.label}</div>
      <div className="text-right font-bold text-foreground">{row.latest}</div>
      <div className="text-right text-muted-foreground">{row.previous}</div>
      <div className={`text-right font-medium flex items-center justify-end gap-1 ${toneClass}`}>
        {row.direction === "na" || row.delta == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            <Icon className="w-3 h-3" />
            <span>{row.delta}</span>
          </>
        )}
      </div>
    </>
  );
}

function evalDirection(
  latest: number,
  previous: number,
  { lowerIsBetter }: { lowerIsBetter: boolean },
): { direction: "up" | "down" | "flat"; tone: Tone } {
  const diff = latest - previous;
  if (Math.abs(diff) < 1e-6) return { direction: "flat", tone: "neutral" };
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  return {
    direction: better ? "up" : "down",
    tone: better ? "positive" : "negative",
  };
}

function formatDelta(diff: number, fmt: (n: number) => string): string {
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  return `${sign}${fmt(Math.abs(diff))}`;
}

function formatDeltaTime(diffMin: number): string {
  const sign = diffMin > 0 ? "+" : diffMin < 0 ? "−" : "";
  return `${sign}${formatMinSec(Math.abs(diffMin))}`;
}
