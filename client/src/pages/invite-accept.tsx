import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function InviteAccept() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [advisorName, setAdvisorName] = useState<string>("");
  const [emailMasked, setEmailMasked] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setToken(t);
    if (!t) {
      setError('Invalid invitation');
      setLoading(false);
      return;
    }
    (async () => {
      const res = await apiRequest('GET', `/api/invite/validate?token=${encodeURIComponent(t)}`);
      if (!res.ok) {
        setError('Invitation is invalid or expired');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setAdvisorName(data.advisorName);
      setEmailMasked(data.email);
      if (data.emailPlain) setEmail(data.emailPlain);
      setLoading(false);
    })();
  }, []);

  const accept = async () => {
    setError(null);
    try {
      const res = await apiRequest('POST', '/api/invite/accept', { token, email, password });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to accept invitation');
        return;
      }
      // Prefill login form and redirect to /auth
      sessionStorage.setItem('prefillEmail', email);
      sessionStorage.setItem('prefillPassword', password);
      setLocation('/auth');
    } catch (e: any) {
      setError(e?.message || 'Failed to accept invitation');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-300">Loading...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-900">
      <Card className="max-w-md w-full bg-gray-800/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Accept Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <div className="text-gray-300 text-sm">Advisor: <span className="font-semibold">{advisorName}</span></div>
          <div className="text-gray-400 text-sm">Invite Email: {emailMasked}</div>
          <div>
            <Label htmlFor="email" className="text-gray-300">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" className="bg-gray-800 border-gray-700 text-white" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password" className="text-gray-300">Password</Label>
            <Input id="password" type="password" className="bg-gray-800 border-gray-700 text-white" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button className="w-full gradient-bg text-white hover:opacity-90" onClick={accept}>Continue to Login</Button>
        </CardContent>
      </Card>
    </div>
  );
}
