import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Shield } from "lucide-react";
import logo from "@/assets/logo.png";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Events", path: "/events" },
    { label: "Leaderboard", path: "/leaderboard" },
    { label: "Profile", path: "/profile" },
  ];

  if (isAdmin) {
    navItems.push({ label: "Admin", path: "/admin" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img src={logo} alt="Run Happy Club" className="w-8 h-8" />
              <span className="font-display font-bold text-foreground">Run Happy Club</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 ml-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {item.label === "Admin" && <Shield className="w-3 h-3 inline mr-1" />}
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-1" /> Sign out
          </Button>
        </div>
        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 mt-2 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                location.pathname === item.path
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
