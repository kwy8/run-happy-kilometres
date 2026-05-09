import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sun, Upload } from "lucide-react";
import { toast } from "sonner";

interface EventInfo {
  id: string;
  title: string;
  event_date: string;
  route_distance_m: number | null;
}

export default function SubmitResult() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event") || "";

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [timeMin, setTimeMin] = useState("");
  const [timeSec, setTimeSec] = useState("");
  const [rpe, setRpe] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!eventId) {
      navigate("/events");
      return;
    }
    supabase
      .from("events")
      .select("id, title, event_date, route_distance_m")
      .eq("id", eventId)
      .maybeSingle()
      .then(({ data }) => setEvent(data as EventInfo | null));
  }, [eventId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const min = parseInt(timeMin || "0", 10);
    const sec = parseInt(timeSec || "0", 10);
    if (sec < 0 || sec >= 60) return toast.error("Seconds must be 0-59");
    const duration_s = min * 60 + sec;
    if (!duration_s || duration_s > 86400) return toast.error("Enter a valid duration");

    let rpeVal: number | null = null;
    if (rpe !== "") {
      const n = parseInt(rpe, 10);
      if (isNaN(n) || n < 1 || n > 10) return toast.error("RPE must be between 1 and 10");
      rpeVal = n;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-manual-result", {
        body: { event_id: eventId, duration_s, notes: notes || null, rpe: rpeVal },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Submission failed");
      }
      toast.success("Result submitted! An admin will verify it shortly.");
      navigate(`/events/${eventId}`);
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Sun className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <AppLayout>
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Submit your result</CardTitle>
          <p className="text-sm text-muted-foreground">
            <Link to={`/events/${eventId}`} className="text-primary hover:underline">{event.title}</Link>
            {" · "}{new Date(event.event_date).toLocaleDateString()}
            {event.route_distance_m && <> · {(event.route_distance_m / 1000).toFixed(1)} km</>}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Time taken *</Label>
              <div className="flex gap-2 items-center">
                <Input type="number" min="0" max="1440" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} placeholder="min" required />
                <span className="text-muted-foreground">:</span>
                <Input type="number" min="0" max="59" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} placeholder="sec" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Distance, elevation and alpha are taken from the official route.
              </p>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={2} placeholder="How did it feel?" />
            </div>
            <div>
              <Label>Proof screenshot (optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                />
                {proofFile && <span className="text-xs text-muted-foreground truncate max-w-[10rem]">{proofFile.name}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                <Upload className="w-4 h-4 mr-1" />
                {submitting ? "Submitting..." : "Submit Result"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
