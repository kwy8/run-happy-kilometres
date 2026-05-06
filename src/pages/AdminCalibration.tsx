import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

type Route = {
  id: string;
  name: string;
  description: string | null;
  surface_type: string;
  distance_m: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  technicality_rating: number | null;
  terrain_notes: string | null;
  current_alpha: number;
  suggested_alpha: number | null;
  alpha_status: string;
  calibration_confidence: number | null;
  calibration_sample_size: number;
  alpha_last_updated_at: string | null;
  alpha_notes: string | null;
};

type Experiment = {
  id: string;
  route_id: string;
  previous_alpha: number;
  proposed_alpha: number;
  reason: string | null;
  confidence_score: number | null;
  sample_size: number | null;
  status: string;
  created_at: string;
};

type HistoryRow = {
  id: string;
  route_id: string;
  previous_alpha: number | null;
  new_alpha: number;
  source: string;
  reason: string | null;
  created_at: string;
};

const statusBadge: Record<string, string> = {
  default: "bg-muted text-muted-foreground",
  testing: "bg-amber-500/15 text-amber-700",
  calibrated: "bg-emerald-500/15 text-emerald-700",
  needs_review: "bg-rose-500/15 text-rose-700",
};

export default function AdminCalibration() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [manualAlpha, setManualAlpha] = useState("");
  const [editReason, setEditReason] = useState("");
  const [details, setDetails] = useState({
    name: "", description: "", distance_m: "", elevation_gain_m: "", elevation_loss_m: "",
    surface_type: "road", technicality_rating: "3", terrain_notes: "",
  });

  function openEdit(r: Route) {
    setEditingRoute(r);
    setManualAlpha(String(r.current_alpha));
    setEditReason("");
    setDetails({
      name: r.name ?? "",
      description: r.description ?? "",
      distance_m: r.distance_m?.toString() ?? "",
      elevation_gain_m: r.elevation_gain_m?.toString() ?? "",
      elevation_loss_m: r.elevation_loss_m?.toString() ?? "",
      surface_type: r.surface_type ?? "road",
      technicality_rating: r.technicality_rating?.toString() ?? "3",
      terrain_notes: r.terrain_notes ?? "",
    });
  }

  async function saveDetails() {
    if (!editingRoute) return;
    const { error } = await supabase.from("routes").update({
      name: details.name,
      description: details.description || null,
      distance_m: details.distance_m ? parseInt(details.distance_m) : null,
      elevation_gain_m: details.elevation_gain_m ? parseInt(details.elevation_gain_m) : null,
      elevation_loss_m: details.elevation_loss_m ? parseInt(details.elevation_loss_m) : null,
      surface_type: details.surface_type as any,
      technicality_rating: details.technicality_rating ? parseInt(details.technicality_rating) : null,
      terrain_notes: details.terrain_notes || null,
    }).eq("id", editingRoute.id);
    if (error) return toast.error(error.message);
    toast.success("Route details saved");
    setEditingRoute(null);
    await load();
  }

  const [creating, setCreating] = useState(false);
  const [newRoute, setNewRoute] = useState({
    name: "",
    description: "",
    distance_m: "",
    elevation_gain_m: "",
    elevation_loss_m: "",
    surface_type: "road",
    technicality_rating: "3",
    terrain_notes: "",
  });

  useEffect(() => {
    if (loading) return;
    if (!user) return navigate("/auth");
    if (!isAdmin) return navigate("/dashboard");
    void load();
  }, [loading, user, isAdmin]);

  async function load() {
    const [r, e, h] = await Promise.all([
      supabase.from("routes").select("*").order("name"),
      supabase.from("alpha_experiments").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("route_alpha_history").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (r.data) setRoutes(r.data as Route[]);
    if (e.data) setExperiments(e.data as Experiment[]);
    if (h.data) setHistory(h.data as HistoryRow[]);
  }

  async function reanalyze(route_id: string) {
    setBusy(route_id);
    const { data, error } = await supabase.functions.invoke("recommend-alpha", { body: { route_id } });
    setBusy(null);
    if (error) return toast.error(error.message);
    if (data?.insufficient) {
      toast.warning("Not enough data yet", { description: data.reasons?.join(" · ") });
    } else {
      toast.success("Recommendation generated");
    }
    await load();
  }

  async function decide(action: string, route_id: string, opts: any = {}) {
    setBusy(route_id);
    const { error } = await supabase.functions.invoke("apply-alpha-decision", {
      body: { action, route_id, ...opts },
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Done");
    setEditingRoute(null);
    await load();
  }

  async function createRoute() {
    const { error } = await supabase.from("routes").insert({
      name: newRoute.name,
      description: newRoute.description || null,
      distance_m: newRoute.distance_m ? parseInt(newRoute.distance_m) : null,
      elevation_gain_m: newRoute.elevation_gain_m ? parseInt(newRoute.elevation_gain_m) : null,
      elevation_loss_m: newRoute.elevation_loss_m ? parseInt(newRoute.elevation_loss_m) : null,
      surface_type: newRoute.surface_type as any,
      technicality_rating: parseInt(newRoute.technicality_rating),
      terrain_notes: newRoute.terrain_notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Route created");
    setCreating(false);
    setNewRoute({ name: "", description: "", distance_m: "", elevation_gain_m: "", elevation_loss_m: "", surface_type: "road", technicality_rating: "3", terrain_notes: "" });
    await load();
  }

  const pendingByRoute = new Map<string, Experiment>();
  for (const e of experiments) if (e.status === "proposed" && !pendingByRoute.has(e.route_id)) pendingByRoute.set(e.route_id, e);

  if (loading) return <AppLayout><p className="text-muted-foreground">Loading…</p></AppLayout>;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Route Calibration</h1>
          <p className="text-muted-foreground text-sm mt-1">Tune route-difficulty alpha based on historical run data.</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ New Route</Button>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Routes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Surface</TableHead>
                  <TableHead className="text-right">Current α</TableHead>
                  <TableHead className="text-right">Suggested α</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((r) => {
                  const pending = pendingByRoute.get(r.id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{r.surface_type}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(r.current_alpha).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pending ? (
                          <span className={pending.proposed_alpha > r.current_alpha ? "text-rose-600" : "text-emerald-600"}>
                            {Number(pending.proposed_alpha).toFixed(2)}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.calibration_confidence != null ? `${Math.round(Number(r.calibration_confidence) * 100)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.calibration_sample_size}</TableCell>
                      <TableCell>
                        <Badge className={statusBadge[r.alpha_status] ?? ""}>{r.alpha_status}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => reanalyze(r.id)}>Analyze</Button>
                        {pending && (
                          <>
                            <Button size="sm" variant="default" disabled={busy === r.id}
                              onClick={() => decide("accept", r.id, { experiment_id: pending.id })}>Accept</Button>
                            <Button size="sm" variant="outline" disabled={busy === r.id}
                              onClick={() => decide("reject", r.id, { experiment_id: pending.id })}>Reject</Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setEditingRoute(r); setManualAlpha(String(r.current_alpha)); setEditReason(""); }}>Edit</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {routes.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No routes yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {experiments.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Recent Experiments</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {experiments.slice(0, 10).map((e) => {
              const route = routes.find((r) => r.id === e.route_id);
              return (
                <div key={e.id} className="border-b border-border pb-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{route?.name ?? e.route_id.slice(0, 8)}</span>
                    <Badge variant="outline">{e.status}</Badge>
                  </div>
                  <div className="text-muted-foreground text-xs mt-0.5">
                    α {Number(e.previous_alpha).toFixed(2)} → {Number(e.proposed_alpha).toFixed(2)} ·
                    confidence {e.confidence_score != null ? `${Math.round(Number(e.confidence_score) * 100)}%` : "—"} ·
                    {new Date(e.created_at).toLocaleDateString()}
                  </div>
                  {e.reason && <p className="text-xs text-muted-foreground mt-1">{e.reason}</p>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Alpha Change History</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {history.slice(0, 15).map((h) => {
              const route = routes.find((r) => r.id === h.route_id);
              return (
                <div key={h.id} className="flex items-center justify-between border-b border-border py-1.5">
                  <span>{route?.name ?? h.route_id.slice(0, 8)} · <span className="text-muted-foreground">{h.source}</span></span>
                  <span className="tabular-nums text-muted-foreground">
                    {h.previous_alpha != null ? Number(h.previous_alpha).toFixed(2) : "—"} → {Number(h.new_alpha).toFixed(2)} ·
                    {" "}{new Date(h.created_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingRoute} onOpenChange={(o) => !o && setEditingRoute(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRoute?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Manual α override</Label>
              <Input type="number" step="0.1" value={manualAlpha} onChange={(e) => setManualAlpha(e.target.value)} />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => editingRoute && decide("reset", editingRoute.id, { reason: editReason })}>Reset to 5</Button>
            <Button variant="outline" onClick={() => editingRoute && decide("mark_calibrated", editingRoute.id)}>Mark calibrated</Button>
            <Button onClick={() => editingRoute && decide("manual", editingRoute.id, { new_alpha: parseFloat(manualAlpha), reason: editReason })}>
              Apply override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Route</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={newRoute.name} onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={newRoute.description} onChange={(e) => setNewRoute({ ...newRoute, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Distance (m)</Label><Input type="number" value={newRoute.distance_m} onChange={(e) => setNewRoute({ ...newRoute, distance_m: e.target.value })} /></div>
              <div><Label>Gain (m)</Label><Input type="number" value={newRoute.elevation_gain_m} onChange={(e) => setNewRoute({ ...newRoute, elevation_gain_m: e.target.value })} /></div>
              <div><Label>Loss (m)</Label><Input type="number" value={newRoute.elevation_loss_m} onChange={(e) => setNewRoute({ ...newRoute, elevation_loss_m: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Surface</Label>
                <Select value={newRoute.surface_type} onValueChange={(v) => setNewRoute({ ...newRoute, surface_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["road", "trail", "mixed", "track", "gravel"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Technicality (1–5)</Label>
                <Input type="number" min="1" max="5" value={newRoute.technicality_rating} onChange={(e) => setNewRoute({ ...newRoute, technicality_rating: e.target.value })} />
              </div>
            </div>
            <div><Label>Terrain notes</Label><Textarea value={newRoute.terrain_notes} onChange={(e) => setNewRoute({ ...newRoute, terrain_notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={createRoute} disabled={!newRoute.name}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
