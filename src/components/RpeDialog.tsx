import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  resultId: string;
  onSaved?: () => void;
}

export function RpeDialog({ open, onOpenChange, resultId, onSaved }: Props) {
  const [rpe, setRpe] = useState<number>(5);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("event_results")
      .update({ rpe, rpe_notes: notes || null })
      .eq("id", resultId);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save RPE");
      return;
    }
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How hard did that feel?</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label>Effort (RPE): <span className="font-bold text-foreground">{rpe}</span> / 10</Label>
            <Slider
              value={[rpe]}
              min={1}
              max={10}
              step={1}
              onValueChange={(v) => setRpe(v[0])}
              className="mt-3"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Easy</span><span>All-out</span>
            </div>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Felt strong, hot day, sore knee..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Skip</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
