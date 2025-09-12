import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedCallback } from "use-debounce";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Receipt,
  Home,
  Car,
  Heart,
  Briefcase,
  DollarSign,
  Calculator,
  TrendingUp,
  Info,
  CheckCircle,
  AlertCircle,
  Loader2,
  Save,
  Check
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DeductionOptimizerProps {
  userProfile: any;
}

interface DeductionInputs {
  homeOfficeSquareFeet: number;
  totalHomeSquareFeet: number;
  businessMiles: number;
  healthInsurancePremiums: number;
  hasHDHP: boolean;
  familyCoverage: boolean;
  businessMeals: number;
  businessTravel: number;
  professionalDevelopment: number;
  businessInsurance: number;
  equipmentPurchases: number;
  softwareSubscriptions: number;
  internetPhone: number;
  professionalFees: number;
}

interface DeductionResults {
  homeOffice: number;
  vehicleExpenses: number;
  healthInsurance: number;
  hsaContribution: number;
  qbiDeduction: number;
  selfEmploymentTaxDeduction: number;
  businessExpenses: number;
  section179: number;
  totalDeductions: number;
  taxSavings: number;
  effectiveRate: number;
}

export function DeductionOptimizer({ userProfile }: DeductionOptimizerProps) {
  const queryClient = useQueryClient();
  const [inputs, setInputs] = useState<DeductionInputs>({
    homeOfficeSquareFeet: 0,
    totalHomeSquareFeet: 1000,
    businessMiles: 0,
    healthInsurancePremiums: 0,
    hasHDHP: false,
    familyCoverage: false,
    businessMeals: 0,
    businessTravel: 0,
    professionalDevelopment: 0,
    businessInsurance: 0,
    equipmentPurchases: 0,
    softwareSubscriptions: 0,
    internetPhone: 0,
    professionalFees: 0
  });

  const [deductionResults, setDeductionResults] = useState<DeductionResults | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Determine who is self-employed and get the correct income
  const userIsSelfEmployed = userProfile?.employmentStatus === 'self-employed' || 
                             userProfile?.employmentStatus === 'business-owner';
  const spouseIsSelfEmployed = userProfile?.spouseEmploymentStatus === 'self-employed' || 
                               userProfile?.spouseEmploymentStatus === 'business-owner';
  
  let selfEmploymentIncome = 0;
  if (userIsSelfEmployed) {
    // Use annualIncome for self-employed users (from Step 2 of intake form)
    selfEmploymentIncome = Number(userProfile?.selfEmploymentIncome || userProfile?.annualIncome || 0);
  } else if (spouseIsSelfEmployed) {
    selfEmploymentIncome = Number(userProfile?.spouseAnnualIncome || 0);
  } else {
    // Fallback to selfEmploymentIncome if explicitly set
    selfEmploymentIncome = Number(userProfile?.selfEmploymentIncome || 0);
  }

  // Load saved deductions on mount
  const { data: savedDeductions } = useQuery({
    queryKey: ["self-employed-deductions"],
    queryFn: async () => {
      const response = await fetch("/api/self-employed/deductions", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to load deductions");
      return response.json();
    },
    enabled: !!userProfile
  });

  // Load saved deductions when data is fetched
  useEffect(() => {
    if (savedDeductions?.deductionInputs) {
      setInputs(savedDeductions.deductionInputs);
    }
    if (savedDeductions?.deductionResults) {
      setDeductionResults(savedDeductions.deductionResults);
    }
  }, [savedDeductions]);

  // Save deductions mutation
  const saveDeductionsMutation = useMutation({
    mutationFn: async (deductionInputs: DeductionInputs) => {
      const response = await fetch("/api/self-employed/save-deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deductionInputs })
      });
      if (!response.ok) throw new Error("Failed to save deductions");
      return response.json();
    },
    onMutate: () => setIsSaving(true),
    onSettled: () => setIsSaving(false),
    onSuccess: () => {
      // Invalidate to keep data in sync
      queryClient.invalidateQueries({ queryKey: ["self-employed-deductions"] });
    }
  });

  // Debounced save function (auto-save after 1 second of no typing)
  const debouncedSave = useDebouncedCallback(
    (newInputs: DeductionInputs) => {
      saveDeductionsMutation.mutate(newInputs);
    },
    1000
  );

  const calculateDeductionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/self-employed/deduction-optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          selfEmploymentIncome: selfEmploymentIncome,
          inputs
        })
      });
      if (!response.ok) throw new Error("Failed to calculate deductions");
      return response.json();
    },
    onSuccess: (data) => {
      setDeductionResults(data);
      // Invalidate the deductions query to refetch updated data including results
      // This ensures the saved results are properly loaded from the backend
      queryClient.invalidateQueries({ queryKey: ["self-employed-deductions"] });
    }
  });

  const handleCalculate = () => {
    setIsCalculating(true);
    calculateDeductionsMutation.mutate(undefined, {
      onSettled: () => setIsCalculating(false)
    });
  };

  const handleInputChange = (field: keyof DeductionInputs, value: any) => {
    const newInputs = { ...inputs, [field]: value };
    setInputs(newInputs);
    // Auto-save after user stops typing
    debouncedSave(newInputs);
  };

  const estimatedSelfEmploymentTax = selfEmploymentIncome * 0.9235 * 0.153;
  const selfEmploymentTaxDeduction = estimatedSelfEmploymentTax / 2;

  // Estimate QBI deduction (20% of qualified business income)
  const estimatedQBI = (selfEmploymentIncome - selfEmploymentTaxDeduction) * 0.20;

  // Calculate total business expenses
  const totalBusinessExpenses = 
    inputs.businessMeals * 0.5 + // 50% deductible for 2025
    inputs.businessTravel +
    inputs.professionalDevelopment +
    inputs.businessInsurance +
    inputs.softwareSubscriptions +
    inputs.internetPhone * 0.5 + // Assuming 50% business use
    inputs.professionalFees;

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-[#8A00C4]" />
              Tax Deduction Optimizer
            </div>
            {isSaving && (
              <div className="flex items-center gap-1 text-sm text-blue-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </div>
            )}
            {!isSaving && saveDeductionsMutation.isSuccess && (
              <div className="flex items-center gap-1 text-sm text-green-400">
                <Check className="h-3 w-3" />
                Saved
              </div>
            )}
          </CardTitle>
          <CardDescription className="text-gray-400">
            Maximize your tax deductions as a self-employed professional
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 bg-gray-700/30 border-gray-600">
            <Info className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-gray-300">
              Based on your self-employment income of <strong className="text-white">${selfEmploymentIncome.toLocaleString()}</strong>, 
              you could potentially save thousands in taxes by maximizing your deductions.
            </AlertDescription>
          </Alert>

          {/* Quick Estimates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg">
              <p className="text-sm text-gray-400">SE Tax Deduction</p>
              <p className="text-xl font-bold text-blue-400">${Math.floor(selfEmploymentTaxDeduction).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">50% of SE tax</p>
            </div>
            <div className="p-4 bg-green-900/20 border border-green-800/30 rounded-lg">
              <p className="text-sm text-gray-400">QBI Deduction</p>
              <p className="text-xl font-bold text-green-400">${Math.floor(estimatedQBI).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">20% of qualified income</p>
            </div>
            <div className="p-4 bg-purple-900/20 border border-purple-800/30 rounded-lg">
              <p className="text-sm text-gray-400">Business Expenses</p>
              <p className="text-xl font-bold text-purple-400">${Math.floor(totalBusinessExpenses).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Direct expenses</p>
            </div>
          </div>

          {/* Deduction Input Sections */}
          <div className="space-y-6">
            {/* Home Office Section */}
            <div className="border border-gray-700 bg-gray-800/30 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-white">
                <Home className="h-4 w-4 text-yellow-400" />
                Home Office Deduction
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="homeOffice" className="text-gray-300">Home Office Square Feet</Label>
                  <Input
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    id="homeOffice"
                    type="number"
                    value={inputs.homeOfficeSquareFeet}
                    onChange={(e) => handleInputChange('homeOfficeSquareFeet', Number(e.target.value))}
                    max={300}
                    placeholder="Max 300 sq ft for simplified method"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Simplified: $5/sq ft (max 300) = ${Math.min(inputs.homeOfficeSquareFeet, 300) * 5}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-300" htmlFor="totalHome">Total Home Square Feet</Label>
                  <Input
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    id="totalHome"
                    type="number"
                    value={inputs.totalHomeSquareFeet}
                    onChange={(e) => handleInputChange('totalHomeSquareFeet', Number(e.target.value))}
                    placeholder="For actual expense method"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Percentage: {((inputs.homeOfficeSquareFeet / inputs.totalHomeSquareFeet) * 100).toFixed(1)}% of home
                  </p>
                </div>
              </div>
            </div>

            {/* Vehicle Section */}
            <div className="border border-gray-700 bg-gray-800/30 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-white">
                <Car className="h-4 w-4 text-blue-400" />
                Vehicle Expenses
              </h3>
              <div>
                <Label className="text-gray-300" htmlFor="businessMiles">Business Miles Driven</Label>
                <Input
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    id="businessMiles"
                  type="number"
                  value={inputs.businessMiles}
                  onChange={(e) => handleInputChange('businessMiles', Number(e.target.value))}
                  placeholder="Enter total business miles"
                />
                <p className="text-xs text-gray-500 mt-1">
                  2025 rate: $0.70/mile = ${(inputs.businessMiles * 0.70).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Health Section */}
            <div className="border border-gray-700 bg-gray-800/30 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-white">
                <Heart className="h-4 w-4 text-red-400" />
                Health-Related Deductions
              </h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-300" htmlFor="healthPremiums">Annual Health Insurance Premiums</Label>
                  <Input
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    id="healthPremiums"
                    type="number"
                    value={inputs.healthInsurancePremiums}
                    onChange={(e) => handleInputChange('healthInsurancePremiums', Number(e.target.value))}
                    placeholder="100% deductible for self-employed"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="hdhp"
                    checked={inputs.hasHDHP}
                    onCheckedChange={(checked) => handleInputChange('hasHDHP', checked)}
                    className="data-[state=unchecked]:bg-gray-600"
                  />
                  <Label className="text-gray-300" htmlFor="hdhp">I have a High Deductible Health Plan (HDHP)</Label>
                </div>
                {inputs.hasHDHP && (
                  <div className="flex items-center space-x-2 ml-6">
                    <Switch
                      id="family"
                      checked={inputs.familyCoverage}
                      onCheckedChange={(checked) => handleInputChange('familyCoverage', checked)}
                      className="data-[state=unchecked]:bg-gray-600"
                    />
                    <Label className="text-gray-300" htmlFor="family">Family Coverage</Label>
                  </div>
                )}
                {inputs.hasHDHP && (
                  <Alert className="bg-gray-700/30 border-gray-600">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <AlertDescription className="text-gray-300">
                      HSA Contribution Limit: ${inputs.familyCoverage ? '8,550' : '4,300'} 
                      {userProfile?.age >= 55 && ' (+$1,000 catch-up)'}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            {/* Business Expenses Section */}
            <div className="border border-gray-700 bg-gray-800/30 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-white">
                <Briefcase className="h-4 w-4 text-green-400" />
                Business Expenses
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300" htmlFor="meals">Business Meals (50% deductible)</Label>
                  <Input
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    id="meals"
                    type="number"
                    value={inputs.businessMeals}
                    onChange={(e) => handleInputChange('businessMeals', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-gray-300" htmlFor="travel">Business Travel</Label>
                  <Input
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    id="travel"
                    type="number"
                    value={inputs.businessTravel}
                    onChange={(e) => handleInputChange('businessTravel', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-gray-300" htmlFor="education">Professional Development</Label>
                  <Input
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    id="education"
                    type="number"
                    value={inputs.professionalDevelopment}
                    onChange={(e) => handleInputChange('professionalDevelopment', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-gray-300" htmlFor="insurance">Business Insurance</Label>
                  <Input
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    id="insurance"
                    type="number"
                    value={inputs.businessInsurance}
                    onChange={(e) => handleInputChange('businessInsurance', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-gray-300" htmlFor="equipment">Equipment (Section 179)</Label>
                  <Input
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    id="equipment"
                    type="number"
                    value={inputs.equipmentPurchases}
                    onChange={(e) => handleInputChange('equipmentPurchases', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-gray-300" htmlFor="software">Software Subscriptions</Label>
                  <Input
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    id="software"
                    type="number"
                    value={inputs.softwareSubscriptions}
                    onChange={(e) => handleInputChange('softwareSubscriptions', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-gray-300" htmlFor="internet">Internet/Phone (% business)</Label>
                  <Input
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    id="internet"
                    type="number"
                    value={inputs.internetPhone}
                    onChange={(e) => handleInputChange('internetPhone', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-gray-300" htmlFor="professional">Professional Fees</Label>
                  <Input
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    id="professional"
                    type="number"
                    value={inputs.professionalFees}
                    onChange={(e) => handleInputChange('professionalFees', Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Calculate Button */}
          <div className="mt-6">
            <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
              {isCalculating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calculating Deductions...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate Total Deductions
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Card */}
      {deductionResults && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                Your Deduction Summary
              </div>
              {savedDeductions?.resultsLastUpdated && (
                <span className="text-xs text-gray-400">
                  Last calculated: {new Date(savedDeductions.resultsLastUpdated).toLocaleString()}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-900/20 border border-green-800/30 rounded-lg">
                  <p className="text-sm text-gray-400">Total Deductions</p>
                  <p className="text-3xl font-bold text-green-400">${Math.floor(deductionResults.totalDeductions).toLocaleString()}</p>
                </div>
                <div className="text-center p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                  <p className="text-sm text-gray-400">Estimated Tax Savings</p>
                  <p className="text-3xl font-bold text-blue-400">${Math.floor(deductionResults.taxSavings).toLocaleString()}</p>
                </div>
                <div className="text-center p-4 bg-purple-900/20 border border-purple-800/30 rounded-lg">
                  <p className="text-sm text-gray-400">Effective Tax Rate</p>
                  <p className="text-3xl font-bold text-purple-400">{deductionResults.effectiveRate.toFixed(1)}%</p>
                </div>
              </div>

              {/* Deduction Breakdown */}
              <div className="border border-gray-700 bg-gray-800/30 rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-white">Deduction Breakdown</h4>
                <div className="space-y-2">
                  {[
                    { label: "Self-Employment Tax Deduction", value: deductionResults.selfEmploymentTaxDeduction },
                    { label: "QBI Deduction (20%)", value: deductionResults.qbiDeduction },
                    { label: "Home Office", value: deductionResults.homeOffice },
                    { label: "Vehicle Expenses", value: deductionResults.vehicleExpenses },
                    { label: "Health Insurance", value: deductionResults.healthInsurance },
                    { label: "HSA Contribution", value: deductionResults.hsaContribution },
                    { label: "Business Expenses", value: deductionResults.businessExpenses },
                    { label: "Section 179 (Equipment)", value: deductionResults.section179 }
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">{item.label}</span>
                      <span className="font-semibold text-white">${Math.floor(item.value).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-600 pt-2 flex justify-between items-center">
                    <span className="font-semibold text-white">Total Deductions</span>
                    <span className="text-xl font-bold text-green-400">
                      ${Math.floor(deductionResults.totalDeductions).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Items */}
              <Alert className="bg-gray-700/30 border-gray-600">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-gray-300">
                  <strong className="text-white">Action Items to Maximize Deductions:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Track all business miles with a mileage log app</li>
                    <li>Keep receipts for all business expenses</li>
                    <li>Consider maximizing HSA contributions if eligible</li>
                    <li>Document home office use exclusively for business</li>
                    <li>Review Section 179 for equipment purchases</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}