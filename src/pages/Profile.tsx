import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Sun } from "lucide-react";
import { formatMinSec, formatPace } from "@/lib/time";
import { formatRR, RR_ABBR, RR_TOOLTIP } from "@/lib/score";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch";

import { SourceBadge } from "@/components/SourceBadge";

interface HistoryRow {
  id: string;
  date: string;
  type: "Casual" | string; // event title for official, or casual route name
  source: "casual" | "official" | "casual_admin";
  method?: "qr" | "manual" | null;
  status?: string | null;
  has_proof?: boolean;
  distance_km: number;
  time_min: number | null;
  rr: number | null;
  event_id?: string;
}

const PAGE_SIZE = 20;

export default function Profile() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string; show_on_leaderboard: boolean; created_at: string } | null>(null);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [filter, setFilter] = useState<"all" | "casual" | "official">("all");
  const [page, setPage] = useState(0);
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
    const promises: any[] = [
      supabase.from("profiles").select("display_name, show_on_leaderboard, created_at").eq("user_id", user!.id).single(),
      supabase.from("runs").select("id, distance_km, run_date, time_taken_minutes").eq("user_id", user!.id),
      supabase
        .from("event_results")
        .select("id, event_id, duration_s, distance_m, performance_score, source, status, proof_image_url, events(title, event_date, route_distance_m)")
        .eq("user_id", user!.id),
    ];
    if (isAdmin) {
      promises.push(
        supabase.from("casual_runs").select("id, route_name, distance_m, duration_s, performance_score, created_at").eq("user_id", user!.id),
      );
    }
    const [profileRes, runsRes, orRes, casualAdminRes] = await Promise.all(promises);

    if (profileRes.data) setProfile(profileRes.data as any);

    const casual: HistoryRow[] = (runsRes.data || []).map((r: any) => ({
      id: `c-${r.id}`,
      date: r.run_date,
      type: "Casual (legacy)",
      source: "casual",
      distance_km: Number(r.distance_km),
      time_min: r.time_taken_minutes != null ? Number(r.time_taken_minutes) : null,
      rr: null,
    }));
    const official: HistoryRow[] = (orRes.data || []).map((r: any) => {
      const distM = r.distance_m ?? r.events?.route_distance_m ?? null;
      return {
        id: `o-${r.id}`,
        date: r.events?.event_date || new Date().toISOString().slice(0, 10),
        type: r.events?.title || "Official Event",
        source: "official",
        method: r.source,
        status: r.status,
        has_proof: !!r.proof_image_url,
        distance_km: distM ? distM / 1000 : 0,
        time_min: r.duration_s != null ? r.duration_s / 60 : null,
        rr: r.status === "verified" ? r.performance_score : null,
        event_id: r.event_id,
      };
    });
    const casualAdmin: HistoryRow[] = (casualAdminRes?.data || []).map((r: any) => ({
      id: `ca-${r.id}`,
      date: r.created_at.slice(0, 10),
      type: `🧪 ${r.route_name}`,
      source: "casual_admin",
      distance_km: r.distance_m ? r.distance_m / 1000 : 0,
      time_min: r.duration_s != null ? r.duration_s / 60 : null,
      rr: r.performance_score,
    }));

    const merged = [...casual, ...official, ...casualAdmin].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0
    );
    setRows(merged);
    setLoadingData(false);
  };

  const toggleLeaderboard = async (checked: boolean) => {
    await supabase.from("profiles").update({ show_on_leaderboard: checked }).eq("user_id", user!.id);
    setProfile((p) => (p ? { ...p, show_on_leaderboard: checked } : p));
    toast.success(checked ? "You're now on the leaderboard!" : "Removed from leaderboard");
  };

  const filtered = useMemo(
    () => rows.filter((r) => (filter === "all" ? true : r.source === filter)),
    [rows, filter]
  );

  const stats = useMemo(() => {
    const totalKm = rows.reduce((s, r) => s + r.distance_km, 0);
    const officialRR = rows.filter((r) => r.source === "official" && r.rr != null).map((r) => r.rr as number);
    const bestRR = officialRR.length ? Math.max(...officialRR) : null;
    const last4 = officialRR.slice(0, 4);
    const avgRR = last4.length ? last4.reduce((s, n) => s + n, 0) / last4.length : null;
    return { totalKm, totalRuns: rows.length, bestRR, avgRR };
  }, [rows]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

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
          <h1 className="text-2xl font-display font-bold text-foreground">{profile?.display_name || "Profile"}</h1>
          {profile?.created_at && (
            <p className="text-sm text-muted-foreground">
              Member since {new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>
          )}
        </div>

        {/* Lifetime stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Runs" value={String(stats.totalRuns)} />
          <StatCard label="Total Distance" value={`${stats.totalKm.toFixed(1)} km`} />
          <StatCard label={`Best ${RR_ABBR}`} value={stats.bestRR != null ? formatRR(stats.bestRR) : "—"} />
          <StatCard label={`Avg ${RR_ABBR} (last 4)`} value={stats.avgRR != null ? formatRR(stats.avgRR) : "—"} />
        </div>

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

        {/* History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Run History</CardTitle>
            <Tabs value={filter} onValueChange={(v) => { setFilter(v as any); setPage(0); }}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="casual">Casual</TabsTrigger>
                <TabsTrigger value="official">Official</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No runs yet.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Distance</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                      <TableHead className="text-right">Pace</TableHead>
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help underline decoration-dotted">{RR_ABBR}</TooltipTrigger>
                          <TooltipContent><p className="max-w-xs">{RR_TOOLTIP}</p></TooltipContent>
                        </Tooltip>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r) => {
                      const pace = r.time_min != null && r.distance_km > 0 ? r.time_min / r.distance_km : null;
                      const TypeCell = r.event_id ? (
                        <Link to={`/events/${r.event_id}`} className="text-primary hover:underline">{r.type}</Link>
                      ) : (
                        <span className="text-muted-foreground">{r.type}</span>
                      );
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                          <TableCell>{TypeCell}</TableCell>
                          <TableCell className="text-right">{r.distance_km.toFixed(1)} km</TableCell>
                          <TableCell className="text-right">{r.time_min != null ? formatMinSec(r.time_min) : "—"}</TableCell>
                          <TableCell className="text-right">{pace != null ? formatPace(pace) : "—"}</TableCell>
                          <TableCell className="text-right font-medium">{r.source === "official" ? formatRR(r.rr) : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 text-sm">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                    <span className="text-muted-foreground">Page {page + 1} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
