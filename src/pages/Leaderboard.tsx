import { useEffect, useState, useMemo } from "react";
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

interface OfficialResult {
  user_id: string;
  performance_score: number;
  event_title: string;
  event_date: string;
  event_id: string;
}

interface CasualAgg {
  user_id: string;
  total_km: number;
  total_runs: number;
  fastest_pace: number | null;
}

interface Profile {
  user_id: string;
  display_name: string;
}

export default function Leaderboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [results, setResults] = useState<OfficialResult[]>([]);
  const [casual, setCasual] = useState<CasualAgg[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  useRealtimeRefetch("event_results", () => {
    if (user) fetchData();
  });

  const fetchData = async () => {
    setLoadingData(true);
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .eq("show_on_leaderboard", true);

    if (!profs || profs.length === 0) {
      setProfiles([]);
      setResults([]);
      setCasual([]);
      setLoadingData(false);
      return;
    }
    const ids = profs.map((p) => p.user_id);
    setProfiles(profs);

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

    setResults(
      (orRes.data || []).map((r: any) => ({
        user_id: r.user_id,
        performance_score: Number(r.performance_score),
        event_title: r.events?.title || "Event",
        event_date: r.events?.event_date || "",
        event_id: r.event_id,
      }))
    );

    const aggMap = new Map<string, CasualAgg>();
    for (const id of ids) aggMap.set(id, { user_id: id, total_km: 0, total_runs: 0, fastest_pace: null });
    for (const r of runsRes.data || []) {
      const a = aggMap.get(r.user_id)!;
      a.total_km += Number(r.distance_km);
      a.total_runs += 1;
      if (r.time_taken_minutes && r.distance_km > 0) {
        const pace = Number(r.time_taken_minutes) / Number(r.distance_km);
        if (a.fastest_pace == null || pace < a.fastest_pace) a.fastest_pace = pace;
      }
    }
    for (const r of (erDistRes.data || []) as any[]) {
      const distM = r.distance_m ?? r.events?.route_distance_m;
      if (!distM) continue;
      const a = aggMap.get(r.user_id)!;
      const km = Number(distM) / 1000;
      a.total_km += km;
      a.total_runs += 1;
      if (r.duration_s && km > 0) {
        const pace = (Number(r.duration_s) / 60) / km;
        if (a.fastest_pace == null || pace < a.fastest_pace) a.fastest_pace = pace;
      }
    }
    for (const r of casualRes.data || []) {
      if (!r.distance_m) continue;
      const a = aggMap.get(r.user_id)!;
      const km = Number(r.distance_m) / 1000;
      a.total_km += km;
      a.total_runs += 1;
      if (r.duration_s && km > 0) {
        const pace = (Number(r.duration_s) / 60) / km;
        if (a.fastest_pace == null || pace < a.fastest_pace) a.fastest_pace = pace;
      }
    }
    setCasual(Array.from(aggMap.values()));
    setLoadingData(false);
  };

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.user_id, p.display_name));
    return (id: string) => m.get(id) || "Runner";
  }, [profiles]);

  // Best RR
  const bestRR = useMemo(() => {
    const map = new Map<string, OfficialResult>();
    for (const r of results) {
      const cur = map.get(r.user_id);
      if (!cur || r.performance_score > cur.performance_score) map.set(r.user_id, r);
    }
    return Array.from(map.values()).sort((a, b) => b.performance_score - a.performance_score);
  }, [results]);

  // Avg RR (last 4 by event date)
  const avgRR = useMemo(() => {
    const grouped = new Map<string, OfficialResult[]>();
    const sorted = [...results].sort((a, b) => (a.event_date < b.event_date ? 1 : -1));
    for (const r of sorted) {
      const arr = grouped.get(r.user_id) || [];
      if (arr.length < 4) arr.push(r);
      grouped.set(r.user_id, arr);
    }
    const all = profiles.map((p) => {
      const arr = grouped.get(p.user_id) || [];
      const avg = arr.length ? arr.reduce((s, r) => s + r.performance_score, 0) / arr.length : null;
      return { user_id: p.user_id, avg, count: arr.length };
    });
    return all.sort((a, b) => {
      if (a.avg == null && b.avg == null) return 0;
      if (a.avg == null) return 1;
      if (b.avg == null) return -1;
      return b.avg - a.avg;
    });
  }, [results, profiles]);

  const totalDistance = useMemo(
    () => [...casual].sort((a, b) => b.total_km - a.total_km),
    [casual]
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

        {profiles.length === 0 ? (
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
                      {bestRR.map((r, i) => (
                        <TableRow key={r.user_id} className={i < 3 ? "bg-primary/5" : ""}>
                          <TableCell><Rank i={i} /></TableCell>
                          <TableCell className="font-medium">{nameOf(r.user_id)}</TableCell>
                          <TableCell className="text-right font-bold">{formatRR(r.performance_score)}</TableCell>
                          <TableCell className="text-muted-foreground">{r.event_title}</TableCell>
                          <TableCell className="text-muted-foreground">{r.event_date ? new Date(r.event_date).toLocaleDateString() : "—"}</TableCell>
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
                    {avgRR.map((r, i) => (
                      <TableRow key={r.user_id} className={r.avg != null && i < 3 ? "bg-primary/5" : ""}>
                        <TableCell><Rank i={i} faded={r.avg == null} /></TableCell>
                        <TableCell className="font-medium">{nameOf(r.user_id)}</TableCell>
                        <TableCell className="text-right font-bold">{r.avg != null ? formatRR(r.avg) : "—"}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.count}</TableCell>
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
                    {totalDistance.map((r, i) => (
                      <TableRow key={r.user_id} className={i < 3 && r.total_km > 0 ? "bg-primary/5" : ""}>
                        <TableCell><Rank i={i} faded={r.total_km === 0} /></TableCell>
                        <TableCell className="font-medium">{nameOf(r.user_id)}</TableCell>
                        <TableCell className="text-right font-bold">{r.total_km.toFixed(3)} km</TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.total_runs}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.fastest_pace ? `${r.fastest_pace.toFixed(1)} min/km` : "—"}</TableCell>
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

function Rank({ i, faded }: { i: number; faded?: boolean }) {
  if (faded) return <span className="text-muted-foreground">—</span>;
  if (i === 0) return <span className="inline-flex items-center gap-1 font-bold text-primary"><Medal className="w-4 h-4" />1</span>;
  if (i === 1) return <span className="inline-flex items-center gap-1 font-bold text-accent"><Medal className="w-4 h-4" />2</span>;
  if (i === 2) return <span className="inline-flex items-center gap-1 font-bold text-secondary-foreground"><Medal className="w-4 h-4" />3</span>;
  return <span className="font-bold">{i + 1}</span>;
}
