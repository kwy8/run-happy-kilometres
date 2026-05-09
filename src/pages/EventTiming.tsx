import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sun, RefreshCw, Download, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch";

interface EventRow {
  id: string;
  title: string;
  qr_enabled: boolean;
  start_qr_token: string | null;
  finish_qr_token: string | null;
  route_distance_m: number | null;
  route_elevation_gain_m: number | null;
  route_elevation_loss_m: number | null;
  alpha: number;
  results_published: boolean;
}

interface ResultRow {
  id: string;
  user_id: string;
  display_name?: string;
  start_time: string | null;
  finish_time: string | null;
  duration_s: number | null;
  status: string;
  rpe: number | null;
  performance_score: number | null;
}

function fmtDur(s: number | null) {
  if (s == null) return "—";
  const m = Math.floor(s / 60); const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function EventTiming() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [ev, setEv] = useState<EventRow | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

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
      .select("id,title,qr_enabled,start_qr_token,finish_qr_token,route_distance_m,route_elevation_gain_m,route_elevation_loss_m,alpha,results_published")
      .eq("id", eventId!).maybeSingle();
    setEv(evData as EventRow | null);

    const { data: rs } = await supabase
      .from("event_results")
      .select("id,user_id,start_time,finish_time,duration_s,status,rpe,performance_score")
      .eq("event_id", eventId!);
    if (rs) {
      const ids = rs.map((r) => r.user_id);
      const { data: profs } = await supabase
        .from("profiles").select("user_id, display_name").in("user_id", ids);
      const map = new Map((profs || []).map((p) => [p.user_id, p.display_name]));
      setResults(rs.map((r) => ({ ...r, display_name: map.get(r.user_id) || "Runner" })));
    }
    setLoadingData(false);
  };

  const enableQr = async (enable: boolean) => {
    setBusy(true);
    if (enable && (!ev?.start_qr_token || !ev?.finish_qr_token)) {
      // Generate tokens via edge function
      const { error } = await supabase.functions.invoke("regenerate-qr-tokens", {
        body: { event_id: eventId, enable: true },
      });
      if (error) toast.error("Failed to enable QR");
      else toast.success("QR timing enabled");
    } else {
      const { error } = await supabase.from("events").update({ qr_enabled: enable }).eq("id", eventId!);
      if (error) toast.error("Failed");
      else toast.success(enable ? "QR enabled" : "QR disabled");
    }
    setBusy(false);
    fetchData();
  };

  const regenerate = async () => {
    if (!confirm("Regenerate tokens? Old QR codes will stop working immediately.")) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("regenerate-qr-tokens", {
      body: { event_id: eventId },
    });
    setBusy(false);
    if (error) toast.error("Failed to regenerate"); else toast.success("New tokens generated");
    fetchData();
  };

  const saveRoute = async () => {
    if (!ev) return;
    const { error } = await supabase.from("events").update({
      route_distance_m: ev.route_distance_m,
      route_elevation_gain_m: ev.route_elevation_gain_m,
      route_elevation_loss_m: ev.route_elevation_loss_m,
      alpha: ev.alpha,
    }).eq("id", ev.id);
    if (error) toast.error("Failed to save"); else toast.success("Route data saved");
  };

  const publish = async (publish: boolean) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("publish-event-results", {
      body: { event_id: eventId, publish },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed");
    } else {
      toast.success(publish ? "Results published" : "Results unpublished");
      fetchData();
    }
  };

  const setResultStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("event_results").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(`Marked ${status}`); fetchData(); }
  };

  const setResultTime = async (id: string, field: "start_time" | "finish_time", iso: string | null) => {
    const { error } = await supabase.from("event_results").update({ [field]: iso }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Time updated"); fetchData(); }
  };

  const approveAllPending = async () => {
    const ids = results.filter(r => r.status === "pending").map(r => r.id);
    if (ids.length === 0) { toast.info("No pending results"); return; }
    const { error } = await supabase.from("event_results").update({ status: "verified" }).in("id", ids);
    if (error) toast.error(error.message); else { toast.success(`Approved ${ids.length}`); fetchData(); }
  };

  const downloadQr = (kind: "start" | "finish") => {
    const svg = document.getElementById(`qr-${kind}`);
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${ev?.title || "event"}-${kind}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || loadingData || !ev) {
    return <div className="min-h-screen flex items-center justify-center"><Sun className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  // Always use the published production URL for QR codes so printed codes don't
  // point at preview/sandbox hosts (which redirect to the Lovable sign-up page).
  const liveOrigin = "https://run-happy-kilometres.lovable.app";
  const startUrl = ev.start_qr_token ? `${liveOrigin}/scan/${ev.id}?t=${ev.start_qr_token}&p=start` : "";
  const finishUrl = ev.finish_qr_token ? `${liveOrigin}/scan/${ev.id}?t=${ev.finish_qr_token}&p=finish` : "";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">{ev.title} — Timing</h1>
          <p className="text-sm text-muted-foreground">QR-based official timing & results</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between">QR Timing
            <div className="flex items-center gap-2">
              <Switch checked={ev.qr_enabled} onCheckedChange={enableQr} disabled={busy} />
              <span className="text-sm text-muted-foreground">{ev.qr_enabled ? "Enabled" : "Disabled"}</span>
            </div>
          </CardTitle></CardHeader>
          <CardContent>
            {ev.qr_enabled && ev.start_qr_token && ev.finish_qr_token ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="text-center space-y-2">
                    <div className="font-medium">Start QR</div>
                    <div className="bg-white p-4 rounded inline-block">
                      <QRCodeSVG id="qr-start" value={startUrl} size={180} />
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button size="sm" variant="outline" onClick={() => downloadQr("start")}><Download className="w-3 h-3 mr-1" /> Download</Button>
                      <Button size="sm" variant="outline" asChild><a href={`/scan/${eventId}?p=start&preview=1`} target="_blank" rel="noreferrer">Preview ↗</a></Button>
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="font-medium">Finish QR</div>
                    <div className="bg-white p-4 rounded inline-block">
                      <QRCodeSVG id="qr-finish" value={finishUrl} size={180} />
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button size="sm" variant="outline" onClick={() => downloadQr("finish")}><Download className="w-3 h-3 mr-1" /> Download</Button>
                      <Button size="sm" variant="outline" asChild><a href={`/scan/${eventId}?p=finish&preview=1`} target="_blank" rel="noreferrer">Preview ↗</a></Button>
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={regenerate} disabled={busy}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Regenerate tokens
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Enable QR timing to generate codes.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Route Parameters</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Distance (m) *</Label><Input type="number" value={ev.route_distance_m ?? ""} onChange={(e) => setEv({ ...ev, route_distance_m: e.target.value ? parseInt(e.target.value) : null })} /></div>
              <div><Label>Alpha</Label><Input type="number" step="0.1" value={ev.alpha} onChange={(e) => setEv({ ...ev, alpha: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Elevation gain (m)</Label><Input type="number" value={ev.route_elevation_gain_m ?? ""} onChange={(e) => setEv({ ...ev, route_elevation_gain_m: e.target.value ? parseInt(e.target.value) : null })} /></div>
              <div><Label>Elevation loss (m)</Label><Input type="number" value={ev.route_elevation_loss_m ?? ""} onChange={(e) => setEv({ ...ev, route_elevation_loss_m: e.target.value ? parseInt(e.target.value) : null })} /></div>
            </div>
            <Button onClick={saveRoute}>Save route data</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between">
            Results ({results.length})
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={approveAllPending} disabled={busy}>Approve all pending</Button>
              {ev.results_published
                ? <Button size="sm" variant="outline" onClick={() => publish(false)} disabled={busy}><XCircle className="w-3 h-3 mr-1" /> Unpublish</Button>
                : <Button size="sm" onClick={() => publish(true)} disabled={busy}><CheckCircle2 className="w-3 h-3 mr-1" /> Publish</Button>}
            </div>
          </CardTitle></CardHeader>
          <CardContent>
            {results.length === 0 ? <p className="text-sm text-muted-foreground">No results yet.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Runner</TableHead><TableHead>Start</TableHead><TableHead>Finish</TableHead>
                  <TableHead>Duration</TableHead><TableHead>RPE</TableHead><TableHead>Score</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {results.map((r) => {
                    const badgeCls =
                      r.status === "verified" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : r.status === "pending" ? "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                      : r.status === "incomplete" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      : r.status === "disqualified" ? "bg-muted text-muted-foreground line-through"
                      : "bg-muted text-muted-foreground";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.display_name}</TableCell>
                        <TableCell>
                          {r.start_time
                            ? new Date(r.start_time).toLocaleTimeString()
                            : <Input type="datetime-local" className="h-7 text-xs w-44" onBlur={(e) => e.target.value && setResultTime(r.id, "start_time", new Date(e.target.value).toISOString())} />}
                        </TableCell>
                        <TableCell>
                          {r.finish_time
                            ? new Date(r.finish_time).toLocaleTimeString()
                            : <Input type="datetime-local" className="h-7 text-xs w-44" onBlur={(e) => e.target.value && setResultTime(r.id, "finish_time", new Date(e.target.value).toISOString())} />}
                        </TableCell>
                        <TableCell>{fmtDur(r.duration_s)}</TableCell>
                        <TableCell>{r.rpe ?? "—"}</TableCell>
                        <TableCell>{r.performance_score ? r.performance_score.toFixed(2) : "—"}</TableCell>
                        <TableCell><span className={`inline-block rounded px-2 py-0.5 text-xs ${badgeCls}`}>{r.status}</span></TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end flex-wrap">
                            {(r.status === "pending" || r.status === "incomplete") && (
                              <>
                                <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={() => setResultStatus(r.id, "verified")}>Approve</Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setResultStatus(r.id, "disqualified")}>DQ</Button>
                              </>
                            )}
                            {(r.status === "verified" || r.status === "disqualified") && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setResultStatus(r.id, "pending")}>Revert</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
