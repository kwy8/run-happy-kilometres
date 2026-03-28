import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sun } from "lucide-react";

interface LeaderboardEntry {
  display_name: string;
  total_km: number;
  total_runs: number;
  fastest_pace: number | null;
}

export default function Leaderboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchLeaderboard();
  }, [user]);

  const fetchLeaderboard = async () => {
    setLoadingData(true);
    // Get profiles that opted in
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .eq("show_on_leaderboard", true);

    if (!profiles || profiles.length === 0) {
      setEntries([]);
      setLoadingData(false);
      return;
    }

    const leaderboard: LeaderboardEntry[] = await Promise.all(
      profiles.map(async (profile) => {
        const { data: runs } = await supabase
          .from("runs")
          .select("distance_km, time_taken_minutes")
          .eq("user_id", profile.user_id);

        const totalKm = runs?.reduce((sum, r) => sum + r.distance_km, 0) || 0;
        const totalRuns = runs?.length || 0;
        let fastestPace: number | null = null;
        runs?.forEach((r) => {
          if (r.time_taken_minutes && r.distance_km > 0) {
            const pace = r.time_taken_minutes / r.distance_km;
            if (!fastestPace || pace < fastestPace) fastestPace = pace;
          }
        });

        return { display_name: profile.display_name, total_km: totalKm, total_runs: totalRuns, fastest_pace: fastestPace };
      })
    );

    leaderboard.sort((a, b) => b.total_km - a.total_km);
    setEntries(leaderboard);
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
        <h1 className="text-2xl font-display font-bold text-foreground">Leaderboard</h1>

        {entries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No runners on the leaderboard yet. Toggle your visibility in Dashboard!
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Total Distance</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Fastest Pace</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-bold">{i + 1}</TableCell>
                      <TableCell className="font-medium">{entry.display_name}</TableCell>
                      <TableCell>{entry.total_km.toFixed(1)} km</TableCell>
                      <TableCell>{entry.total_runs}</TableCell>
                      <TableCell>{entry.fastest_pace ? `${entry.fastest_pace.toFixed(1)} min/km` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
