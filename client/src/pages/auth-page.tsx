import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { LandingHero } from "@/components/landing-hero";
import { TrendingUp, Shield, Bot } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";

type LoginFormData = z.infer<typeof insertUserSchema>;
type RegisterFormData = z.infer<typeof insertUserSchema> & { confirmPassword: string; terms: boolean };

const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string(),
  terms: z.boolean().refine(val => val === true, "You must agree to the terms")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [showAuth, setShowAuth] = useState(true);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      terms: false
    }
  });

  useEffect(() => {
    if (user) {
      setLocation(user.role === 'advisor' ? '/advisor' : "/");
    }
  }, [user, setLocation]);

  useEffect(() => {
    // Prefill from invite accept flow, if present
    const prefillEmail = sessionStorage.getItem('prefillEmail');
    const prefillPassword = sessionStorage.getItem('prefillPassword');
    if (prefillEmail || prefillPassword) {
      loginForm.reset({
        email: prefillEmail || '',
        password: prefillPassword || ''
      });
      // Clear after use
      sessionStorage.removeItem('prefillEmail');
      sessionStorage.removeItem('prefillPassword');
    } else {
      // Check for saved credentials in localStorage
      const savedEmail = localStorage.getItem('savedEmail');
      if (savedEmail) {
        loginForm.setValue('email', savedEmail);
        setRememberMe(true);
      }
    }
  }, []);

  const [rememberMe, setRememberMe] = useState(true);

  const onLogin = (data: LoginFormData) => {
    // Save email to localStorage if remember me is checked
    if (rememberMe) {
      localStorage.setItem('savedEmail', data.email);
    } else {
      localStorage.removeItem('savedEmail');
    }
    loginMutation.mutate({ ...data, rememberMe });
  };

  const onRegister = (data: RegisterFormData) => {
    const { confirmPassword, terms, ...registerData } = data;
    registerMutation.mutate(registerData as any);
  };

  if (user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {!showAuth ? (
        <div>
          <LandingHero onGetStarted={() => setShowAuth(true)} />
          
          {/* Features Section */}
          <section className="py-20 bg-gray-900">
            <div className="container mx-auto px-6">
              <h2 className="text-3xl font-bold text-center mb-16 text-white">Why Choose AFFLUVIA?</h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center p-6 card-gradient rounded-xl hover-lift">
                  <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-4 text-white">Comprehensive Planning</h3>
                  <p className="text-gray-400">Covers budgeting, investing, insurance, retirement, and more.</p>
                </div>
                <div className="text-center p-6 card-gradient rounded-xl hover-lift">
                  <Bot className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-4 text-white">Financial Insights</h3>
                  <p className="text-gray-400">Get personalized insights and professional financial guidance.</p>
                </div>
                <div className="text-center p-6 card-gradient rounded-xl hover-lift">
                  <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-4 text-white">Secure & Confidential</h3>
                  <p className="text-gray-400">Your data is encrypted and private.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <section className="py-20 bg-gray-800 min-h-screen flex items-center">
          <div className="container mx-auto px-6 max-w-md">
            <Card className="card-gradient border-gray-700 shadow-2xl hover:border-purple-500/50 transition-all duration-300">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-white mb-2">Welcome to AFFLUVIA</CardTitle>
                <CardDescription className="text-gray-400">
                  Sign in to your account or create a new one
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-800/50 p-1 rounded-lg">
                    <TabsTrigger 
                      value="login"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-gray-400 transition-all duration-200"
                    >
                      Login
                    </TabsTrigger>
                    <TabsTrigger 
                      value="register"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-gray-400 transition-all duration-200"
                    >
                      Sign Up
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="login">
                    <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                      <div>
                        <Label htmlFor="loginEmail" className="text-white">Email</Label>
                        <Input
                          id="loginEmail"
                          type="email"
                          autoComplete="email"
                          {...loginForm.register("email")}
                          className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                        />
                        {loginForm.formState.errors.email && (
                          <p className="text-red-400 text-sm mt-1">{loginForm.formState.errors.email.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="loginPassword" className="text-white">Password</Label>
                        <Input
                          id="loginPassword"
                          type="password"
                          autoComplete="current-password"
                          {...loginForm.register("password")}
                          className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                        />
                        {loginForm.formState.errors.password && (
                          <p className="text-red-400 text-sm mt-1">{loginForm.formState.errors.password.message}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="rememberMe" 
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                          className="border-gray-600 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                        />
                        <Label htmlFor="rememberMe" className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                          Keep me logged in
                        </Label>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:hover:scale-100"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? "Logging in..." : "Login"}
                      </Button>
                    </form>
                  </TabsContent>
                  
                  <TabsContent value="register">
                    <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                      <div>
                        <Label htmlFor="registerEmail" className="text-white">Email</Label>
                        <Input
                          id="registerEmail"
                          type="email"
                          autoComplete="email"
                          {...registerForm.register("email")}
                          className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                        />
                        {registerForm.formState.errors.email && (
                          <p className="text-red-400 text-sm mt-1">{registerForm.formState.errors.email.message}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-white">Register as</Label>
                        <div className="flex gap-4 mt-1 text-gray-300">
                          <label className="flex items-center gap-2">
                            <input type="radio" value="individual" defaultChecked {...registerForm.register("role")} />
                            Individual
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" value="advisor" {...registerForm.register("role")} />
                            Financial Advisor
                          </label>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="registerPassword" className="text-white">Password</Label>
                        <Input
                          id="registerPassword"
                          type="password"
                          autoComplete="new-password"
                          {...registerForm.register("password")}
                          className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                        />
                        {registerForm.formState.errors.password && (
                          <p className="text-red-400 text-sm mt-1">{registerForm.formState.errors.password.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          {...registerForm.register("confirmPassword")}
                          className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                        />
                        {registerForm.formState.errors.confirmPassword && (
                          <p className="text-red-400 text-sm mt-1">{registerForm.formState.errors.confirmPassword.message}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="terms" 
                          checked={registerForm.watch("terms")}
                          onCheckedChange={(checked) => registerForm.setValue("terms", checked as boolean)}
                          className="border-gray-600 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                        />
                        <Label htmlFor="terms" className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                          I agree to the Terms of Service
                        </Label>
                      </div>
                      {registerForm.formState.errors.terms && (
                        <p className="text-red-400 text-sm">{registerForm.formState.errors.terms.message}</p>
                      )}
                      <Button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:hover:scale-100"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? "Creating account..." : "Sign Up"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
                
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowAuth(false)}
                    className="text-gray-400 hover:text-purple-400 text-sm transition-colors duration-200"
                  >
                    ← Back to home
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
