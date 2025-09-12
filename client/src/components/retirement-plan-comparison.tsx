import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { InAppBrowser } from "@/components/ui/in-app-browser";
import {
  PiggyBank,
  TrendingUp,
  Info,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  Calculator,
  ChevronRight,
  Loader2
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RetirementPlanComparisonProps {
  userProfile: any;
}

interface PlanComparison {
  planType: string;
  contributionLimit2025: string;
  yourMaxContribution: number;
  taxSavings: number;
  rothOption: boolean;
  setupCost: string;
  ongoingCost: string;
  complexity: 'Low' | 'Medium' | 'High';
  bestFor: string;
  pros: string[];
  cons: string[];
}

export function RetirementPlanComparison({ userProfile }: RetirementPlanComparisonProps) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [planComparisons, setPlanComparisons] = useState<PlanComparison[] | null>(null);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const queryClient = useQueryClient();

  // Calculate retirement plan options
  const calculatePlansMutation = useMutation({
    mutationFn: async () => {
      // Determine who is self-employed inside the mutation
      const userIsSelfEmployed = userProfile?.employmentStatus === 'self-employed' || 
                                 userProfile?.employmentStatus === 'business-owner';
      const spouseIsSelfEmployed = userProfile?.spouseEmploymentStatus === 'self-employed' || 
                                   userProfile?.spouseEmploymentStatus === 'business-owner';
      
      let calcAge = 0;
      let calcIncome = 0;
      
      if (userIsSelfEmployed) {
        calcAge = calculateAge(userProfile?.dateOfBirth);
        calcIncome = Math.floor(Number(userProfile?.selfEmploymentIncome || userProfile?.annualIncome || 0));
      } else if (spouseIsSelfEmployed) {
        calcAge = calculateAge(userProfile?.spouseDateOfBirth);
        calcIncome = Math.floor(Number(userProfile?.spouseAnnualIncome || 0));
      } else {
        calcAge = calculateAge(userProfile?.dateOfBirth);
        calcIncome = Math.floor(Number(userProfile?.selfEmploymentIncome || userProfile?.annualIncome || 0));
      }
      
      const response = await fetch("/api/self-employed/analyze-retirement-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          selfEmploymentIncome: calcIncome,
          age: calcAge,
          spouseAge: userProfile?.spouseDateOfBirth ? calculateAge(userProfile.spouseDateOfBirth) : null,
          filingStatus: userProfile?.taxFilingStatus || 'single',
          businessExpenses: userProfile?.selfEmployedData?.businessExpenses || 0
        })
      });
      if (!response.ok) throw new Error("Failed to calculate retirement plans");
      return response.json();
    },
    onSuccess: (data) => {
      setPlanComparisons(data.comparisons);
      queryClient.invalidateQueries({ queryKey: ["financial-profile"] });
    }
  });

  const calculateAge = (dateOfBirth: string | null): number => {
    if (!dateOfBirth) return 0;
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleCalculate = () => {
    setIsCalculating(true);
    calculatePlansMutation.mutate(undefined, {
      onSettled: () => setIsCalculating(false)
    });
  };

  // Determine who is self-employed and get their age/income
  const userIsSelfEmployed = userProfile?.employmentStatus === 'self-employed' || 
                             userProfile?.employmentStatus === 'business-owner';
  const spouseIsSelfEmployed = userProfile?.spouseEmploymentStatus === 'self-employed' || 
                               userProfile?.spouseEmploymentStatus === 'business-owner';
  
  let age = 0;
  let selfEmploymentIncome = 0;
  
  if (userIsSelfEmployed) {
    age = calculateAge(userProfile?.dateOfBirth);
    selfEmploymentIncome = Math.floor(Number(userProfile?.selfEmploymentIncome || userProfile?.annualIncome || 0));
  } else if (spouseIsSelfEmployed) {
    age = calculateAge(userProfile?.spouseDateOfBirth);
    selfEmploymentIncome = Math.floor(Number(userProfile?.spouseAnnualIncome || 0));
  } else {
    // Fallback
    age = calculateAge(userProfile?.dateOfBirth);
    selfEmploymentIncome = Math.floor(Number(userProfile?.selfEmploymentIncome || userProfile?.annualIncome || 0));
  }

  // Default plan comparisons if not calculated yet
  const defaultComparisons: PlanComparison[] = [
    {
      planType: "Solo 401(k)",
      contributionLimit2025: "$69,000",
      yourMaxContribution: Math.min(69000, selfEmploymentIncome * 0.20 + 23000),
      taxSavings: Math.min(69000, selfEmploymentIncome * 0.20 + 23000) * 0.24,
      rothOption: true,
      setupCost: "$500-$1,500",
      ongoingCost: "$100-$500/year",
      complexity: 'Medium',
      bestFor: "High earners wanting maximum contributions",
      pros: [
        "Highest contribution limits",
        "Both employee and employer contributions",
        "Roth option available",
        "Loan provisions available"
      ],
      cons: [
        "More complex administration",
        "Higher setup and maintenance costs",
        "Required annual filing (Form 5500-EZ)"
      ]
    },
    {
      planType: "SEP IRA",
      contributionLimit2025: "$69,000",
      yourMaxContribution: Math.min(69000, selfEmploymentIncome * 0.20),
      taxSavings: Math.min(69000, selfEmploymentIncome * 0.20) * 0.24,
      rothOption: false,
      setupCost: "$0-$250",
      ongoingCost: "$0-$100/year",
      complexity: 'Low',
      bestFor: "Simple setup with flexible contributions",
      pros: [
        "Easy to set up and maintain",
        "Flexible annual contributions",
        "Low cost",
        "No annual filing requirements"
      ],
      cons: [
        "No Roth option",
        "Only employer contributions",
        "Must contribute equally for all employees"
      ]
    },
    {
      planType: "SIMPLE IRA",
      contributionLimit2025: "$16,000",
      yourMaxContribution: 16000 + (age >= 50 ? 3500 : 0),
      taxSavings: (16000 + (age >= 50 ? 3500 : 0)) * 0.24,
      rothOption: false,
      setupCost: "$0-$150",
      ongoingCost: "$0-$100/year",
      complexity: 'Low',
      bestFor: "Lower income or part-time self-employed",
      pros: [
        "Easy to set up",
        "Lower contribution requirements",
        "Employee deferrals allowed",
        "Catch-up contributions available"
      ],
      cons: [
        "Lower contribution limits",
        "No Roth option",
        "2-year withdrawal restrictions",
        "Must offer to all eligible employees"
      ]
    }
  ];

  const comparisons = planComparisons || defaultComparisons;
  const recommendedPlan = comparisons.reduce((best, current) => 
    current.taxSavings > best.taxSavings ? current : best
  );

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <PiggyBank className="h-5 w-5 text-blue-400" />
            Retirement Plan Comparison for 2025
          </CardTitle>
          <CardDescription className="text-gray-400">
            Compare retirement savings options based on your self-employment income of ${selfEmploymentIncome.toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!planComparisons && (
            <div className="mb-4">
              <Button onClick={handleCalculate} disabled={isCalculating} className="bg-[#8A00C4] hover:bg-[#7000A4] text-white">
                {isCalculating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate My Options
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <Table className="border border-gray-600">
              <TableHeader className="bg-gray-700/50">
                <TableRow className="border-b border-gray-600">
                  <TableHead className="text-gray-300">Plan Type</TableHead>
                  <TableHead className="text-gray-300">2025 Limit</TableHead>
                  <TableHead className="text-gray-300">Your Max</TableHead>
                  <TableHead className="text-gray-300">Tax Savings</TableHead>
                  <TableHead className="text-gray-300">Roth Option</TableHead>
                  <TableHead className="text-gray-300">Setup Cost</TableHead>
                  <TableHead className="text-gray-300">Complexity</TableHead>
                  <TableHead className="text-gray-300">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisons.map((plan) => (
                  <TableRow key={plan.planType} className={plan === recommendedPlan ? "bg-[#8A00C4]/10 border-l-4 border-l-[#8A00C4]" : "border-b border-gray-700"}>
                    <TableCell className="font-medium text-white">
                      {plan.planType}
                      {plan === recommendedPlan && (
                        <Badge className="ml-2 bg-[#8A00C4] text-white">Recommended</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-300">{plan.contributionLimit2025}</TableCell>
                    <TableCell className="font-semibold text-white">${plan.yourMaxContribution.toLocaleString()}</TableCell>
                    <TableCell className="text-green-400 font-semibold">
                      ${plan.taxSavings.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {plan.rothOption ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="text-gray-300">{plan.setupCost}</TableCell>
                    <TableCell>
                      <Badge variant={plan.complexity === 'Low' ? 'secondary' : plan.complexity === 'Medium' ? 'default' : 'destructive'} className={plan.complexity === 'Low' ? 'bg-green-600/20 text-green-400 border-green-600' : plan.complexity === 'Medium' ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600' : 'bg-red-600/20 text-red-400 border-red-600'}>
                        {plan.complexity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Info className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-gray-800 border-gray-600">
                            <p className="font-semibold mb-2 text-white">Best for: {plan.bestFor}</p>
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs font-semibold text-green-400">Pros:</p>
                                <ul className="text-xs list-disc list-inside text-gray-300">
                                  {plan.pros.map((pro, i) => (
                                    <li key={i}>{pro}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-red-400">Cons:</p>
                                <ul className="text-xs list-disc list-inside text-gray-300">
                                  {plan.cons.map((con, i) => (
                                    <li key={i}>{con}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Age-based catch-up contributions notice */}
          {age >= 50 && (
            <Alert className="mt-4 bg-blue-500/10 border-blue-500/20">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-gray-300">
                <strong>Age 50+ Catch-Up Contributions:</strong> You're eligible for additional catch-up contributions:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Solo 401(k): +$7,500 {age >= 60 && age <= 63 && "(+$11,250 for ages 60-63)"}</li>
                  <li>SIMPLE IRA: +$3,500 {age >= 60 && age <= 63 && "(+$5,250 for ages 60-63)"}</li>
                  <li>Traditional/Roth IRA: +$1,000</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recommended Action Card */}
      <Card className="bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950 border-purple-600 shadow-xl shadow-purple-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Recommended Action: {recommendedPlan.planType}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-400">Maximum Contribution</p>
                <p className="text-2xl font-bold text-white">${recommendedPlan.yourMaxContribution.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Estimated Tax Savings</p>
                <p className="text-2xl font-bold text-green-400">${recommendedPlan.taxSavings.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">First Year ROI</p>
                <p className="text-2xl font-bold text-white">{((recommendedPlan.taxSavings / recommendedPlan.yourMaxContribution) * 100).toFixed(0)}%</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-600">
              <h4 className="font-semibold mb-2 text-white">Next Steps to Open {recommendedPlan.planType}:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                <li>Choose a provider (Vanguard, Fidelity, Schwab, etc.)</li>
                <li>Complete the plan adoption agreement</li>
                <li>Set up your contribution schedule</li>
                <li>Establish investment selections</li>
                <li>Begin making contributions (deadline: tax filing date)</li>
              </ol>
            </div>

            <div className="flex justify-center">
              <Button 
                onClick={() => setIsBrowserOpen(true)}
                className="bg-[#8A00C4] hover:bg-[#7000A4] text-white px-8 py-6 text-lg font-semibold shadow-lg shadow-purple-900/50 hover:shadow-xl hover:shadow-purple-800/60 transition-all duration-300"
              >
                <ChevronRight className="h-5 w-5 mr-2" />
                Open {recommendedPlan.planType} Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Educational Info */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">Important Considerations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p>
                <strong>Contribution Deadlines:</strong> For 2025, you have until April 15, 2026 (tax filing deadline) to make 2025 contributions to SEP IRAs and traditional IRAs. Solo 401(k) employee deferrals must be made by December 31, 2025.
              </p>
            </div>
            <div className="flex gap-2">
              <DollarSign className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <p>
                <strong>Tax Benefits:</strong> Contributions are tax-deductible, reducing your current year tax liability. Investments grow tax-deferred until withdrawal in retirement.
              </p>
            </div>
            <div className="flex gap-2">
              <Calculator className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <p>
                <strong>Employer Contributions:</strong> As a self-employed individual, you can make both employee and employer contributions to a Solo 401(k), maximizing your savings potential.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* In-App Browser for Solo 401(k) Providers */}
      <InAppBrowser
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        url="https://www.investopedia.com/the-best-solo-401k-companies-11705501"
        title="Best Solo 401(k) Companies - Investopedia"
      />
    </div>
  );
}