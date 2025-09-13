import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Calendar,
  DollarSign,
  Calculator,
  Info,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  FileText,
  Loader2
} from "lucide-react";
import { format } from "date-fns";

interface QuarterlyTaxCalculatorProps {
  userProfile: any;
}

interface QuarterlyPayment {
  quarter: number;
  dueDate: string;
  amount: number;
  safeHarborAmount: number;
  currentYearAmount: number;
  status: 'paid' | 'upcoming' | 'overdue';
}

export function QuarterlyTaxCalculator({ userProfile }: QuarterlyTaxCalculatorProps) {
  const queryClient = useQueryClient();
  const [thisYearEstimatedIncome, setThisYearEstimatedIncome] = useState(0);
  const [estimatedTaxes, setEstimatedTaxes] = useState<{
    selfEmploymentTax: number;
    incomeTax: number;
    totalTax: number;
    quarterlyAmount: number;
  } | null>(null);

  // Load saved estimated tax data
  useEffect(() => {
    if (userProfile?.selfEmployedData) {
      const selfEmployedData = userProfile.selfEmployedData as any;
      if (selfEmployedData.estimatedTaxData) {
        const savedData = selfEmployedData.estimatedTaxData;
        setThisYearEstimatedIncome(savedData.thisYearEstimatedIncome || userProfile?.selfEmploymentIncome || 0);
        if (savedData.estimatedTaxes) {
          setEstimatedTaxes(savedData.estimatedTaxes);
        }
      } else {
        setThisYearEstimatedIncome(userProfile?.selfEmploymentIncome || 0);
      }
    } else {
      setThisYearEstimatedIncome(userProfile?.selfEmploymentIncome || 0);
    }
  }, [userProfile]);

  // Save estimated tax data to database
  const saveEstimatedTaxData = useMutation({
    mutationFn: async (data: { thisYearEstimatedIncome: number; estimatedTaxes?: any }) => {
      const response = await fetch("/api/self-employed/save-estimated-taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to save estimated tax data");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the financial profile query to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/financial-profile"] });
    }
  });

  // Save income when it changes (debounced)
  const handleIncomeChange = (value: number) => {
    setThisYearEstimatedIncome(value);
    // Save the income change immediately
    if (value > 0) {
      saveEstimatedTaxData.mutate({
        thisYearEstimatedIncome: value,
        estimatedTaxes: estimatedTaxes || undefined
      });
    }
  };


  const handleCalculateEstimatedTaxes = () => {
    // Calculate self-employment tax (15.3% on 92.35% of income)
    const netEarnings = thisYearEstimatedIncome * 0.9235;
    const selfEmploymentTax = netEarnings * 0.153;
    
    // Estimate income tax (simplified calculation)
    // Using a progressive approximation for federal income tax
    let incomeTax = 0;
    const adjustedIncome = thisYearEstimatedIncome - (selfEmploymentTax / 2); // Deduct half of SE tax
    
    if (adjustedIncome <= 11000) {
      incomeTax = adjustedIncome * 0.10;
    } else if (adjustedIncome <= 44725) {
      incomeTax = 1100 + (adjustedIncome - 11000) * 0.12;
    } else if (adjustedIncome <= 95375) {
      incomeTax = 5147 + (adjustedIncome - 44725) * 0.22;
    } else if (adjustedIncome <= 182050) {
      incomeTax = 16290 + (adjustedIncome - 95375) * 0.24;
    } else if (adjustedIncome <= 231250) {
      incomeTax = 37104 + (adjustedIncome - 182050) * 0.32;
    } else {
      incomeTax = 52832 + (adjustedIncome - 231250) * 0.35;
    }
    
    const totalTax = selfEmploymentTax + incomeTax;
    const quarterlyAmount = totalTax / 4;
    
    const calculatedTaxes = {
      selfEmploymentTax: Math.round(selfEmploymentTax),
      incomeTax: Math.round(incomeTax),
      totalTax: Math.round(totalTax),
      quarterlyAmount: Math.round(quarterlyAmount)
    };
    
    setEstimatedTaxes(calculatedTaxes);
    
    // Save to database
    saveEstimatedTaxData.mutate({
      thisYearEstimatedIncome,
      estimatedTaxes: calculatedTaxes
    });
  };

  // Use the calculated estimated taxes if available, otherwise use simplified calculation
  const displaySETax = estimatedTaxes?.selfEmploymentTax || (thisYearEstimatedIncome * 0.9235 * 0.153);
  const displayIncomeTax = estimatedTaxes?.incomeTax || (thisYearEstimatedIncome * 0.22);
  const displayTotalTax = estimatedTaxes?.totalTax || (displaySETax + displayIncomeTax);

  // 2025 quarterly tax due dates
  const quarterlyDueDates = [
    { quarter: 1, date: '2025-04-15', label: 'Q1 2025' },
    { quarter: 2, date: '2025-06-16', label: 'Q2 2025' },
    { quarter: 3, date: '2025-09-15', label: 'Q3 2025' },
    { quarter: 4, date: '2026-01-15', label: 'Q4 2025' }
  ];

  const currentDate = new Date();
  const nextDueDate = quarterlyDueDates.find(q => new Date(q.date) > currentDate);

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Calculator className="h-5 w-5 text-[#8A00C4]" />
            Estimated Tax Calculator
          </CardTitle>
          <CardDescription className="text-gray-400">
            Calculate and schedule your quarterly estimated tax payments for 2025
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* This Year's Income Input */}
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <h3 className="font-semibold mb-3 text-white">This Year's Estimated Self-Employment Income</h3>
            <div className="flex gap-4 items-start">
              <div className="flex-[0.75]">
                <Label htmlFor="thisYearIncome" className="text-sm font-medium text-gray-200">Estimated Annual Self-Employment Income</Label>
                <Input
                  id="thisYearIncome"
                  type="number"
                  value={thisYearEstimatedIncome}
                  onChange={(e) => handleIncomeChange(Number(e.target.value))}
                  placeholder="Enter this year's estimated income"
                  className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Enter your best estimate for this year's self-employment income
                </p>
              </div>
              <div className="flex flex-col">
                <div className="h-6"></div>
                <Button 
                  onClick={handleCalculateEstimatedTaxes}
                  className="bg-[#8A00C4] hover:bg-[#7A00B4] text-white px-6 py-2 mt-1"
                  disabled={!thisYearEstimatedIncome}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate Annual Tax Estimate
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-400">Self-Employment Tax</p>
              <p className="text-xl font-bold text-white">${Math.round(displaySETax).toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">15.3% on 92.35% of income</p>
              {estimatedTaxes && (
                <p className="text-xs text-green-400 mt-1">✓ Based on current year estimate</p>
              )}
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-400">Estimated Income Tax</p>
              <p className="text-xl font-bold text-white">${Math.round(displayIncomeTax).toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">{estimatedTaxes ? 'Progressive rate calculation' : 'Simplified estimate (22%)'}</p>
              {estimatedTaxes && (
                <p className="text-xs text-green-400 mt-1">✓ Based on current year estimate</p>
              )}
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-400">Total Annual Tax</p>
              <p className="text-xl font-bold text-white">${Math.round(displayTotalTax).toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Quarterly: ${Math.round(displayTotalTax / 4).toLocaleString()}</p>
              {estimatedTaxes && (
                <p className="text-xs text-green-400 mt-1">✓ Based on current year estimate</p>
              )}
            </div>
          </div>

          {/* Next Payment Alert */}
          {nextDueDate && (
            <Alert className="mb-6 bg-blue-950/50 border-blue-800 text-blue-100">
              <Clock className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-100">
                <strong>Next Payment Due:</strong> {nextDueDate.label} - {format(new Date(nextDueDate.date), 'MMMM d, yyyy')}
                <br />
                Estimated amount: ${Math.round(displayTotalTax / 4).toLocaleString()}
              </AlertDescription>
            </Alert>
          )}

        </CardContent>
      </Card>

      {/* Quarterly Payment Schedule */}
      {estimatedTaxes && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Calendar className="h-5 w-5 text-[#8A00C4]" />
              Your 2025 Quarterly Payment Schedule
            </CardTitle>
            <CardDescription className="text-gray-400">
              Based on your current year estimated income
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Payment Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quarterlyDueDates.map((quarter) => {
                  const dueDate = new Date(quarter.date);
                  const isPast = dueDate < currentDate;
                  const isNext = quarter === nextDueDate;
                  
                  return (
                    <Card key={quarter.quarter} className={`bg-gray-700/50 border-gray-600 ${isNext ? "border-[#8A00C4]" : ""}`}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base text-white">{quarter.label}</CardTitle>
                            <CardDescription className="text-gray-400">{format(dueDate, 'MMMM d, yyyy')}</CardDescription>
                          </div>
                          <Badge 
                            variant={isPast ? "secondary" : isNext ? "default" : "outline"}
                            className={`rounded-full border ${isNext ? "bg-[#8A00C4] text-white border-[#8A00C4]" : isPast ? "bg-gray-600 text-gray-200 border-gray-500" : "bg-gray-700 text-white border-gray-500"}`}
                          >
                            {isPast ? "Past" : isNext ? "Next Due" : "Upcoming"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-400">Estimated Payment</span>
                            <span className="font-bold text-lg text-white">${Math.round(estimatedTaxes.quarterlyAmount).toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-green-400">
                            Based on current year estimate
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Total Summary */}
              <div className="border border-gray-600 rounded-lg p-4 bg-gray-700/30">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-white">Total 2025 Estimated Payments</span>
                  <span className="text-2xl font-bold text-white">
                    ${Math.round(estimatedTaxes.totalTax).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Payment Methods */}
              <Card className="bg-gray-700/30 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-base text-white">How to Make Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="text-gray-300">
                        <strong>IRS Direct Pay:</strong> Pay directly from your bank account at{" "}
                        <a href="https://www.irs.gov/payments" target="_blank" rel="noopener noreferrer" className="text-[#8A00C4] hover:underline">
                          IRS.gov/payments
                        </a>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="text-gray-300">
                        <strong>EFTPS:</strong> Schedule payments in advance at{" "}
                        <a href="https://www.eftps.gov" target="_blank" rel="noopener noreferrer" className="text-[#8A00C4] hover:underline">
                          EFTPS.gov
                        </a>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="text-gray-300">
                        <strong>Check/Money Order:</strong> Mail with Form 1040-ES payment voucher
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="text-gray-300">
                        <strong>Credit/Debit Card:</strong> Through approved payment processors (fees apply)
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Important Reminders */}
              <Alert className="bg-yellow-950/50 border-yellow-800">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
                <AlertDescription className="text-yellow-200">
                  <strong>Important Reminders:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Keep records of all quarterly payments for tax filing</li>
                    <li>Adjust payments if income changes significantly</li>
                    <li>Consider paying weekly/monthly if easier to budget</li>
                    <li>Set calendar reminders for due dates</li>
                    <li>File Form 1040-ES with first payment if mailing checks</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resources */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">Quarterly Tax Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button variant="outline" className="justify-start bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white" asChild>
              <a href="https://www.irs.gov/pub/irs-pdf/f1040es.pdf" target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4 mr-2" />
                Download Form 1040-ES
              </a>
            </Button>
            <Button variant="outline" className="justify-start bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white" asChild>
              <a href="https://www.irs.gov/payments" target="_blank" rel="noopener noreferrer">
                <DollarSign className="h-4 w-4 mr-2" />
                Make Payment Online
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}