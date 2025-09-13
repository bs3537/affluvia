import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Download, Trash2, LogOut, Settings as SettingsIcon, Shield } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function Settings() {
  const { toast } = useToast();
  const { logoutMutation } = useAuth();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [monthlyReports, setMonthlyReports] = useState(false);

  const handleExportData = () => {
    toast({
      title: "Data Export",
      description: "Your data export has been initiated. You'll receive an email when it's ready.",
    });
  };

  const handleDeleteData = () => {
    toast({
      title: "Data Deletion Requested",
      description: "Your data deletion request has been submitted. This action cannot be undone.",
      variant: "destructive",
    });
  };

  const handleChangePassword = () => {
    toast({
      title: "Password Change",
      description: "Password change functionality coming soon.",
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2 text-white">Settings</h2>
          <p className="text-gray-400">Manage your account, preferences, and connected accounts</p>
        </div>
        
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security & Privacy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
          {/* Account Information */}
          <Card className="card-gradient border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-white">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value="demo@affluvia.com"
                  readOnly
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
              </div>
              <div>
                <Label className="text-white">Password</Label>
                <Button 
                  onClick={handleChangePassword}
                  className="gradient-bg text-white hover:opacity-90 mt-2"
                >
                  Change Password
                </Button>
              </div>
              <div>
                <Label className="text-white">Session</Label>
                <Button 
                  onClick={handleLogout}
                  variant="outline"
                  className="border-red-600 text-red-400 hover:bg-red-900/20 mt-2"
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Preferences */}
          <Card className="card-gradient border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-white">Email Notifications</h4>
                  <p className="text-sm text-gray-400">Receive updates about your financial plan</p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-white">Monthly Reports</h4>
                  <p className="text-sm text-gray-400">Automatically generate monthly financial reports</p>
                </div>
                <Switch
                  checked={monthlyReports}
                  onCheckedChange={setMonthlyReports}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Data Management */}
          <Card className="card-gradient border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">Data Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleExportData}
                variant="outline"
                className="w-full justify-start border-gray-600 text-white hover:bg-gray-700"
              >
                <Download className="w-4 h-4 mr-3 text-blue-300" />
                Export My Data
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline"
                    className="w-full justify-start border-red-600 text-red-400 hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4 mr-3" />
                    Delete My Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-gray-800 border-gray-700">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-400">
                      This action cannot be undone. This will permanently delete your account
                      and remove all your data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-gray-700 text-white border-gray-600">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteData}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      Delete Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>


          <TabsContent value="security" className="space-y-6">
            {/* Security & Privacy Settings */}
            <Card className="card-gradient border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-white">Password</Label>
                  <Button 
                    onClick={handleChangePassword}
                    className="gradient-bg text-white hover:opacity-90 mt-2"
                  >
                    Change Password
                  </Button>
                </div>
                <div>
                  <Label className="text-white">Two-Factor Authentication</Label>
                  <p className="text-sm text-gray-400 mb-2">Add an extra layer of security to your account</p>
                  <Button 
                    variant="outline"
                    className="border-gray-600 text-white hover:bg-gray-700"
                  >
                    Enable 2FA
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Privacy & Data Management */}
            <Card className="card-gradient border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">Privacy & Data Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={handleExportData}
                  variant="outline"
                  className="w-full justify-start border-gray-600 text-white hover:bg-gray-700"
                >
                  <Download className="w-4 h-4 mr-3 text-blue-300" />
                  Export My Data
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline"
                      className="w-full justify-start border-red-600 text-red-400 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4 mr-3" />
                      Delete My Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-gray-800 border-gray-700">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription className="text-gray-400">
                        This action cannot be undone. This will permanently delete your account
                        and remove all your data from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-gray-700 text-white border-gray-600">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteData}
                        className="bg-red-600 text-white hover:bg-red-700"
                      >
                        Delete Everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
