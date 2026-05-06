import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun, CheckCircle2, AlertCircle, Flag, Play } from "lucide-react";
import { toast } from "sonner";
import { RpeDialog } from "@/components/RpeDialog";

function fmtElapsed(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function Scan() {
  const { eventId } = useParams<{ eventId: string }>();
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const phase = (params.get("p") as "start" | "finish") || "start";
  const isPreview = params.get("preview") === "1";
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "scanning" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");
  const [resultId, setResultId] = useState<string | null>(null);
  const [showRpe, setShowRpe] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [finishDuration, setFinishDuration] = useState<number | null>(null);
  const [eventTitle, setEventTitle] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [now, setNow] = useState<number>(Date.now());
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = `/scan/${eventId}?t=${encodeURIComponent(token)}&p=${phase}`;
      navigate(`/auth?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!eventId || !token) {
      setStatus("err");
      setMessage("Invalid scan link.");
      return;
    }
    void callScan();
    void fetchMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, eventId, token, phase]);

  // Live timer for the start phase
  useEffect(() => {
    if (phase !== "start" || !startTime) return;
    setNow(Date.now());
    tickRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [phase, startTime]);

  const fetchMeta = async () => {
    if (!eventId || !user) return;
    const [{ data: ev }, { data: prof }] = await Promise.all([
      supabase.from("events").select("title").eq("id", eventId).maybeSingle(),
      supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
    ]);
    if (ev?.title) setEventTitle(ev.title);
    if (prof?.display_name) setDisplayName(prof.display_name);
  };

  const callScan = async () => {
    setStatus("scanning");
    const { data, error } = await supabase.functions.invoke("scan-event", {
      body: { event_id: eventId, token, phase },
    });
    if (error || !data?.ok) {
      setStatus("err");
      setMessage(data?.error || error?.message || "Scan failed");
      return;
    }
    setStatus("ok");
    setResultId(data.result?.id || null);
    if (phase === "start") {
      if (data.result?.start_time) setStartTime(new Date(data.result.start_time));
      setMessage(data.action === "already_started" ? "You were already checked in." : "You're checked in.");
    } else {
      const dur = data.result?.duration_s ?? null;
      setFinishDuration(dur);
      setMessage(data.action === "already_finished" ? "Already finished." : "Nice work!");
      if (data.result?.rpe == null) setShowRpe(true);
    }
  };

  if (loading || status === "scanning" || status === "idle") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Sun className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // ── ERROR
  if (status === "err") {
    return (
      <AppLayout>
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" /> Couldn't scan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">{message}</p>
            <Link to={`/events/${eventId}`}><Button>Back to event</Button></Link>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  // ── START: live welcome + timer
  if (phase === "start") {
    const elapsedSec = startTime ? (now - startTime.getTime()) / 1000 : 0;
    return (
      <AppLayout>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="max-w-md mx-auto"
        >
          <Card>
            <CardContent className="pt-8 pb-10 text-center space-y-6">
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium uppercase tracking-wide">{message}</span>
                </div>
                {eventTitle && (
                  <h1 className="text-2xl font-display font-bold text-foreground">{eventTitle}</h1>
                )}
                {displayName && (
                  <p className="text-sm text-muted-foreground">Welcome, {displayName}</p>
                )}
              </div>

              <motion.div
                key={Math.floor(elapsedSec)}
                initial={{ scale: 0.98, opacity: 0.85 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="py-4"
              >
                <div className="text-6xl font-display font-bold tabular-nums text-primary tracking-tight">
                  {fmtElapsed(elapsedSec)}
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-2">
                  Elapsed
                </div>
              </motion.div>

              {startTime && (
                <p className="text-sm text-muted-foreground">
                  Started at <span className="tabular-nums">{startTime.toLocaleTimeString()}</span>
                </p>
              )}

              <div className="bg-muted/50 rounded-md px-4 py-3 text-sm text-muted-foreground">
                Scan the <span className="font-medium text-foreground">Finish QR</span> when you cross the line.
                You can close this page — the time is tracked on the server.
              </div>

              <Link to={`/events/${eventId}`}>
                <Button variant="outline">Back to event</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </AppLayout>
    );
  }

  // ── FINISH
  const finishFmt = finishDuration != null ? fmtElapsed(finishDuration) : "—";
  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="max-w-md mx-auto"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-primary" /> Finish scanned
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-center">
            <p className="text-sm text-muted-foreground">{message}</p>
            <div>
              <div className="text-5xl font-display font-bold tabular-nums text-primary">{finishFmt}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-2">Final time</div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {resultId && (
                <Button onClick={() => setShowRpe(true)} variant="default">
                  <Play className="w-4 h-4 mr-1" /> Submit RPE
                </Button>
              )}
              <Link to={`/events/${eventId}`}>
                <Button variant="outline">Back to event</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {resultId && (
        <RpeDialog
          open={showRpe}
          onOpenChange={setShowRpe}
          resultId={resultId}
          onSaved={() => toast.success("RPE saved")}
        />
      )}
    </AppLayout>
  );
}
