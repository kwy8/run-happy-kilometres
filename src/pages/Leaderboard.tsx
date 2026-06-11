import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sun, Medal } from "lucide-react";
import { formatRR, RR_ABBR, RR_LABEL, RR_TOOLTIP } from "@/lib/score";
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch";

interface LeaderboardRow {
  user_id: string;
  display_name: string;
  best_rr: number | null;
  best_event_title: string | null;
  best_event_date: string | null;
  avg_rr: number | null;
  avg_rr_count: number;
  total_km: number;
  total_runs: number;
  fastest_pace: number | null;
}

interface Profile {
  user_id: string;
  display_name: string;
}

interface OfficialResult {
  user_id: string;
  performance_score: number;
  event_title: string;
  event_date: string;
}

interface DistanceAgg {
  user_id: string;
  total_km: number;
  total_runs: number;
  fastest_pace: number | null;
}

export default function Leaderboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    const { data, error } = await supabase.rpc("get_leaderboard_summary");
    if (!error && data) {
      setRows(data as LeaderboardRow[]);
      setLoadingData(false);
      return;
    }

    const fallbackRows = await fetchLeaderboardFallback();
    setRows(fallbackRows);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  useRealtimeRefetch("event_results", () => {
    if (user) fetchData();
  }, { debounceMs: 500 });

  const bestRR = useMemo(() => {
    return [...rows]
      .filter((row) => row.best_rr != null)
      .sort((a, b) => (b.best_rr ?? -Infinity) - (a.best_rr ?? -Infinity));
  }, [rows]);

  const avgRR = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.avg_rr == null && b.avg_rr == null) return 0;
      if (a.avg_rr == null) return 1;
      if (b.avg_rr == null) return -1;
      return b.avg_rr - a.avg_rr;
    });
  }, [rows]);

  const totalDistance = useMemo(
    () => [...rows].sort((a, b) => b.total_km - a.total_km),
    [rows]
  );

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
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">
            <Tooltip>
              <TooltipTrigger className="underline decoration-dotted cursor-help">{RR_LABEL} ({RR_ABBR})</TooltipTrigger>
              <TooltipContent><p className="max-w-xs">{RR_TOOLTIP}</p></TooltipContent>
            </Tooltip>
            {" "}— elevation-adjusted performance score from official events.
          </p>
        </div>

        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No runners on the leaderboard yet. Toggle visibility on your Profile!
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="best">
            <TabsList>
              <TabsTrigger value="best">Best {RR_ABBR}</TabsTrigger>
              <TabsTrigger value="avg">Avg {RR_ABBR} (last 4)</TabsTrigger>
              <TabsTrigger value="distance">Total Distance</TabsTrigger>
            </TabsList>

            <TabsContent value="best">
              <Card><CardContent className="pt-4">
                {bestRR.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No verified event results yet.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Best {RR_ABBR}</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {bestRR.map((row, i) => (
                        <TableRow key={row.user_id} className={i < 3 ? "bg-primary/5" : ""}>
                          <TableCell><Rank i={i} /></TableCell>
                          <TableCell className="font-medium">{row.display_name}</TableCell>
                          <TableCell className="text-right font-bold">{formatRR(row.best_rr)}</TableCell>
                          <TableCell className="text-muted-foreground">{row.best_event_title || "Event"}</TableCell>
                          <TableCell className="text-muted-foreground">{row.best_event_date ? new Date(row.best_event_date).toLocaleDateString() : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="avg">
              <Card><CardContent className="pt-4">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Avg {RR_ABBR}</TableHead>
                    <TableHead className="text-right">Results</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {avgRR.map((row, i) => (
                      <TableRow key={row.user_id} className={row.avg_rr != null && i < 3 ? "bg-primary/5" : ""}>
                        <TableCell><Rank i={i} faded={row.avg_rr == null} /></TableCell>
                        <TableCell className="font-medium">{row.display_name}</TableCell>
                        <TableCell className="text-right font-bold">{row.avg_rr != null ? formatRR(row.avg_rr) : "—"}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.avg_rr_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="distance">
              <Card><CardContent className="pt-4">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Total Distance</TableHead>
                    <TableHead className="text-right">Runs</TableHead>
                    <TableHead className="text-right">Fastest Pace</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {totalDistance.map((row, i) => (
                      <TableRow key={row.user_id} className={i < 3 && row.total_km > 0 ? "bg-primary/5" : ""}>
                        <TableCell><Rank i={i} faded={row.total_km === 0} /></TableCell>
                        <TableCell className="font-medium">{row.display_name}</TableCell>
                        <TableCell className="text-right font-bold">{row.total_km.toFixed(3)} km</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.total_runs}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.fastest_pace ? `${row.fastest_pace.toFixed(1)} min/km` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

async function fetchLeaderboardFallback(): Promise<LeaderboardRow[]> {
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .eq("show_on_leaderboard", true);

  const profiles = (profs || []) as Profile[];
  if (profiles.length === 0) return [];

  const ids = profiles.map((p) => p.user_id);
  const [orRes, runsRes, erDistRes, casualRes] = await Promise.all([
    supabase
      .from("event_results")
      .select("user_id, performance_score, event_id, events(title, event_date)")
      .in("user_id", ids)
      .eq("status", "verified")
      .not("performance_score", "is", null),
    supabase
      .from("runs")
      .select("user_id, distance_km, time_taken_minutes")
      .in("user_id", ids),
    supabase
      .from("event_results")
      .select("user_id, distance_m, duration_s, events(route_distance_m)")
      .in("user_id", ids),
    supabase
      .from("casual_runs")
      .select("user_id, distance_m, duration_s")
      .in("user_id", ids),
  ]);

  const officialResults: OfficialResult[] = ((orRes.data || []) as any[]).map((r) => ({
    user_id: r.user_id,
    performance_score: Number(r.performance_score),
    event_title: r.events?.title || "Event",
    event_date: r.events?.event_date || "",
  }));

  const bestMap = new Map<string, OfficialResult>();
  for (const result of officialResults) {
    const current = bestMap.get(result.user_id);
    if (!current || result.performance_score > current.performance_score) {
      bestMap.set(result.user_id, result);
    }
  }

  const recentMap = new Map<string, OfficialResult[]>();
  const recentSorted = [...officialResults].sort((a, b) => (a.event_date < b.event_date ? 1 : -1));
  for (const result of recentSorted) {
    const recent = recentMap.get(result.user_id) || [];
    if (recent.length < 4) recent.push(result);
    recentMap.set(result.user_id, recent);
  }

  const distanceMap = new Map<string, DistanceAgg>();
  for (const id of ids) {
    distanceMap.set(id, { user_id: id, total_km: 0, total_runs: 0, fastest_pace: null });
  }

  const addDistance = (userId: string, km: number, minutes: number | null | undefined) => {
    const agg = distanceMap.get(userId);
    if (!agg || !Number.isFinite(km) || km <= 0) return;
    agg.total_km += km;
    agg.total_runs += 1;
    if (minutes != null && minutes > 0) {
      const pace = minutes / km;
      if (agg.fastest_pace == null || pace < agg.fastest_pace) agg.fastest_pace = pace;
    }
  };

  for (const run of runsRes.data || []) {
    addDistance(run.user_id, Number(run.distance_km), run.time_taken_minutes == null ? null : Number(run.time_taken_minutes));
  }
  for (const result of (erDistRes.data || []) as any[]) {
    const distM = result.distance_m ?? result.events?.route_distance_m;
    if (!distM) continue;
    addDistance(result.user_id, Number(distM) / 1000, result.duration_s == null ? null : Number(result.duration_s) / 60);
  }
  for (const run of casualRes.data || []) {
    if (!run.distance_m) continue;
    addDistance(run.user_id, Number(run.distance_m) / 1000, run.duration_s == null ? null : Number(run.duration_s) / 60);
  }

  return profiles.map((profile) => {
    const best = bestMap.get(profile.user_id);
    const recent = recentMap.get(profile.user_id) || [];
    const avg = recent.length ? recent.reduce((sum, result) => sum + result.performance_score, 0) / recent.length : null;
    const distance = distanceMap.get(profile.user_id);
    return {
      user_id: profile.user_id,
      display_name: profile.display_name,
      best_rr: best?.performance_score ?? null,
      best_event_title: best?.event_title ?? null,
      best_event_date: best?.event_date ?? null,
      avg_rr: avg,
      avg_rr_count: recent.length,
      total_km: distance?.total_km ?? 0,
      total_runs: distance?.total_runs ?? 0,
      fastest_pace: distance?.fastest_pace ?? null,
    };
  });
}

function Rank({ i, faded }: { i: number; faded?: boolean }) {
  if (faded) return <span className="text-muted-foreground">—</span>;
  if (i === 0) return <span className="inline-flex items-center gap-1 font-bold text-primary"><Medal className="w-4 h-4" />1</span>;
  if (i === 1) return <span className="inline-flex items-center gap-1 font-bold text-accent"><Medal className="w-4 h-4" />2</span>;
  if (i === 2) return <span className="inline-flex items-center gap-1 font-bold text-secondary-foreground"><Medal className="w-4 h-4" />3</span>;
  return <span className="font-bold">{i + 1}</span>;
}
