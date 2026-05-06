import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch";

interface CommentRow {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  display_name: string;
}

interface Props {
  eventId: string;
  currentUserId: string;
}

export function EventComments({ eventId, currentUserId }: Props) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const fetch = async () => {
    const { data } = await supabase
      .from("event_comments")
      .select("id, user_id, body, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (!data) return;
    const ids = Array.from(new Set(data.map((c) => c.user_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", ids);
    const nameMap = new Map((profs || []).map((p) => [p.user_id, p.display_name]));
    setComments(
      data.map((c) => ({ ...c, display_name: nameMap.get(c.user_id) || "Runner" }))
    );
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useRealtimeRefetch("event_comments", fetch);

  const post = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    const { error } = await supabase
      .from("event_comments")
      .insert({ event_id: eventId, user_id: currentUserId, body: trimmed });
    setPosting(false);
    if (error) {
      toast.error("Couldn't post comment");
      return;
    }
    setBody("");
    fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("event_comments").delete().eq("id", id);
    if (error) toast.error("Couldn't delete");
    else fetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" /> Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share how the run went…"
            maxLength={1000}
            rows={2}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={post} disabled={posting || !body.trim()}>
              {posting ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet — be the first!</p>
        ) : (
          <ul className="divide-y divide-border">
            {comments.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium text-foreground">{c.display_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  {c.user_id === currentUserId && (
                    <button
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => remove(c.id)}
                      aria-label="Delete comment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
