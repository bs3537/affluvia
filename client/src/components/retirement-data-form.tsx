import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  Heart, 
  Calculator, 
  Home, 
  Activity,
  Info,
  Save,
  CheckCircle
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface RetirementData {
  // Social Security & Pensions
  socialSecurity?: {
    expectedBenefit: number;
    claimingAge: number;
    fullRetirementAge: number;
    currentCredits: number;
  };
  spouseSocialSecurity?: {
    expectedBenefit: number;
    claimingAge: number;
    fullRetirementAge: number;
    currentCredits: number;
  };
  pensions?: Array<{
    name: string;
    monthlyAmount: number;
    startAge: number;
    hasCOLA: boolean;
    survivorBenefit: number;
  }>;
  otherIncome?: {
    partTimeWork: number;
    rentalIncome: number;
    annuities: number;
    other: number;
  };

  // Healthcare Planning
  healthcarePlanning?: {
    healthStatus: 'excellent' | 'good' | 'fair' | 'poor';
    preMedicareCosts: number;
    medicareCosts: number;
    longTermCareBudget: number;
    hsaBalance: number;
    hasLongTermCareInsurance: boolean;
    chronicConditions: string[];
  };

  // Tax Strategy
  taxStrategy?: {
    currentTaxBracket: number;
    stateOfResidence: string;
    expectedRetirementTaxBracket: number;
    accountBalances: {
      traditional401k: number;
      roth401k: number;
      traditionalIRA: number;
      rothIRA: number;
      taxableBrokerage: number;
      hsa: number;
    };
    rmdStrategy: 'minimize' | 'standard' | 'maximize';
  };

  // Retirement Lifestyle
  retirementLifestyle?: {
    monthlyBudget: {
      housing: number;
      transportation: number;
      food: number;
      healthcare: number;
      travel: number;
      entertainment: number;
      charity: number;
      other: number;
    };
    relocationPlans: {
      planning: boolean;
      targetState?: string;
      targetDate?: string;
      costOfLivingChange?: number;
    };
    legacyGoals: {
      amount: number;
      beneficiaries: string;
      charitableGiving: number;
    };
  };

  // Longevity Factors
  longevityFactors?: {
    familyHistory: {
      parentsLiving: boolean;
      motherAgeAtDeath?: number;
      fatherAgeAtDeath?: number;
      grandparentsAvgAge?: number;
    };
    lifestyle: {
      smokingStatus: 'never' | 'former' | 'current';
      exerciseFrequency: 'daily' | 'weekly' | 'rarely' | 'never';
      bmi?: number;
      alcoholConsumption: 'none' | 'moderate' | 'heavy';
    };
  };
}

export function RetirementDataForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<RetirementData>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch existing retirement data
  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/financial-profile"],
  });

  // Load existing data when profile loads
  useEffect(() => {
    if ((profile as any)?.retirementPlanningData) {
      setFormData((profile as any).retirementPlanningData);
    }
  }, [profile]);

  // Auto-save mutation
  const saveDataMutation = useMutation({
    mutationFn: async (data: RetirementData) => {
      const response = await fetch("/api/retirement-planning-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to save");
      return response.json();
    },
    onSuccess: () => {
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/financial-profile"] });
      toast({
        title: "Saved",
        description: "Your retirement planning data has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save retirement planning data.",
        variant: "destructive",
      });
    },
  });

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timer = setTimeout(() => {
      saveDataMutation.mutate(formData);
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [formData, hasUnsavedChanges]);

  // Update form data helper
  const updateFormData = (path: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current: any = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
      
      current[keys[keys.length - 1]] = value;
      return newData;
    });
    setHasUnsavedChanges(true);
  };
  
  // Helper for number inputs that allows 0
  const handleNumberInput = (path: string, value: string) => {
    if (value === '') {
      updateFormData(path, undefined);
    } else {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        updateFormData(path, num);
      }
    }
  };

  // Calculate section completion
  const calculateCompletion = (section: string): number => {
    switch (section) {
      case 'socialSecurity':
        const ssData = formData.socialSecurity;
        if (!ssData) return 0;
        const ssFields = ['expectedBenefit', 'claimingAge', 'fullRetirementAge', 'currentCredits'];
        const ssCompleted = ssFields.filter(field => ssData[field as keyof typeof ssData]).length;
        return (ssCompleted / ssFields.length) * 100;
      
      case 'healthcare':
        const hcData = formData.healthcarePlanning;
        if (!hcData) return 0;
        const hcFields = ['healthStatus', 'preMedicareCosts', 'medicareCosts', 'hsaBalance'];
        const hcCompleted = hcFields.filter(field => hcData[field as keyof typeof hcData]).length;
        return (hcCompleted / hcFields.length) * 100;
      
      case 'tax':
        const taxData = formData.taxStrategy;
        if (!taxData) return 0;
        const hasBalances = taxData.accountBalances && 
          Object.values(taxData.accountBalances).some(v => v > 0);
        const taxFields = ['currentTaxBracket', 'stateOfResidence'];
        const taxCompleted = taxFields.filter(field => taxData[field as keyof typeof taxData]).length;
        return ((taxCompleted + (hasBalances ? 1 : 0)) / 3) * 100;
      
      case 'lifestyle':
        const lifestyleData = formData.retirementLifestyle;
        if (!lifestyleData) return 0;
        const hasBudget = lifestyleData.monthlyBudget && 
          Object.values(lifestyleData.monthlyBudget).some(v => v > 0);
        return hasBudget ? 50 : 0;
      
      case 'longevity':
        const longevityData = formData.longevityFactors;
        if (!longevityData) return 0;
        const hasFamily = longevityData.familyHistory?.parentsLiving !== undefined;
        const hasLifestyle = longevityData.lifestyle?.smokingStatus !== undefined;
        return ((hasFamily ? 1 : 0) + (hasLifestyle ? 1 : 0)) * 50;
      
      default:
        return 0;
    }
  };

  const sections = [
    {
      id: 'socialSecurity',
      title: "Social Security & Pensions",
      icon: DollarSign,
      completion: calculateCompletion('socialSecurity')
    },
    {
      id: 'healthcare',
      title: "Healthcare Planning",
      icon: Heart,
      completion: calculateCompletion('healthcare')
    },
    {
      id: 'tax',
      title: "Tax Strategy",
      icon: Calculator,
      completion: calculateCompletion('tax')
    },
    {
      id: 'lifestyle',
      title: "Retirement Lifestyle",
      icon: Home,
      completion: calculateCompletion('lifestyle')
    },
    {
      id: 'longevity',
      title: "Longevity Factors",
      icon: Activity,
      completion: calculateCompletion('longevity')
    }
  ];

  const overallCompletion = sections.reduce((sum, section) => sum + section.completion, 0) / sections.length;

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Retirement Planning Data</CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {lastSaved && (
                <>
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
                </>
              )}
              {hasUnsavedChanges && (
                <>
                  <Save className="h-4 w-4 text-yellow-400 animate-pulse" />
                  <span>Saving...</span>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-300">Overall Completion</span>
                <span className="text-white font-semibold">{Math.round(overallCompletion)}%</span>
              </div>
              <Progress value={overallCompletion} className="h-3" />
            </div>
            
            <div className="space-y-3">
              {sections.map(section => (
                <div key={section.id} className="flex items-center gap-4">
                  <section.icon className="h-5 w-5 text-gray-400" />
                  <span className="flex-1 text-gray-300">{section.title}</span>
                  <Progress value={section.completion} className="w-32 h-2" />
                  <span className="text-sm text-gray-400 w-12 text-right">{Math.round(section.completion)}%</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert for better projections */}
      {overallCompletion < 50 && (
        <Alert className="bg-blue-500/20 border-blue-500/50">
          <Info className="h-4 w-4" />
          <AlertTitle>Enhance Your Projections</AlertTitle>
          <AlertDescription>
            Complete more sections below for increasingly accurate retirement simulations. 
            Each section adds important factors to your personalized projections.
          </AlertDescription>
        </Alert>
      )}

      {/* Collapsible Sections */}
      <Accordion type="single" collapsible className="space-y-4">
        {/* Social Security & Pensions */}
        <AccordionItem value="socialSecurity" className="bg-gray-800/50 border-gray-700 rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-yellow-400" />
              <span className="text-white">Social Security & Pensions</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-6">
              {/* Social Security */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Your Social Security</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ss-benefit" className="text-gray-300">Expected Monthly Benefit (at FRA)</Label>
                    <Input
                      id="ss-benefit"
                      type="number"
                      placeholder="2500"
                      value={formData.socialSecurity?.expectedBenefit || ''}
                      onChange={(e) => handleNumberInput('socialSecurity.expectedBenefit', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ss-claim-age" className="text-gray-300">Planned Claiming Age</Label>
                    <Select
                      value={formData.socialSecurity?.claimingAge?.toString() || ''}
                      onValueChange={(value) => updateFormData('socialSecurity.claimingAge', parseInt(value))}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Select age" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 9 }, (_, i) => 62 + i).map(age => (
                          <SelectItem key={age} value={age.toString()}>{age}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ss-fra" className="text-gray-300">Full Retirement Age (FRA)</Label>
                    <Select
                      value={formData.socialSecurity?.fullRetirementAge?.toString() || ''}
                      onValueChange={(value) => updateFormData('socialSecurity.fullRetirementAge', parseInt(value))}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Select FRA" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="66">66</SelectItem>
                        <SelectItem value="66.5">66 and 6 months</SelectItem>
                        <SelectItem value="67">67</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ss-credits" className="text-gray-300">Work Credits Earned</Label>
                    <Input
                      id="ss-credits"
                      type="number"
                      placeholder="40"
                      value={formData.socialSecurity?.currentCredits || ''}
                      onChange={(e) => updateFormData('socialSecurity.currentCredits', parseInt(e.target.value) || 0)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Spouse Social Security (if married) */}
              {(profile as any)?.maritalStatus === 'married' && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Spouse's Social Security</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300">Expected Monthly Benefit (at FRA)</Label>
                      <Input
                        type="number"
                        placeholder="2000"
                        value={formData.spouseSocialSecurity?.expectedBenefit || ''}
                        onChange={(e) => handleNumberInput('spouseSocialSecurity.expectedBenefit', e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300">Planned Claiming Age</Label>
                      <Select
                        value={formData.spouseSocialSecurity?.claimingAge?.toString() || ''}
                        onValueChange={(value) => updateFormData('spouseSocialSecurity.claimingAge', parseInt(value))}
                      >
                        <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                          <SelectValue placeholder="Select age" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 9 }, (_, i) => 62 + i).map(age => (
                            <SelectItem key={age} value={age.toString()}>{age}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Other Income Sources */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Other Retirement Income</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Part-time Work (Annual)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.otherIncome?.partTimeWork || ''}
                      onChange={(e) => handleNumberInput('otherIncome.partTimeWork', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Rental Income (Annual)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.otherIncome?.rentalIncome || ''}
                      onChange={(e) => handleNumberInput('otherIncome.rentalIncome', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Annuity Income (Annual)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.otherIncome?.annuities || ''}
                      onChange={(e) => handleNumberInput('otherIncome.annuities', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Other Income (Annual)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.otherIncome?.other || ''}
                      onChange={(e) => handleNumberInput('otherIncome.other', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Healthcare Planning */}
        <AccordionItem value="healthcare" className="bg-gray-800/50 border-gray-700 rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-red-400" />
              <span className="text-white">Healthcare Planning</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Current Health Status</Label>
                  <Select
                    value={formData.healthcarePlanning?.healthStatus || ''}
                    onValueChange={(value) => updateFormData('healthcarePlanning.healthStatus', value)}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-300">HSA Balance</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.healthcarePlanning?.hsaBalance || ''}
                    onChange={(e) => handleNumberInput('healthcarePlanning.hsaBalance', e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Annual Healthcare Costs (Pre-Medicare)</Label>
                  <Input
                    type="number"
                    placeholder="8000"
                    value={formData.healthcarePlanning?.preMedicareCosts || ''}
                    onChange={(e) => handleNumberInput('healthcarePlanning.preMedicareCosts', e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Annual Healthcare Costs (With Medicare)</Label>
                  <Input
                    type="number"
                    placeholder="5000"
                    value={formData.healthcarePlanning?.medicareCosts || ''}
                    onChange={(e) => handleNumberInput('healthcarePlanning.medicareCosts', e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Long-term Care Budget</Label>
                  <Input
                    type="number"
                    placeholder="300000"
                    value={formData.healthcarePlanning?.longTermCareBudget || ''}
                    onChange={(e) => handleNumberInput('healthcarePlanning.longTermCareBudget', e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ltc-insurance"
                    checked={formData.healthcarePlanning?.hasLongTermCareInsurance || false}
                    onChange={(e) => updateFormData('healthcarePlanning.hasLongTermCareInsurance', e.target.checked)}
                    className="rounded border-gray-600"
                  />
                  <Label htmlFor="ltc-insurance" className="text-gray-300 cursor-pointer">
                    Have long-term care insurance
                  </Label>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Tax Strategy */}
        <AccordionItem value="tax" className="bg-gray-800/50 border-gray-700 rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <Calculator className="h-5 w-5 text-green-400" />
              <span className="text-white">Tax Strategy</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Current Tax Bracket</Label>
                  <Select
                    value={formData.taxStrategy?.currentTaxBracket?.toString() || ''}
                    onValueChange={(value) => updateFormData('taxStrategy.currentTaxBracket', parseInt(value))}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="Select bracket" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="22">22%</SelectItem>
                      <SelectItem value="24">24%</SelectItem>
                      <SelectItem value="32">32%</SelectItem>
                      <SelectItem value="35">35%</SelectItem>
                      <SelectItem value="37">37%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-300">State of Residence</Label>
                  <Input
                    type="text"
                    placeholder="CA"
                    value={formData.taxStrategy?.stateOfResidence || ''}
                    onChange={(e) => updateFormData('taxStrategy.stateOfResidence', e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Account Balances by Type</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Traditional 401(k)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.taxStrategy?.accountBalances?.traditional401k || ''}
                      onChange={(e) => handleNumberInput('taxStrategy.accountBalances.traditional401k', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Roth 401(k)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.taxStrategy?.accountBalances?.roth401k || ''}
                      onChange={(e) => handleNumberInput('taxStrategy.accountBalances.roth401k', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Traditional IRA</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.taxStrategy?.accountBalances?.traditionalIRA || ''}
                      onChange={(e) => handleNumberInput('taxStrategy.accountBalances.traditionalIRA', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Roth IRA</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.taxStrategy?.accountBalances?.rothIRA || ''}
                      onChange={(e) => handleNumberInput('taxStrategy.accountBalances.rothIRA', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Taxable Brokerage</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.taxStrategy?.accountBalances?.taxableBrokerage || ''}
                      onChange={(e) => handleNumberInput('taxStrategy.accountBalances.taxableBrokerage', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">HSA</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.taxStrategy?.accountBalances?.hsa || ''}
                      onChange={(e) => handleNumberInput('taxStrategy.accountBalances.hsa', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Retirement Lifestyle */}
        <AccordionItem value="lifestyle" className="bg-gray-800/50 border-gray-700 rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <Home className="h-5 w-5 text-purple-400" />
              <span className="text-white">Retirement Lifestyle</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Monthly Budget in Retirement</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Housing</Label>
                    <Input
                      type="number"
                      placeholder="2000"
                      value={formData.retirementLifestyle?.monthlyBudget?.housing || ''}
                      onChange={(e) => handleNumberInput('retirementLifestyle.monthlyBudget.housing', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Transportation</Label>
                    <Input
                      type="number"
                      placeholder="500"
                      value={formData.retirementLifestyle?.monthlyBudget?.transportation || ''}
                      onChange={(e) => handleNumberInput('retirementLifestyle.monthlyBudget.transportation', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Food</Label>
                    <Input
                      type="number"
                      placeholder="800"
                      value={formData.retirementLifestyle?.monthlyBudget?.food || ''}
                      onChange={(e) => handleNumberInput('retirementLifestyle.monthlyBudget.food', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Healthcare</Label>
                    <Input
                      type="number"
                      placeholder="500"
                      value={formData.retirementLifestyle?.monthlyBudget?.healthcare || ''}
                      onChange={(e) => handleNumberInput('retirementLifestyle.monthlyBudget.healthcare', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Travel</Label>
                    <Input
                      type="number"
                      placeholder="1000"
                      value={formData.retirementLifestyle?.monthlyBudget?.travel || ''}
                      onChange={(e) => handleNumberInput('retirementLifestyle.monthlyBudget.travel', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Entertainment</Label>
                    <Input
                      type="number"
                      placeholder="500"
                      value={formData.retirementLifestyle?.monthlyBudget?.entertainment || ''}
                      onChange={(e) => handleNumberInput('retirementLifestyle.monthlyBudget.entertainment', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>
                {formData.retirementLifestyle?.monthlyBudget && (
                  <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Total Monthly Budget</span>
                      <span className="text-xl font-semibold text-white">
                        ${Object.values(formData.retirementLifestyle.monthlyBudget).reduce((sum, val) => sum + (val || 0), 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-gray-400">Annual Budget</span>
                      <span className="text-lg text-gray-300">
                        ${(Object.values(formData.retirementLifestyle.monthlyBudget).reduce((sum, val) => sum + (val || 0), 0) * 12).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Relocation Plans</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="relocation-planning"
                      checked={formData.retirementLifestyle?.relocationPlans?.planning || false}
                      onChange={(e) => updateFormData('retirementLifestyle.relocationPlans.planning', e.target.checked)}
                      className="rounded border-gray-600"
                    />
                    <Label htmlFor="relocation-planning" className="text-gray-300 cursor-pointer">
                      Planning to relocate in retirement
                    </Label>
                  </div>
                  {formData.retirementLifestyle?.relocationPlans?.planning && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                      <div>
                        <Label className="text-gray-300">Target State</Label>
                        <Input
                          type="text"
                          placeholder="FL"
                          value={formData.retirementLifestyle?.relocationPlans?.targetState || ''}
                          onChange={(e) => updateFormData('retirementLifestyle.relocationPlans.targetState', e.target.value)}
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Cost of Living Change (%)</Label>
                        <Input
                          type="number"
                          placeholder="-20"
                          value={formData.retirementLifestyle?.relocationPlans?.costOfLivingChange || ''}
                          onChange={(e) => handleNumberInput('retirementLifestyle.relocationPlans.costOfLivingChange', e.target.value)}
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Longevity Factors */}
        <AccordionItem value="longevity" className="bg-gray-800/50 border-gray-700 rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-blue-300" />
              <span className="text-white">Longevity Factors</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Family History</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="parents-living"
                      checked={formData.longevityFactors?.familyHistory?.parentsLiving || false}
                      onChange={(e) => updateFormData('longevityFactors.familyHistory.parentsLiving', e.target.checked)}
                      className="rounded border-gray-600"
                    />
                    <Label htmlFor="parents-living" className="text-gray-300 cursor-pointer">
                      One or both parents still living
                    </Label>
                  </div>
                  {!formData.longevityFactors?.familyHistory?.parentsLiving && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                      <div>
                        <Label className="text-gray-300">Mother's Age at Death</Label>
                        <Input
                          type="number"
                          placeholder="80"
                          value={formData.longevityFactors?.familyHistory?.motherAgeAtDeath || ''}
                          onChange={(e) => updateFormData('longevityFactors.familyHistory.motherAgeAtDeath', parseInt(e.target.value) || 0)}
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Father's Age at Death</Label>
                        <Input
                          type="number"
                          placeholder="75"
                          value={formData.longevityFactors?.familyHistory?.fatherAgeAtDeath || ''}
                          onChange={(e) => updateFormData('longevityFactors.familyHistory.fatherAgeAtDeath', parseInt(e.target.value) || 0)}
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Lifestyle Factors</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Smoking Status</Label>
                    <Select
                      value={formData.longevityFactors?.lifestyle?.smokingStatus || ''}
                      onValueChange={(value) => updateFormData('longevityFactors.lifestyle.smokingStatus', value)}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never Smoked</SelectItem>
                        <SelectItem value="former">Former Smoker</SelectItem>
                        <SelectItem value="current">Current Smoker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-300">Exercise Frequency</Label>
                    <Select
                      value={formData.longevityFactors?.lifestyle?.exerciseFrequency || ''}
                      onValueChange={(value) => updateFormData('longevityFactors.lifestyle.exerciseFrequency', value)}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Several times a week</SelectItem>
                        <SelectItem value="rarely">Rarely</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Manual Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => saveDataMutation.mutate(formData)}
          disabled={!hasUnsavedChanges || saveDataMutation.isPending}
          className="bg-primary hover:bg-primary/90"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveDataMutation.isPending ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>
    </div>
  );
}