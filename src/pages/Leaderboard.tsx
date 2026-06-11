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

export default function Leaderboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    const { data } = await supabase.rpc("get_leaderboard_summary");
    setRows((data || []) as LeaderboardRow[]);
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

function Rank({ i, faded }: { i: number; faded?: boolean }) {
  if (faded) return <span className="text-muted-foreground">—</span>;
  if (i === 0) return <span className="inline-flex items-center gap-1 font-bold text-primary"><Medal className="w-4 h-4" />1</span>;
  if (i === 1) return <span className="inline-flex items-center gap-1 font-bold text-accent"><Medal className="w-4 h-4" />2</span>;
  if (i === 2) return <span className="inline-flex items-center gap-1 font-bold text-secondary-foreground"><Medal className="w-4 h-4" />3</span>;
  return <span className="font-bold">{i + 1}</span>;
}
