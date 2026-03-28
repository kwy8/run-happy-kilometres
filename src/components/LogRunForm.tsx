import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check } from "lucide-react";

interface LogRunFormProps {
  onSubmit: (distance: number, date: string, notes: string) => Promise<any>;
}

export function LogRunForm({ onSubmit }: LogRunFormProps) {
  const [open, setOpen] = useState(false);
  const [distance, setDistance] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const km = parseFloat(distance);
    if (isNaN(km) || km <= 0 || km > 200) {
      toast.error("Please enter a valid distance (0.01 - 200 km)");
      return;
    }
    setLoading(true);
    const error = await onSubmit(km, date, notes);
    setLoading(false);
    if (error) {
      toast.error("Couldn't save your run. Try again!");
    } else {
      toast.success("Run logged! You're amazing! 🏃‍♂️");
      setDistance("");
      setNotes("");
      setOpen(false);
    }
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-foreground">Log a Run</h2>
          {!open && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Run
            </Button>
          )}
        </div>
      </CardHeader>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="distance">Distance (km)</Label>
                    <Input
                      id="distance"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="200"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      placeholder="5.0"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="How did it feel? 🌤️"
                    maxLength={500}
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading}>
                    <Check className="w-4 h-4 mr-1" />
                    {loading ? "Saving..." : "Save Run"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
