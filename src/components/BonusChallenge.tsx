import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Trophy, Check, X } from "lucide-react";
import { toast } from "sonner";

export interface BonusChallengeRow {
  id: string;
  event_id: string;
  question: string;
  option_a: string;
  option_b: string;
  correct_answer: "a" | "b" | null;
  penalty_m: number;
}

export interface BonusPick {
  user_id: string;
  pick: "a" | "b";
}

interface Props {
  eventId: string;
  userId: string;
  isAdmin: boolean;
  lockAt: Date;
  challenge: BonusChallengeRow | null;
  picks: BonusPick[];
  onChange: () => void;
}

export function BonusChallenge({ eventId, userId, isAdmin, lockAt, challenge, picks, onChange }: Props) {
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [penaltyM, setPenaltyM] = useState(800);
  const [busy, setBusy] = useState(false);

  const locked = Date.now() >= lockAt.getTime();
  const myPick = picks.find((p) => p.user_id === userId)?.pick ?? null;
  const resolved = !!challenge?.correct_answer;

  useEffect(() => {
    if (challenge) {
      setQuestion(challenge.question);
      setOptionA(challenge.option_a);
      setOptionB(challenge.option_b);
      setPenaltyM(challenge.penalty_m);
    }
  }, [challenge]);

  const saveChallenge = async () => {
    if (!question.trim() || !optionA.trim() || !optionB.trim()) {
      toast.error("Question and both options are required");
      return;
    }
    setBusy(true);
    const payload = {
      event_id: eventId,
      question: question.trim().slice(0, 200),
      option_a: optionA.trim().slice(0, 60),
      option_b: optionB.trim().slice(0, 60),
      penalty_m: Math.max(0, Math.min(100000, Math.round(penaltyM))),
    };
    const { error } = challenge
      ? await supabase.from("event_bonus_challenges").update(payload).eq("id", challenge.id)
      : await supabase.from("event_bonus_challenges").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(challenge ? "Challenge updated" : "Challenge created");
    setCreating(false);
    onChange();
  };

  const deleteChallenge = async () => {
    if (!challenge) return;
    if (!confirm("Delete this bonus challenge and all picks?")) return;
    setBusy(true);
    const { error } = await supabase.from("event_bonus_challenges").delete().eq("id", challenge.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Challenge deleted");
    onChange();
  };

  const setCorrect = async (answer: "a" | "b") => {
    if (!challenge) return;
    setBusy(true);
    const { error } = await supabase
      .from("event_bonus_challenges")
      .update({ correct_answer: answer })
      .eq("id", challenge.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Correct answer set");
    onChange();
  };

  const submitPick = async (pick: "a" | "b") => {
    if (locked) return toast.error("Picks are locked");
    setBusy(true);
    const { error } = await supabase
      .from("event_bonus_picks")
      .upsert({ event_id: eventId, user_id: userId, pick }, { onConflict: "event_id,user_id" });
    setBusy(false);
    if (error) return toast.error(error.message);
    onChange();
  };

  // Admin: no challenge yet — show create form / button
  if (!challenge) {
    if (!isAdmin) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" /> Bonus Challenge</CardTitle>
        </CardHeader>
        <CardContent>
          {!creating ? (
            <Button variant="outline" onClick={() => setCreating(true)}>Add a bonus challenge</Button>
          ) : (
            <div className="space-y-3">
              <div><Label>Question</Label><Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Who qualifies? Germany or Norway?" maxLength={200} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Option A</Label><Input value={optionA} onChange={(e) => setOptionA(e.target.value)} placeholder="Germany" maxLength={60} /></div>
                <div><Label>Option B</Label><Input value={optionB} onChange={(e) => setOptionB(e.target.value)} placeholder="Norway" maxLength={60} /></div>
              </div>
              <div><Label>Penalty (meters)</Label><Input type="number" min={0} max={100000} value={penaltyM} onChange={(e) => setPenaltyM(Number(e.target.value))} /></div>
              <div className="flex gap-2">
                <Button onClick={saveChallenge} disabled={busy}>Save</Button>
                <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Bonus Challenge
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium">{challenge.question}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Wrong pickers add {challenge.penalty_m} m to their distance.{" "}
            {locked ? "Picks locked." : `Picks lock at ${lockAt.toLocaleString()}.`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["a", "b"] as const).map((opt) => {
            const label = opt === "a" ? challenge.option_a : challenge.option_b;
            const isMine = myPick === opt;
            const isCorrect = challenge.correct_answer === opt;
            return (
              <Button
                key={opt}
                variant={isMine ? "default" : "outline"}
                disabled={locked || busy}
                onClick={() => submitPick(opt)}
                className="relative justify-between"
              >
                <span>{label}</span>
                {resolved && (
                  isCorrect
                    ? <Check className="w-4 h-4 text-emerald-500" />
                    : isMine ? <X className="w-4 h-4 text-destructive" /> : null
                )}
              </Button>
            );
          })}
        </div>

        {!resolved && (
          <p className="text-xs text-muted-foreground">
            {myPick ? `Your pick: ${myPick === "a" ? challenge.option_a : challenge.option_b}` : "Make your pick!"}
          </p>
        )}

        {isAdmin && (
          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs">Admin</Label>
            {!resolved ? (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground self-center">Correct answer:</span>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setCorrect("a")}>{challenge.option_a}</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setCorrect("b")}>{challenge.option_b}</Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Correct: <span className="font-medium text-foreground">
                  {challenge.correct_answer === "a" ? challenge.option_a : challenge.option_b}
                </span>
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setCreating((v) => !v)}>
                {creating ? "Cancel edit" : "Edit"}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={deleteChallenge}>
                Delete
              </Button>
            </div>
            {creating && (
              <div className="space-y-2 pt-2">
                <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={optionA} onChange={(e) => setOptionA(e.target.value)} maxLength={60} />
                  <Input value={optionB} onChange={(e) => setOptionB(e.target.value)} maxLength={60} />
                </div>
                <Input type="number" min={0} max={100000} value={penaltyM} onChange={(e) => setPenaltyM(Number(e.target.value))} />
                <Button size="sm" onClick={saveChallenge} disabled={busy}>Save changes</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
