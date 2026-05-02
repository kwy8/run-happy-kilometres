import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sun, Trash2, Edit, Plus } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  display_name: string;
}

interface Run {
  id: string;
  user_id: string;
  distance_km: number;
  run_date: string;
  time_taken_minutes: number | null;
  notes: string | null;
  display_name?: string;
}

export default function AdminDashboard() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Edit name dialog
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [newName, setNewName] = useState("");

  // Edit run dialog
  const [editingRun, setEditingRun] = useState<Run | null>(null);
  const [editDistance, setEditDistance] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Add run dialog
  const [showAddRun, setShowAddRun] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addDistance, setAddDistance] = useState("");
  const [addTime, setAddTime] = useState("");
  const [addDate, setAddDate] = useState(new Date().toISOString().split("T")[0]);
  const [addNotes, setAddNotes] = useState("");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/dashboard");
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => {
    if (user && isAdmin) fetchData();
  }, [user, isAdmin]);

  const fetchData = async () => {
    setLoadingData(true);
    const [profilesRes, runsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name"),
      supabase.from("runs").select("*").order("run_date", { ascending: false }).limit(100),
    ]);
    const profs = profilesRes.data || [];
    setProfiles(profs);

    const runsWithNames = (runsRes.data || []).map((r) => ({
      ...r,
      display_name: profs.find((p) => p.user_id === r.user_id)?.display_name || "Unknown",
    }));
    setRuns(runsWithNames);
    setLoadingData(false);
  };

  const updateName = async () => {
    if (!editingProfile || !newName.trim()) return;
    await supabase.from("profiles").update({ display_name: newName.trim() }).eq("user_id", editingProfile.user_id);
    toast.success("Name updated");
    setEditingProfile(null);
    fetchData();
  };

  const deleteRun = async (id: string) => {
    if (!window.confirm("Delete this run? This cannot be undone.")) return;
    const { error } = await supabase.from("runs").delete().eq("id", id);
    if (error) { toast.error("Failed to delete run"); return; }
    toast.success("Run deleted");
    fetchData();
  };

  const saveRunEdit = async () => {
    if (!editingRun) return;
    const km = parseFloat(editDistance);
    if (isNaN(km) || km <= 0 || km > 200) { toast.error("Distance must be 0.01–200 km"); return; }
    if (editTime) {
      const mins = parseFloat(editTime);
      if (isNaN(mins) || mins <= 0 || mins > 1440) { toast.error("Time must be 0–1440 min"); return; }
    }
    if (!editDate) { toast.error("Date required"); return; }
    const { error } = await supabase.from("runs").update({
      distance_km: km,
      time_taken_minutes: editTime ? parseFloat(editTime) : null,
      run_date: editDate,
      notes: editNotes || null,
    }).eq("id", editingRun.id);
    if (error) { toast.error("Failed to save run"); return; }
    toast.success("Run updated");
    setEditingRun(null);
    fetchData();
  };

  const addRunForUser = async () => {
    const km = parseFloat(addDistance);
    if (isNaN(km) || km <= 0 || km > 200) { toast.error("Distance must be 0.01–200 km"); return; }
    if (addTime) {
      const mins = parseFloat(addTime);
      if (isNaN(mins) || mins <= 0 || mins > 1440) { toast.error("Time must be 0–1440 min"); return; }
    }
    if (!addUserId) { toast.error("Select a user"); return; }
    if (!addDate) { toast.error("Date required"); return; }
    const { error } = await supabase.from("runs").insert({
      user_id: addUserId,
      distance_km: km,
      run_date: addDate,
      time_taken_minutes: addTime ? parseFloat(addTime) : null,
      notes: addNotes || null,
    });
    if (error) { toast.error("Failed to add run"); return; }
    toast.success("Run added");
    setShowAddRun(false);
    setAddUserId(""); setAddDistance(""); setAddTime(""); setAddNotes("");
    fetchData();
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Sun className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-foreground">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Link to="/admin/create-event"><Button variant="outline"><Plus className="w-4 h-4 mr-1" /> Create Event</Button></Link>
            <Button onClick={() => setShowAddRun(true)}><Plus className="w-4 h-4 mr-1" /> Add Run</Button>
          </div>
        </div>

        {/* Members */}
        <Card>
          <CardHeader><CardTitle>Members ({profiles.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.user_id}>
                    <TableCell className="font-medium">{p.display_name}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingProfile(p); setNewName(p.display_name); }}>
                        <Edit className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Runs */}
        <Card>
          <CardHeader><CardTitle>Recent Runs</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Runner</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.display_name}</TableCell>
                    <TableCell>{r.distance_km.toFixed(1)} km</TableCell>
                    <TableCell>{r.time_taken_minutes ? `${r.time_taken_minutes} min` : "—"}</TableCell>
                    <TableCell>{new Date(r.run_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditingRun(r);
                          setEditDistance(String(r.distance_km));
                          setEditTime(r.time_taken_minutes ? String(r.time_taken_minutes) : "");
                          setEditDate(r.run_date);
                          setEditNotes(r.notes || "");
                        }}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteRun(r.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Name Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={() => setEditingProfile(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Name</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Display Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>Cancel</Button>
            <Button onClick={updateName}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Run Dialog */}
      <Dialog open={!!editingRun} onOpenChange={() => setEditingRun(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Run</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Distance (km)</Label><Input type="number" step="0.01" value={editDistance} onChange={(e) => setEditDistance(e.target.value)} /></div>
            <div><Label>Time (minutes)</Label><Input type="number" step="0.1" value={editTime} onChange={(e) => setEditTime(e.target.value)} /></div>
            <div><Label>Date</Label><Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} /></div>
            <div><Label>Notes</Label><Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRun(null)}>Cancel</Button>
            <Button onClick={saveRunEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Run Dialog */}
      <Dialog open={showAddRun} onOpenChange={setShowAddRun}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Run for User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>User</Label>
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Distance (km)</Label><Input type="number" step="0.01" value={addDistance} onChange={(e) => setAddDistance(e.target.value)} /></div>
            <div><Label>Time (minutes)</Label><Input type="number" step="0.1" value={addTime} onChange={(e) => setAddTime(e.target.value)} /></div>
            <div><Label>Date</Label><Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} /></div>
            <div><Label>Notes</Label><Input value={addNotes} onChange={(e) => setAddNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRun(false)}>Cancel</Button>
            <Button onClick={addRunForUser}>Add Run</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
