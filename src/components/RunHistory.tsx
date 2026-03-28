import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Trash2, MapPin } from "lucide-react";

interface Run {
  id: string;
  distance_km: number;
  run_date: string;
  notes: string | null;
}

interface RunHistoryProps {
  runs: Run[];
  onDelete: (id: string) => void;
}

export function RunHistory({ runs, onDelete }: RunHistoryProps) {
  if (runs.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-12 text-center">
          <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground font-medium">No runs logged yet</p>
          <p className="text-muted-foreground text-sm mt-1">Your running journey starts here! 🌅</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <h2 className="text-lg font-display font-bold text-foreground">Run History</h2>
      </CardHeader>
      <CardContent className="space-y-2">
        {runs.map((run, i) => (
          <motion.div
            key={run.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full gradient-sunrise flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-display font-bold text-sm">
                  {run.distance_km.toFixed(0)}
                </span>
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {run.distance_km.toFixed(2)} km
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(run.run_date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                  {run.notes && ` · ${run.notes}`}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(run.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
