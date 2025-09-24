import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Tabs removed; single pane layout
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";

export function Settings() {
  const { toast } = useToast();
  const { logoutMutation, user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    setEmail(user?.email ?? "");
  }, [user?.email]);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleSaveEmail = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    if (trimmed === user?.email) {
      toast({ title: "No changes", description: "Email is unchanged." });
      return;
    }
    try {
      setSavingEmail(true);
      const res = await apiRequest("POST", "/api/change-email", { newEmail: trimmed });
      const updated = await res.json();
      queryClient.setQueryData(["/api/user"], updated);
      toast({ title: "Email updated", description: "Your login email has been changed." });
    } catch (e: any) {
      const msg = e?.message || "Failed to update email";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSubmitPassword = async () => {
    if (newPw.length < 8) {
      toast({ title: "Weak password", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "Passwords do not match", description: "Please confirm your new password.", variant: "destructive" });
      return;
    }
    try {
      setPwSaving(true);
      await apiRequest("POST", "/api/change-password", { currentPassword: currentPw, newPassword: newPw });
      setPwOpen(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      toast({ title: "Password updated", description: "You can use it next time you log in." });
    } catch (e: any) {
      const msg = e?.message || "Failed to change password";
      toast({ title: "Change failed", description: msg, variant: "destructive" });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2 text-white">Settings</h2>
          <p className="text-gray-400">Manage your account, preferences, and connected accounts</p>
        </div>
        
        <div className="space-y-6">
          {/* Account Information */}
          <Card className="card-gradient border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email (editable with Save) */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="email" className="text-white">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                  />
                </div>
                <div className="pt-6">
                  <Button onClick={handleSaveEmail} disabled={savingEmail} className="gradient-bg text-white">
                    {savingEmail ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>

              {/* Password row with spacing */}
              <div className="flex items-center justify-between gap-4">
                <Label className="text-white">Password</Label>
                <Dialog open={pwOpen} onOpenChange={setPwOpen}>
                  <DialogTrigger asChild>
                    <Button className="gradient-bg text-white hover:opacity-90">Change Password</Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border border-gray-700 text-white">
                    <DialogHeader>
                      <DialogTitle>Change Password</DialogTitle>
                      <DialogDescription>Enter your current and new password.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="currentPw">Current Password</Label>
                        <Input id="currentPw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="newPw">New Password</Label>
                        <Input id="newPw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="confirmPw">Confirm New Password</Label>
                        <Input id="confirmPw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setPwOpen(false)}>Cancel</Button>
                      <Button onClick={handleSubmitPassword} disabled={pwSaving} className="gradient-bg text-white">
                        {pwSaving ? "Updating..." : "Update Password"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Session row with spacing + dark-theme styled sign out */}
              <div className="flex items-center justify-between gap-4">
                <Label className="text-white">Session</Label>
                <Button 
                  onClick={handleLogout}
                  variant="destructive"
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
