import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sun, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch";

interface EventRow {
  id: string;
  title: string;
  route_distance_m: number | null;
  route_elevation_gain_m: number | null;
  route_elevation_loss_m: number | null;
  alpha: number;
  results_published: boolean;
}

interface Participant {
  user_id: string;
  display_name: string;
  has_result: boolean;
}

function parseDuration(input: string): number | null {
  // Accept "mm:ss" or plain seconds
  if (!input) return null;
  if (input.includes(":")) {
    const [m, s] = input.split(":").map((x) => parseInt(x, 10));
    if (isNaN(m) || isNaN(s)) return null;
    return m * 60 + s;
  }
  const n = parseInt(input, 10);
  return isNaN(n) ? null : n;
}

export default function EventTiming() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [ev, setEv] = useState<EventRow | null>(null);
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Add-result form state
  const [newUserId, setNewUserId] = useState<string>("");
  const [newDuration, setNewDuration] = useState<string>("");
  const [newRpe, setNewRpe] = useState<string>("");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/dashboard");
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => { if (user && isAdmin && eventId) fetchData(); }, [user, isAdmin, eventId]);

  useRealtimeRefetch("event_results", () => {
    if (user && isAdmin && eventId) fetchData();
  });

  const fetchData = async () => {
    setLoadingData(true);
    const { data: evData } = await supabase
      .from("events")
      .select("id,title,route_distance_m,route_elevation_gain_m,route_elevation_loss_m,alpha,results_published")
      .eq("id", eventId!).maybeSingle();
    setEv(evData as EventRow | null);

    const [{ data: rs }, { data: parts }] = await Promise.all([
      supabase.from("event_results").select("user_id").eq("event_id", eventId!),
      supabase.from("event_participants").select("user_id").eq("event_id", eventId!),
    ]);

    const userIds = Array.from(new Set([
      ...(rs || []).map((r) => r.user_id),
      ...(parts || []).map((p) => p.user_id),
    ]));
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds)
      : { data: [] as any[] };
    const nameMap = new Map((profs || []).map((p) => [p.user_id, p.display_name]));

    const resultUserIds = new Set((rs || []).map((r) => r.user_id));
    setParticipants(
      (parts || []).map((p) => ({
        user_id: p.user_id,
        display_name: nameMap.get(p.user_id) || "Runner",
        has_result: resultUserIds.has(p.user_id),
      })),
    );
    setLoadingData(false);
  };

  const saveRoute = async () => {
    if (!ev) return;
    const { error } = await supabase.from("events").update({
      route_distance_m: ev.route_distance_m,
      route_elevation_gain_m: ev.route_elevation_gain_m,
      route_elevation_loss_m: ev.route_elevation_loss_m,
      alpha: ev.alpha,
    }).eq("id", ev.id);
    if (error) toast.error("Failed to save");
    else {
      toast.success("Route data saved — RR will recalculate");
      // Cascade alpha to existing results so RR refreshes
      await supabase.from("event_results")
        .update({ alpha_used: ev.alpha })
        .eq("event_id", ev.id);
      fetchData();
    }
  };

  const addManualResult = async () => {

  const addManualResult = async () => {
    if (!ev) return;
    if (!newUserId) return toast.error("Pick a participant");
    const dur = parseDuration(newDuration);
    if (!dur || dur <= 0) return toast.error("Enter a valid duration (mm:ss)");
    let rpeVal: number | null = null;
    if (newRpe) {
      const n = parseInt(newRpe, 10);
      if (isNaN(n) || n < 1 || n > 10) return toast.error("RPE must be 1-10");
      rpeVal = n;
    }
    if (!ev.route_distance_m) return toast.error("Set route distance first");

    setBusy(true);
    const { error } = await supabase.from("event_results").insert({
      event_id: ev.id,
      user_id: newUserId,
      source: "manual",
      submitted_duration_s: dur,
      duration_s: dur,
      distance_m: ev.route_distance_m,
      elevation_gain_m: ev.route_elevation_gain_m,
      elevation_loss_m: ev.route_elevation_loss_m,
      alpha_used: ev.alpha,
      rpe: rpeVal,
      status: "verified",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Result added");
    setNewUserId(""); setNewDuration(""); setNewRpe("");
    fetchData();
  };

  if (loading || loadingData || !ev) {
    return <div className="min-h-screen flex items-center justify-center"><Sun className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  const availableParticipants = participants.filter((p) => !p.has_result);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">{ev.title} — Timing</h1>
          <p className="text-sm text-muted-foreground">Manage route data and runner results</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Route Parameters</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Updating these recalculates Run Rating (RR) for all results on this event.</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Distance (m) *</Label><Input type="number" value={ev.route_distance_m ?? ""} onChange={(e) => setEv({ ...ev, route_distance_m: e.target.value ? parseInt(e.target.value) : null })} /></div>
              <div><Label>Alpha</Label><Input type="number" step="0.1" value={ev.alpha} onChange={(e) => setEv({ ...ev, alpha: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Elevation gain (m)</Label><Input type="number" value={ev.route_elevation_gain_m ?? ""} onChange={(e) => setEv({ ...ev, route_elevation_gain_m: e.target.value ? parseInt(e.target.value) : null })} /></div>
              <div><Label>Elevation loss (m)</Label><Input type="number" value={ev.route_elevation_loss_m ?? ""} onChange={(e) => setEv({ ...ev, route_elevation_loss_m: e.target.value ? parseInt(e.target.value) : null })} /></div>
            </div>
            <Button onClick={saveRoute}>Save & recalculate</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Add Result for Participant</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {availableParticipants.length === 0 ? (
              <p className="text-sm text-muted-foreground">All joined participants already have a result.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="md:col-span-2">
                  <Label>Participant</Label>
                  <Select value={newUserId} onValueChange={setNewUserId}>
                    <SelectTrigger><SelectValue placeholder="Select runner" /></SelectTrigger>
                    <SelectContent>
                      {availableParticipants.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duration (mm:ss)</Label>
                  <Input value={newDuration} onChange={(e) => setNewDuration(e.target.value)} placeholder="28:45" />
                </div>
                <div>
                  <Label>RPE (1-10)</Label>
                  <Input value={newRpe} onChange={(e) => setNewRpe(e.target.value)} placeholder="optional" />
                </div>
                <Button className="md:col-span-4" onClick={addManualResult} disabled={busy}>
                  <Plus className="w-4 h-4 mr-1" /> Add result
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
