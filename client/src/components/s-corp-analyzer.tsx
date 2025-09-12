import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SCorpAnalyzerProps {
  userProfile: any;
}

interface SCorpAnalysis {
  currentStructure: {
    selfEmploymentTax: number;
    incomeTax: number;
    totalTax: number;
  };
  sCorpStructure: {
    reasonableSalary: number;
    distributions: number;
    payrollTax: number;
    incomeTax: number;
    totalTax: number;
    additionalCosts: number;
  };
  savings: {
    payrollTaxSavings: number;
    additionalCosts: number;
    netSavings: number;
    percentageSavings: number;
  };
  recommendation: {
    shouldElect: boolean;
    reason: string;
    breakEvenPoint: number;
  };
}

export function SCorpAnalyzer({ userProfile }: SCorpAnalyzerProps) {
  const [reasonableSalaryOverride, setReasonableSalaryOverride] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<SCorpAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Determine which spouse is self-employed and get their income (same logic as self-employed-strategies-tab)
  const userIsSelfEmployed = userProfile?.employmentStatus === 'self-employed' || 
                             userProfile?.employmentStatus === 'business-owner';
  const spouseIsSelfEmployed = userProfile?.spouseEmploymentStatus === 'self-employed' || 
                               userProfile?.spouseEmploymentStatus === 'business-owner';
  
  // Get the appropriate income based on who is self-employed
  let selfEmploymentIncome = 0;
  if (userIsSelfEmployed) {
    selfEmploymentIncome = userProfile?.selfEmploymentIncome || userProfile?.annualIncome || 0;
  } else if (spouseIsSelfEmployed) {
    selfEmploymentIncome = userProfile?.spouseAnnualIncome || 0;
  } else {
    // Fallback if neither is marked but isSelfEmployed flag is set
    selfEmploymentIncome = userProfile?.selfEmploymentIncome || userProfile?.annualIncome || 0;
  }

  const analyzeSCorpMutation = useMutation({
    mutationFn: async () => {
      console.log('S-Corp Analysis - Starting API call with data:', {
        selfEmploymentIncome,
        businessExpenses: userProfile?.selfEmployedData?.businessExpenses || 0,
        reasonableSalaryOverride,
        filingStatus: userProfile?.taxFilingStatus || 'single',
        state: userProfile?.state
      });
      
      const response = await fetch("/api/self-employed/s-corp-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          selfEmploymentIncome,
          businessExpenses: userProfile?.selfEmployedData?.businessExpenses || 0,
          reasonableSalaryOverride,
          filingStatus: userProfile?.taxFilingStatus || 'single',
          state: userProfile?.state
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('S-Corp Analysis - API Error:', response.status, errorText);
        throw new Error(`Failed to analyze S-Corp election: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('S-Corp Analysis - API Response:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('S-Corp Analysis - Setting analysis data:', data);
      setAnalysis(data);
    },
    onError: (error) => {
      console.error('S-Corp Analysis - Mutation Error:', error);
    }
  });

  // Auto-calculate analysis when component mounts or income changes
  useEffect(() => {
    if (selfEmploymentIncome > 0) {
      setIsAnalyzing(true);
      analyzeSCorpMutation.mutate(undefined, {
        onSettled: () => {
          setIsAnalyzing(false);
        }
      });
    }
  }, [selfEmploymentIncome, userProfile?.selfEmployedData?.businessExpenses]);
  
  const netIncome = selfEmploymentIncome - (userProfile?.selfEmployedData?.businessExpenses || 0);

  // Default calculations for display
  const defaultReasonableSalary = netIncome * 0.6;
  const defaultDistributions = netIncome * 0.4;
  const estimatedSETaxSavings = defaultDistributions * 0.153;
  const estimatedCosts = 2500; // Annual S-Corp costs
  const estimatedNetSavings = estimatedSETaxSavings - estimatedCosts;

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Building2 className="h-5 w-5 text-[#8A00C4]" />
            S-Corporation Election Analysis
          </CardTitle>
          <CardDescription className="text-gray-400">
            Analyze potential tax savings by electing S-Corp status for your business
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Quick Assessment */}
          <Alert className="mb-6 bg-blue-950/50 border-blue-800">
            <Info className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-100">
              Based on your net income of <strong className="text-white">${netIncome.toLocaleString()}</strong>, 
              an S-Corp election could potentially save you approximately <strong className="text-green-400">${Math.max(0, estimatedNetSavings).toLocaleString()}</strong> per year 
              in self-employment taxes after accounting for additional costs.
            </AlertDescription>
          </Alert>

          {/* Input Section */}
          <div className="border border-gray-700 rounded-lg p-4 mb-6 bg-gray-700/30">
            <h3 className="font-semibold mb-3 text-white">Salary Planning</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="salary" className="text-gray-200">Reasonable Salary (Optional Override)</Label>
                <Input
                  id="salary"
                  type="number"
                  value={reasonableSalaryOverride || ''}
                  onChange={(e) => setReasonableSalaryOverride(e.target.value ? Number(e.target.value) : null)}
                  placeholder={`Default: $${defaultReasonableSalary.toLocaleString()} (60% of net income)`}
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1">
                  IRS requires "reasonable compensation" for services performed. Generally 50-70% of net income.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-600">
                  <p className="text-gray-400">Salary (W-2 Income)</p>
                  <p className="text-lg font-semibold text-white">
                    ${(reasonableSalaryOverride || defaultReasonableSalary).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-600">
                  <p className="text-gray-400">Distributions (Not subject to SE tax)</p>
                  <p className="text-lg font-semibold text-white">
                    ${(netIncome - (reasonableSalaryOverride || defaultReasonableSalary)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {selfEmploymentIncome === 0 && (
            <Alert className="bg-yellow-950/50 border-yellow-800">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200">
                Please ensure your self-employment income is entered in your financial profile to see S-Corp analysis.
              </AlertDescription>
            </Alert>
          )}
          
          {isAnalyzing && selfEmploymentIncome > 0 && (
            <div className="flex items-center justify-center p-6">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#8A00C4] mx-auto mb-2" />
                <p className="text-gray-400">Calculating S-Corp benefits...</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <>
          {/* Comparison Card */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Tax Structure Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Structure */}
                <div className="border border-gray-600 rounded-lg p-4 bg-gray-700/30">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-white">
                    Current Structure (Sole Proprietor/LLC)
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-300">Self-Employment Tax</span>
                      <span className="font-semibold text-white">${analysis.currentStructure.selfEmploymentTax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-300">Income Tax</span>
                      <span className="font-semibold text-white">${analysis.currentStructure.incomeTax.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-gray-600 pt-2 flex justify-between">
                      <span className="font-semibold text-white">Total Tax</span>
                      <span className="text-xl font-bold text-white">${analysis.currentStructure.totalTax.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* S-Corp Structure */}
                <div className="border border-green-800/50 rounded-lg p-4 bg-green-950/30">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-white">
                    S-Corporation Structure
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-300">Payroll Tax (on salary)</span>
                      <span className="font-semibold text-white">${analysis.sCorpStructure.payrollTax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-300">Income Tax</span>
                      <span className="font-semibold text-white">${analysis.sCorpStructure.incomeTax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-300">Additional Costs</span>
                      <span className="font-semibold text-red-400">+${analysis.sCorpStructure.additionalCosts.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-gray-600 pt-2 flex justify-between">
                      <span className="font-semibold text-white">Total Cost</span>
                      <span className="text-xl font-bold text-green-400">
                        ${analysis.sCorpStructure.totalTax.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Savings Summary */}
              <div className="mt-6 p-4 bg-gradient-to-r from-green-950/50 to-purple-950/50 rounded-lg border border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-400">Payroll Tax Savings</p>
                    <p className="text-2xl font-bold text-green-400">
                      ${analysis.savings.payrollTaxSavings.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Additional Costs</p>
                    <p className="text-2xl font-bold text-red-400">
                      -${analysis.savings.additionalCosts.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Net Annual Savings</p>
                    <p className="text-3xl font-bold text-[#8A00C4]">
                      ${analysis.savings.netSavings.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">
                      {analysis.savings.percentageSavings.toFixed(1)}% reduction
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommendation Card */}
          <Card className={`bg-gray-800/50 ${analysis.recommendation.shouldElect ? "border-green-500" : "border-yellow-500"}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                {analysis.recommendation.shouldElect ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    S-Corp Election Recommended
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                    S-Corp Election Not Recommended Yet
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-gray-300">{analysis.recommendation.reason}</p>
              
              <Alert className="bg-blue-950/50 border-blue-800">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-100">
                  <strong className="text-white">Break-even point:</strong> Net income of <strong className="text-white">${analysis.recommendation.breakEvenPoint.toLocaleString()}</strong> or higher 
                  typically justifies S-Corp election after accounting for additional compliance costs.
                </AlertDescription>
              </Alert>

              {analysis.recommendation.shouldElect && (
                <div className="mt-4 space-y-3">
                  <h4 className="font-semibold text-white">Next Steps for S-Corp Election:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                    <li>File Form 2553 with the IRS (deadline: 2 months and 15 days after tax year begins)</li>
                    <li>Set up payroll system for reasonable salary payments</li>
                    <li>Open separate business bank account if not already done</li>
                    <li>Maintain corporate formalities (meetings, minutes, etc.)</li>
                    <li>File Form 1120S annually for S-Corp tax return</li>
                  </ol>
                  
                  <Button className="w-full mt-4 bg-[#8A00C4] hover:bg-[#7A00B4]">
                    <Building2 className="h-4 w-4 mr-2" />
                    Start S-Corp Election Process
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Considerations */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-white">S-Corp Pros & Cons</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Advantages
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex gap-2">
                      <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">Significant self-employment tax savings on distributions</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">Still eligible for QBI deduction (20% of qualified income)</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">Potential for income splitting between salary and distributions</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">May provide credibility with clients and vendors</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-red-400">
                    <XCircle className="h-4 w-4" />
                    Disadvantages
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex gap-2">
                      <XCircle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">Additional paperwork and compliance requirements</span>
                    </li>
                    <li className="flex gap-2">
                      <XCircle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">Payroll processing costs ($500-$2,000/year)</span>
                    </li>
                    <li className="flex gap-2">
                      <XCircle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">Separate business tax return (Form 1120S)</span>
                    </li>
                    <li className="flex gap-2">
                      <XCircle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">IRS scrutiny of reasonable salary amount</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reasonable Salary Guidelines */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-white">Reasonable Salary Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400 mb-4">
                The IRS requires S-Corp owners to pay themselves "reasonable compensation" for services performed. 
                Courts have considered these factors:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-[#8A00C4] mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">Training, experience, and expertise</span>
                </div>
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-[#8A00C4] mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">Time and effort devoted to business</span>
                </div>
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-[#8A00C4] mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">Comparable salaries in your industry</span>
                </div>
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-[#8A00C4] mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">Business complexity and revenue</span>
                </div>
              </div>
              
              <Alert className="mt-4 bg-yellow-950/50 border-yellow-800">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
                <AlertDescription className="text-yellow-200">
                  <strong className="text-white">60/40 Rule:</strong> While not an IRS rule, many tax professionals suggest 60% salary / 40% distributions 
                  as a starting point. Adjust based on your specific circumstances and industry standards.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}