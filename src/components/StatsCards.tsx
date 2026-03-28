import { motion } from "framer-motion";
import { TrendingUp, Calendar, Route, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Run {
  id: string;
  distance_km: number;
  run_date: string;
}

interface StatsCardsProps {
  runs: Run[];
}

export function StatsCards({ runs }: StatsCardsProps) {
  const stats = calculateStats(runs);

  const cards = [
    {
      icon: Route,
      label: "Total Distance",
      value: `${stats.totalKm.toFixed(1)} km`,
      sub: `${stats.totalRuns} run${stats.totalRuns !== 1 ? "s" : ""} logged`,
    },
    {
      icon: TrendingUp,
      label: "vs Last Week",
      value: stats.weeklyChange !== null
        ? `${stats.weeklyChange > 0 ? "+" : ""}${stats.weeklyChange.toFixed(1)} km`
        : "—",
      sub: stats.weeklyChange !== null
        ? stats.weeklyChange > 0
          ? "You're crushing it! 🎉"
          : stats.weeklyChange === 0
          ? "Steady as she goes! 💪"
          : "Every step still counts! 🌟"
        : "Log more runs to see progress",
      highlight: stats.weeklyChange !== null && stats.weeklyChange > 0,
    },
    {
      icon: Flame,
      label: "Current Streak",
      value: `${stats.streak} week${stats.streak !== 1 ? "s" : ""}`,
      sub: stats.streak > 0 ? "Keep the streak alive! 🔥" : "Start your streak this Sunday!",
    },
    {
      icon: Calendar,
      label: "Last Run",
      value: stats.lastRunDate || "No runs yet",
      sub: stats.lastRunDistance ? `${stats.lastRunDistance.toFixed(1)} km` : "Time to lace up!",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <Card className={`border-0 shadow-md ${card.highlight ? "gradient-sunrise-soft" : ""}`}>
            <CardContent className="pt-5 pb-4 px-4">
              <card.icon className="w-5 h-5 text-primary mb-2" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.label}</p>
              <p className="text-xl font-display font-bold text-foreground mt-1">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function calculateStats(runs: Run[]) {
  const totalKm = runs.reduce((s, r) => s + r.distance_km, 0);
  const totalRuns = runs.length;

  // Weekly comparison
  const now = new Date();
  const startOfThisWeek = getStartOfWeek(now);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const thisWeekKm = runs
    .filter((r) => new Date(r.run_date) >= startOfThisWeek)
    .reduce((s, r) => s + r.distance_km, 0);

  const lastWeekKm = runs
    .filter((r) => {
      const d = new Date(r.run_date);
      return d >= startOfLastWeek && d < startOfThisWeek;
    })
    .reduce((s, r) => s + r.distance_km, 0);

  const weeklyChange = lastWeekKm > 0 || thisWeekKm > 0 ? thisWeekKm - lastWeekKm : null;

  // Streak (consecutive weeks with at least one run)
  let streak = 0;
  let checkDate = new Date(startOfThisWeek);
  while (true) {
    const weekStart = new Date(checkDate);
    const weekEnd = new Date(checkDate);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const hasRun = runs.some((r) => {
      const d = new Date(r.run_date);
      return d >= weekStart && d < weekEnd;
    });
    if (hasRun) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 7);
    } else {
      break;
    }
  }

  const lastRun = runs[0];
  const lastRunDate = lastRun
    ? new Date(lastRun.run_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;
  const lastRunDistance = lastRun?.distance_km ?? null;

  return { totalKm, totalRuns, weeklyChange, streak, lastRunDate, lastRunDistance };
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
