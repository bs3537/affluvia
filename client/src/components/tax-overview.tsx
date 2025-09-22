import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp, DollarSign, Calculator, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";

interface TaxOverviewData {
  grossHouseholdIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  projectedFederalTax: number;
  projectedStateTax: number;
  projectedTotalTax: number;
  currentTaxYear: number;
  isFromTaxReturn?: boolean;
}

export function TaxOverview() {
  const { user } = useAuth();
  const { data: taxOverview, isLoading, error } = useQuery<TaxOverviewData>({
    queryKey: ["taxOverview", user?.id],
    queryFn: async (): Promise<TaxOverviewData> => {
      const response = await fetch("/api/tax-overview", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch tax overview");
      }
      return response.json();
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    return `${rate.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-300" />
        <span className="ml-2 text-gray-300">Loading tax overview...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="bg-red-500/10 border-red-500/20">
        <Info className="h-4 w-4 text-red-400" />
        <AlertDescription className="text-gray-300">
          Complete your intake form to see your tax overview. We need your income and deduction information to calculate your effective tax rate.
        </AlertDescription>
      </Alert>
    );
  }

  if (!taxOverview) {
    return (
      <Alert className="bg-blue-500/10 border-blue-500/20">
        <Info className="h-4 w-4 text-blue-300" />
        <AlertDescription className="text-gray-300">
          Complete your intake form to see your personalized tax overview with effective tax rate calculations.
        </AlertDescription>
      </Alert>
    );
  }

  const uiCurrentYear = new Date().getFullYear();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-700/30 border-gray-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-400" />
              <span className="text-sm font-medium text-gray-300">Gross Income</span>
            </div>
            <div className="text-xl font-bold text-white">
              {formatCurrency(taxOverview.grossHouseholdIncome)}
            </div>
            <p className="text-xs text-gray-400 mt-1">Household total</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-700/30 border-gray-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-gray-300">Taxable Income</span>
            </div>
            <div className="text-xl font-bold text-white">
              {formatCurrency(taxOverview.taxableIncome)}
            </div>
            <p className="text-xs text-gray-400 mt-1">After deductions</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-700/30 border-gray-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-gray-300">Effective Rate</span>
            </div>
            <div className="text-xl font-bold text-white">
              {formatPercentage(taxOverview.effectiveTaxRate)}
            </div>
            <p className="text-xs text-gray-400 mt-1">Total tax / Income</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-700/30 border-gray-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium text-gray-300">Projected Tax</span>
            </div>
            <div className="text-xl font-bold text-white">
              {formatCurrency(taxOverview.projectedTotalTax)}
            </div>
            <p className="text-xs text-gray-400 mt-1">{uiCurrentYear} estimate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-700/30 border-gray-600">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Tax Breakdown</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Federal Tax:</span>
                <span className="text-sm font-medium text-white">
                  {formatCurrency(taxOverview.projectedFederalTax)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">State Tax:</span>
                <span className="text-sm font-medium text-white">
                  {formatCurrency(taxOverview.projectedStateTax)}
                </span>
              </div>
              <div className="border-t border-gray-600 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">Total:</span>
                  <span className="text-sm font-bold text-white">
                    {formatCurrency(taxOverview.projectedTotalTax)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-700/30 border-gray-600">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Tax Rates</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Effective Tax Rate:</span>
                <span className="text-sm font-medium text-white">
                  {formatPercentage(taxOverview.effectiveTaxRate)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Marginal Tax Rate:</span>
                <span className="text-sm font-medium text-white">
                  {formatPercentage(taxOverview.marginalTaxRate)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Total Deductions:</span>
                <span className="text-sm font-medium text-white">
                  {formatCurrency(taxOverview.totalDeductions)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert className="bg-blue-500/10 border-blue-500/20">
        <Info className="h-4 w-4 text-blue-300" />
        <AlertDescription className="text-gray-300 text-sm">
          {taxOverview.isFromTaxReturn ? (
            <>
              <strong>Tax Year {taxOverview.currentTaxYear} Actual Data:</strong> These calculations are based on the actual data extracted from your uploaded tax return, providing the most accurate view of your tax situation.
            </>
          ) : (
            <>
              <strong>Tax Year {taxOverview.currentTaxYear} Projection:</strong> These calculations are based on your income and deduction information from the intake form, using current IRS tax brackets. Upload your tax return for more accurate analysis.
            </>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
