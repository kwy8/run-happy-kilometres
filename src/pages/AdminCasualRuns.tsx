import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sun, Trash2, Beaker } from "lucide-react";
import { toast } from "sonner";
import { formatRR, RR_ABBR } from "@/lib/score";

interface CasualRun {
  id: string;
  user_id: string;
  route_name: string;
  terrain_type: string;
  distance_m: number;
  elevation_gain_m: number;
  alpha_used: number;
  duration_s: number;
  performance_score: number | null;
  rpe: number | null;
  included_in_calibration: boolean;
  created_at: string;
}

const TERRAINS = ["road", "trail", "mixed", "track", "gravel"] as const;

export default function AdminCasualRuns() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<CasualRun[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // form state
  const [routeName, setRouteName] = useState("");
  const [terrain, setTerrain] = useState<string>("road");
  const [distanceKm, setDistanceKm] = useState("");
  const [gainM, setGainM] = useState("");
  const [lossM, setLossM] = useState("");
  const [alpha, setAlpha] = useState("5");
  const [timeMin, setTimeMin] = useState("");
  const [timeSec, setTimeSec] = useState("");
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [weather, setWeather] = useState("");
  const [includeCalib, setIncludeCalib] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/dashboard");
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => {
    if (user && isAdmin) fetchRuns();
  }, [user, isAdmin]);

  const fetchRuns = async () => {
    setLoadingData(true);
    const { data } = await supabase
      .from("casual_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setRuns((data as CasualRun[]) || []);
    setLoadingData(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dKm = parseFloat(distanceKm);
    const gain = parseInt(gainM || "0", 10);
    const loss = lossM ? parseInt(lossM, 10) : null;
    const a = parseFloat(alpha);
    const min = parseInt(timeMin || "0", 10);
    const sec = parseInt(timeSec || "0", 10);
    const dur = min * 60 + sec;
    if (!routeName.trim()) return toast.error("Route name required");
    if (!dKm || dKm <= 0 || dKm > 200) return toast.error("Invalid distance");
    if (!dur || dur > 86400) return toast.error("Invalid duration");
    if (isNaN(a)) return toast.error("Invalid alpha");

    setSubmitting(true);
    const { error } = await supabase.from("casual_runs").insert({
      user_id: user!.id,
      route_name: routeName.trim(),
      terrain_type: terrain as any,
      distance_m: Math.round(dKm * 1000),
      elevation_gain_m: gain,
      elevation_loss_m: loss,
      alpha_used: a,
      duration_s: dur,
      rpe: rpe ? parseInt(rpe, 10) : null,
      notes: notes || null,
      weather_notes: weather || null,
      included_in_calibration: includeCalib,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Casual run logged 🧪");
    setRouteName(""); setDistanceKm(""); setGainM(""); setLossM("");
    setTimeMin(""); setTimeSec(""); setRpe(""); setNotes(""); setWeather("");
    setIncludeCalib(false);
    fetchRuns();
  };

  const deleteRun = async (id: string) => {
    if (!confirm("Delete this casual run?")) return;
    const { error } = await supabase.from("casual_runs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    fetchRuns();
  };

  const toggleCalib = async (id: string, val: boolean) => {
    const { error } = await supabase.from("casual_runs").update({ included_in_calibration: val }).eq("id", id);
    if (error) return toast.error(error.message);
    fetchRuns();
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
        <div className="flex items-center gap-2">
          <Beaker className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Casual Runs <span className="text-sm font-normal text-muted-foreground">· admin beta</span></h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Log exploratory runs to test Run Rating and gather route-calibration data.
          These do NOT appear on official leaderboards.
        </p>

        <Card>
          <CardHeader><CardTitle>Log a casual run</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Route name *</Label>
                <Input value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="e.g. Park 5k loop" />
              </div>
              <div>
                <Label>Terrain</Label>
                <Select value={terrain} onValueChange={setTerrain}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TERRAINS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Distance (km) *</Label>
                <Input type="number" step="0.01" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
              </div>
              <div>
                <Label>Elevation gain (m)</Label>
                <Input type="number" value={gainM} onChange={(e) => setGainM(e.target.value)} />
              </div>
              <div>
                <Label>Elevation loss (m)</Label>
                <Input type="number" value={lossM} onChange={(e) => setLossM(e.target.value)} />
              </div>
              <div>
                <Label>Alpha</Label>
                <Input type="number" step="0.01" value={alpha} onChange={(e) => setAlpha(e.target.value)} />
              </div>
              <div>
                <Label>Duration *</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} placeholder="min" />
                  <span className="text-muted-foreground">:</span>
                  <Input type="number" min="0" max="59" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} placeholder="sec" />
                </div>
              </div>
              <div>
                <Label>RPE (1-10)</Label>
                <Input type="number" min="1" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <div className="md:col-span-2">
                <Label>Weather notes</Label>
                <Input value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="hot, windy..." />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <Switch checked={includeCalib} onCheckedChange={setIncludeCalib} id="calib" />
                <Label htmlFor="calib" className="cursor-pointer">Include in calibration sample</Label>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save Casual Run"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent casual runs</CardTitle></CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No casual runs yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Terrain</TableHead>
                    <TableHead className="text-right">km</TableHead>
                    <TableHead className="text-right">+m</TableHead>
                    <TableHead className="text-right">α</TableHead>
                    <TableHead className="text-right">{RR_ABBR}</TableHead>
                    <TableHead>Calib</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{r.route_name}</TableCell>
                      <TableCell className="text-xs">{r.terrain_type}</TableCell>
                      <TableCell className="text-right">{(r.distance_m / 1000).toFixed(3)}</TableCell>
                      <TableCell className="text-right">{r.elevation_gain_m}</TableCell>
                      <TableCell className="text-right">{Number(r.alpha_used).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">{formatRR(r.performance_score)}</TableCell>
                      <TableCell>
                        <Switch checked={r.included_in_calibration} onCheckedChange={(v) => toggleCalib(r.id, v)} />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => deleteRun(r.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
