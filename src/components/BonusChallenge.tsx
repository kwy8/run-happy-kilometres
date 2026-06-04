import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Check, CircleDot, Sparkles, Timer, Trophy, X } from "lucide-react";
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
  const pickCounts = {
    a: picks.filter((p) => p.pick === "a").length,
    b: picks.filter((p) => p.pick === "b").length,
  };
  const totalPicks = Math.max(1, picks.length);

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

  if (!challenge) {
    if (!isAdmin) return null;
    return (
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-accent/10 to-sage-light/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Matchday Challenge
            </CardTitle>
            <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-primary shadow-sm">
              Bonus game
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!creating ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Add a two-option prediction to give this run a little pre-race drama.
              </p>
              <Button onClick={() => setCreating(true)}>
                <Sparkles className="w-4 h-4 mr-2" />
                Add challenge
              </Button>
            </div>
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
    <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-accent/10 to-sage-light/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full gradient-sunrise text-primary-foreground shadow-sm">
                <Trophy className="w-4 h-4" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary">Matchday Challenge</p>
                <CardTitle className="text-xl leading-tight">Pick your side</CardTitle>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {resolved ? "The whistle has blown." : locked ? "Picks are locked." : "One pick. One tiny consequence."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-foreground shadow-sm">
              <CircleDot className="w-3.5 h-3.5 text-primary" />
              +{challenge.penalty_m} m
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-foreground shadow-sm">
              <Timer className="w-3.5 h-3.5 text-primary" />
              {locked ? "Locked" : lockAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-primary/20 bg-background/70 p-4 shadow-sm">
          <p className="text-lg font-extrabold leading-snug text-foreground">{challenge.question}</p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            Wrong pickers carry the bonus distance into the results table.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(["a", "b"] as const).map((opt) => {
            const label = opt === "a" ? challenge.option_a : challenge.option_b;
            const isMine = myPick === opt;
            const isCorrect = challenge.correct_answer === opt;
            const isWrongPick = resolved && isMine && !isCorrect;
            const count = pickCounts[opt];
            const pct = Math.round((count / totalPicks) * 100);
            return (
              <Button
                key={opt}
                variant="outline"
                disabled={locked || busy}
                onClick={() => submitPick(opt)}
                className={[
                  "group relative h-auto min-h-24 overflow-hidden rounded-lg border-2 bg-background/80 p-0 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                  isMine ? "border-primary bg-primary/10" : "border-border/70",
                  resolved && isCorrect ? "border-emerald-500 bg-emerald-500/10" : "",
                  isWrongPick ? "border-destructive bg-destructive/10" : "",
                ].join(" ")}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-primary/10 transition-all"
                  style={{ width: picks.length ? `${pct}%` : "0%" }}
                />
                <span className="relative flex w-full flex-col gap-3 p-4">
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Option {opt.toUpperCase()}
                      </span>
                      <span className="mt-1 block text-lg font-extrabold leading-tight text-foreground">{label}</span>
                    </span>
                    <span className={[
                      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background",
                      isMine ? "border-primary text-primary" : "border-border text-muted-foreground",
                      resolved && isCorrect ? "border-emerald-500 text-emerald-600" : "",
                      isWrongPick ? "border-destructive text-destructive" : "",
                    ].join(" ")}>
                      {resolved
                        ? isCorrect
                          ? <Check className="w-4 h-4" />
                          : isMine
                            ? <X className="w-4 h-4" />
                            : <CircleDot className="w-4 h-4" />
                        : isMine
                          ? <Check className="w-4 h-4" />
                          : <CircleDot className="w-4 h-4" />}
                    </span>
                  </span>
                  <span className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                    <span>{count} pick{count === 1 ? "" : "s"}</span>
                    {isMine && <span className="text-primary">Your pick</span>}
                    {resolved && isCorrect && <span className="text-emerald-600">Correct</span>}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>

        {!resolved && (
          <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/60 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold text-foreground">
              {myPick ? `You chose ${myPick === "a" ? challenge.option_a : challenge.option_b}` : "Make your pick"}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {locked ? "Result reveal is up to the admin." : `Locks ${lockAt.toLocaleString()}`}
            </span>
          </div>
        )}

        {isAdmin && (
          <div className="space-y-3 rounded-lg border border-border/70 bg-background/70 p-3">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Admin controls</Label>
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
