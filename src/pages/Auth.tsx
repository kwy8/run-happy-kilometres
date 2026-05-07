import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Sun, ArrowLeft } from "lucide-react";

export default function Auth() {
  const [params] = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const fromScan = next.startsWith("/scan/");
  const newRunner = params.get("newRunner") === "1";
  const [isSignUp, setIsSignUp] = useState(fromScan || newRunner);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, displayName);
        toast.success("Welcome to Happy Kilometres! You're all set. 🎉");
        navigate(next);
      } else {
        await signIn(email, password);
        toast.success("Welcome back, runner! 🏃");
        navigate(next);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 gradient-sunrise-soft">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back home
        </button>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3">
              <Sun className="w-10 h-10 text-primary animate-bounce-gentle" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {isSignUp ? "Join the Club" : "Welcome Back"}
            </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {isSignUp ? "Every journey starts with a single step" : "Ready for your next run?"}
              </p>
          </CardHeader>
          <CardContent>
            {fromScan && (
              <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground text-center">
                You're being checked in for an event. Sign in or create an account to record your time.
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Your Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="What should we call you?"
                    required
                    maxLength={100}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="runner@example.com"
                  required
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Loading..." : isSignUp ? "Join the Club 🏃" : "Let's Go! 🌅"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isSignUp ? "Already a member? Sign in" : "New here? Join the club"}
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
