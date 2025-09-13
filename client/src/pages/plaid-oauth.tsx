import { useEffect, useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

export default function PlaidOAuth() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/plaid/create-link-token", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" } 
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to create link token");
        const data = await res.json();
        setLinkToken(data.link_token || data.linkToken);
      } catch (e: any) {
        toast({ 
          title: "Plaid error", 
          description: e.message || "Could not resume OAuth flow", 
          variant: "destructive" 
        });
        setLocation("/");
      }
    })();
  }, [setLocation, toast]);

  const onSuccess = useCallback(async (publicToken: string) => {
    try {
      const res = await fetch("/api/plaid/exchange-public-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Exchange failed");
      toast({ 
        title: "Account connected", 
        description: "Your bank account was successfully linked." 
      });
    } catch (e: any) {
      toast({ 
        title: "Connection failed", 
        description: e.message, 
        variant: "destructive" 
      });
    } finally {
      setLocation("/"); // return to app
    }
  }, [setLocation, toast]);

  const { open, ready } = usePlaidLink({
    token: linkToken!,
    receivedRedirectUri: window.location.href,
    onSuccess,
    onExit: () => setLocation("/"),
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="flex items-center">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
        <span>Continuing your bank connection...</span>
      </div>
    </div>
  );
}