interface CashFlowRequest {
  planId?: string;
  scenarioId: string;
  percentile: number;
}

interface CashFlowResponse {
  year: number;
  inflows: {
    grossIncome: number;
    portfolioWithdrawals: number;
    socialSecurity: number;
  };
  outflows: {
    fixed: number;
    discretionary: number;
    insurance: number;
    goalOutflows: number;
    taxesTotal: number;
  };
  effectiveTaxRate: number;
  bracketThresholds: Record<string, number>;
  taxableIncome: number;
  marginalRate: number;
  flags: {
    rothConversionSuggested?: boolean;
    qcdSuggested?: boolean;
    dafBunchingSuggested?: boolean;
  };
}

class CashFlowMapService {
  private cache: Map<string, { data: CashFlowResponse[]; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate cache key from request parameters
   */
  private getCacheKey(request: CashFlowRequest): string {
    return `${request.planId || 'default'}-${request.scenarioId}-${request.percentile}`;
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTimeout;
  }

  /**
   * Fetch cash flow data with caching
   */
  async getCashFlowData(request: CashFlowRequest): Promise<CashFlowResponse[]> {
    const cacheKey = this.getCacheKey(request);
    const cached = this.cache.get(cacheKey);

    // Return cached data if valid
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
      // In production, this would call the actual API
      const response = await fetch(`/api/v2/rpc/cashflow-map?planId=${request.planId || ''}&scenarioId=${request.scenarioId}&percentile=${request.percentile}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Cache the successful response
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      console.error('Error fetching cash flow data:', error);
      
      // If we have stale cached data, return it as fallback
      if (cached) {
        console.warn('Returning stale cached data due to error');
        return cached.data;
      }

      throw error;
    }
  }

  /**
   * Clear cache for specific plan or all cache
   */
  clearCache(planId?: string): void {
    if (planId) {
      // Clear all entries for specific plan
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.startsWith(planId)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  /**
   * Prefetch data for common scenarios
   */
  async prefetchScenarios(planId: string): Promise<void> {
    const scenarios = ['base', 'bear5yr', 'rothConversion', 'delaySS'];
    const percentiles = [10, 50, 90];

    const prefetchPromises = scenarios.flatMap(scenarioId =>
      percentiles.map(percentile =>
        this.getCashFlowData({ planId, scenarioId, percentile })
          .catch(error => console.error(`Prefetch failed for ${scenarioId}-${percentile}:`, error))
      )
    );

    await Promise.all(prefetchPromises);
  }

  /**
   * Calculate optimization suggestions based on cash flow data
   */
  analyzeOptimizationOpportunities(data: CashFlowResponse[]): {
    rothConversionYears: number[];
    qcdYears: number[];
    dafBunchingYears: number[];
    insights: string[];
  } {
    const rothConversionYears: number[] = [];
    const qcdYears: number[] = [];
    const dafBunchingYears: number[] = [];
    const insights: string[] = [];

    data.forEach((yearData, index) => {
      // Roth conversion opportunities
      if (yearData.flags.rothConversionSuggested) {
        rothConversionYears.push(yearData.year);
      }

      // QCD opportunities
      if (yearData.flags.qcdSuggested) {
        qcdYears.push(yearData.year);
      }

      // DAF bunching opportunities
      if (yearData.flags.dafBunchingSuggested) {
        dafBunchingYears.push(yearData.year);
      }

      // Tax bracket jump analysis
      if (index > 0) {
        const prevYear = data[index - 1];
        const marginalRateJump = yearData.marginalRate - prevYear.marginalRate;
        if (marginalRateJump >= 5) {
          insights.push(
            `Tax rate jumps ${marginalRateJump}% in ${yearData.year}. Consider income smoothing strategies.`
          );
        }
      }

      // Low tax year opportunities
      if (yearData.effectiveTaxRate < 15 && yearData.taxableIncome > 0) {
        insights.push(
          `${yearData.year} has a low ${yearData.effectiveTaxRate.toFixed(1)}% tax rate. Good year for realizing gains or Roth conversions.`
        );
      }
    });

    // Summary insights
    if (rothConversionYears.length > 0) {
      insights.push(
        `Consider Roth conversions in ${rothConversionYears.length} years when tax rates are favorable.`
      );
    }

    const avgTaxRate = data.reduce((sum, d) => sum + d.effectiveTaxRate, 0) / data.length;
    insights.push(`Your average effective tax rate is ${avgTaxRate.toFixed(1)}% over the projection period.`);

    return {
      rothConversionYears,
      qcdYears,
      dafBunchingYears,
      insights,
    };
  }

  /**
   * Export data to CSV format
   */
  exportToCSV(data: CashFlowResponse[]): string {
    const headers = [
      'Year',
      'Gross Income',
      'Portfolio Withdrawals',
      'Social Security',
      'Fixed Expenses',
      'Discretionary Expenses',
      'Insurance',
      'Goal Outflows',
      'Taxes Total',
      'Effective Tax Rate (%)',
      'Taxable Income',
      'Marginal Rate (%)',
    ];

    const rows = data.map(year => [
      year.year,
      year.inflows.grossIncome,
      year.inflows.portfolioWithdrawals,
      year.inflows.socialSecurity,
      year.outflows.fixed,
      year.outflows.discretionary,
      year.outflows.insurance,
      year.outflows.goalOutflows,
      year.outflows.taxesTotal,
      year.effectiveTaxRate.toFixed(2),
      year.taxableIncome,
      year.marginalRate,
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

// Export singleton instance
export const cashFlowMapService = new CashFlowMapService();

// Export types
export type { CashFlowRequest, CashFlowResponse };