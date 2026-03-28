import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Sun, ArrowRight, Heart, TrendingUp, Users } from "lucide-react";
import { useEffect } from "react";

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="gradient-sunrise-soft">
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Sun className="w-14 h-14 text-primary mx-auto mb-6 animate-bounce-gentle" />
            <h1 className="text-4xl md:text-6xl font-display font-extrabold text-foreground leading-tight">
              Sunday <span className="text-gradient-sunrise">Run Club</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mt-4 max-w-lg mx-auto">
              Track your Sunday runs, celebrate your progress, and keep showing up. No pressure, just joy.
            </p>
            <div className="mt-8 flex gap-3 justify-center">
              <Button size="lg" onClick={() => navigate("/auth")} className="text-base px-8">
                Get Started <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: TrendingUp,
              title: "Track Your Growth",
              desc: "See how far you've come each week. We celebrate improvement, not competition.",
            },
            {
              icon: Heart,
              title: "Stay Motivated",
              desc: "Positive vibes only. Every kilometer counts, whether it's 1 or 21.",
            },
            {
              icon: Users,
              title: "Sunday Ritual",
              desc: "Build a weekly habit that makes you feel good. Show up for yourself.",
            },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.15 }}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-full gradient-sunrise mx-auto flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="font-display font-bold text-foreground text-lg">{feature.title}</h3>
              <p className="text-muted-foreground text-sm mt-2">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>Made with ☀️ for Sunday runners everywhere</p>
      </footer>
    </div>
  );
}
