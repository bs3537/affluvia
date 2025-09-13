/**
 * Capital Market Assumptions (CMA) loader
 * Provides versioned expected returns, volatilities, and correlation matrices.
 */

export interface AssetParams {
  expectedReturnCAGR: number; // Geometric (CAGR)
  volatility: number;         // Annualized stddev
}

export interface CMADefinition {
  version: string;
  assets: {
    usStocks: AssetParams;
    intlStocks: AssetParams;
    bonds: AssetParams;
    reits: AssetParams;
    cash: AssetParams;
  };
  correlations: {
    usStocks: { usStocks: number; intlStocks: number; bonds: number; reits: number; cash: number };
    intlStocks: { usStocks: number; intlStocks: number; bonds: number; reits: number; cash: number };
    bonds: { usStocks: number; intlStocks: number; bonds: number; reits: number; cash: number };
    reits: { usStocks: number; intlStocks: number; bonds: number; reits: number; cash: number };
    cash: { usStocks: number; intlStocks: number; bonds: number; reits: number; cash: number };
  };
}

let activeCMA: CMADefinition | null = null;

export function setActiveCMA(cma: CMADefinition) {
  activeCMA = cma;
}

export function getActiveCMA(): CMADefinition | null {
  return activeCMA;
}

export async function loadCMA(version?: string): Promise<CMADefinition | null> {
  const v = version || process.env.CMA_VERSION || '2025-US';
  try {
    // Dynamic import ensures tree-shaking works and avoids bundling unused CMA files
    const mod = await import(`../cma/${v}.json`, { assert: { type: 'json' } } as any);
    const cma: CMADefinition = (mod.default || mod) as CMADefinition;
    activeCMA = cma;
    return cma;
  } catch (e) {
    // Fallback if CMA not found
    return null;
  }
}

