/**
 * Capital Market Assumptions (CMA) loader
 * Provides versioned expected returns, volatilities, and correlation matrices.
 */
let activeCMA = null;
export function setActiveCMA(cma) {
    activeCMA = cma;
}
export function getActiveCMA() {
    return activeCMA;
}
export async function loadCMA(version) {
    const v = version || process.env.CMA_VERSION || '2025-US';
    try {
        // Dynamic import ensures tree-shaking works and avoids bundling unused CMA files
        const mod = await import(`../cma/${v}.json`, { assert: { type: 'json' } });
        const cma = (mod.default || mod);
        activeCMA = cma;
        return cma;
    }
    catch (e) {
        // Fallback if CMA not found
        return null;
    }
}
