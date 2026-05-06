import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun, CheckCircle2, AlertCircle, Flag, Play } from "lucide-react";
import { toast } from "sonner";
import { RpeDialog } from "@/components/RpeDialog";

export default function Scan() {
  const { eventId } = useParams<{ eventId: string }>();
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const phase = (params.get("p") as "start" | "finish") || "start";
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "scanning" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");
  const [resultId, setResultId] = useState<string | null>(null);
  const [showRpe, setShowRpe] = useState(false);

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
    callScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, eventId, token, phase]);

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
      const t = data.result?.start_time
        ? new Date(data.result.start_time).toLocaleTimeString()
        : "";
      setMessage(
        data.action === "already_started"
          ? `Already started at ${t}. Have a great run!`
          : `Started at ${t}. Have a great run!`,
      );
    } else {
      const dur = data.result?.duration_s;
      const formatted = dur != null
        ? `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")}`
        : "—";
      setMessage(
        data.action === "already_finished"
          ? `Already finished. Elapsed ${formatted}.`
          : `Finished! Elapsed ${formatted}.`,
      );
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

  return (
    <AppLayout>
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === "ok"
              ? phase === "start"
                ? <><Play className="w-5 h-5 text-primary" /> Start scanned</>
                : <><Flag className="w-5 h-5 text-primary" /> Finish scanned</>
              : <><AlertCircle className="w-5 h-5 text-destructive" /> Couldn't scan</>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            {status === "ok"
              ? <CheckCircle2 className="w-6 h-6 text-primary mt-0.5" />
              : <AlertCircle className="w-6 h-6 text-destructive mt-0.5" />}
            <p className="text-sm text-foreground">{message}</p>
          </div>
          <div className="flex gap-2">
            {status === "ok" && phase === "finish" && resultId && (
              <Button onClick={() => setShowRpe(true)} variant="outline">
                Submit RPE
              </Button>
            )}
            <Link to={`/events/${eventId}`}>
              <Button>Back to event</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

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
