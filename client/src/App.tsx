import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Route, Switch } from "wouter";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "@/lib/protected-route";
import { AdvisorRoute } from "@/lib/advisor-route";
import { AuthProvider } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { RetirementScoreProvider } from "@/contexts/retirement-score-context";
import { AdvisorActingAsBanner } from "@/components/advisor-acting-as-banner";
import AdvisorPortal from "@/pages/advisor-portal";
import InviteAccept from "@/pages/invite-accept";
import PlaidOAuth from "@/pages/plaid-oauth";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RetirementScoreProvider>
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
            <AdvisorActingAsBanner />
            <Switch>
              <Route path="/auth" component={AuthPage} />
              <Route path="/advisor" component={() => (
                <AdvisorRoute>
                  <AdvisorPortal />
                </AdvisorRoute>
              )} />
              <Route path="/invite/accept" component={InviteAccept} />
              <Route path="/plaid-oauth" component={PlaidOAuth} />
              <Route path="/" component={() => (
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              )} />
              <Route path="/:rest*" component={NotFound} />
            </Switch>
            <Toaster />
          </div>
        </RetirementScoreProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
