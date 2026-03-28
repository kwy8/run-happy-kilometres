import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LogRunForm } from "@/components/LogRunForm";
import { StatsCards } from "@/components/StatsCards";
import { RunHistory } from "@/components/RunHistory";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Sun, LogOut } from "lucide-react";

interface Run {
  id: string;
  distance_km: number;
  run_date: string;
  notes: string | null;
  created_at: string;
}

interface Profile {
  display_name: string;
}

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoadingData(true);
    const [runsRes, profileRes] = await Promise.all([
      supabase.from("runs").select("*").order("run_date", { ascending: false }),
      supabase.from("profiles").select("display_name").eq("user_id", user!.id).single(),
    ]);
    if (runsRes.data) setRuns(runsRes.data);
    if (profileRes.data) setProfile(profileRes.data);
    setLoadingData(false);
  };

  const handleLogRun = async (distance: number, date: string, notes: string) => {
    const { error } = await supabase.from("runs").insert({
      user_id: user!.id,
      distance_km: distance,
      run_date: date,
      notes: notes || null,
    });
    if (!error) fetchData();
    return error;
  };

  const handleDeleteRun = async (id: string) => {
    await supabase.from("runs").delete().eq("id", id);
    fetchData();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Sun className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const greeting = getGreeting(profile?.display_name || "Runner");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-lg text-foreground">Sunday Run Club</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-display font-bold text-foreground">{greeting}</h1>
          <p className="text-muted-foreground mt-1">Every step counts. Keep going! 💪</p>
        </motion.div>

        <StatsCards runs={runs} />
        <LogRunForm onSubmit={handleLogRun} />
        <RunHistory runs={runs} onDelete={handleDeleteRun} />
      </main>
    </div>
  );
}

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}! 🌅`;
  if (hour < 17) return `Hey ${name}! ☀️`;
  return `Evening, ${name}! 🌙`;
}
