import type { Express, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { storage } from '../storage';

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.sendStatus(401);
  next();
}

const DEFAULT_WIDGETS = [
  'financial_health_score',
  'net_worth',
  'monthly_cash_flow',
  'emergency_readiness_score_new',
  'optimized_retirement_confidence',
  'insurance_adequacy_score',
  'optimized_portfolio_projection',
  'ending_portfolio_value_increase',
  'retirement_stress_test',
  'social_security_optimization_impact',
  'roth_conversion_impact',
];

const WIDGET_ORDER = [...DEFAULT_WIDGETS];

const LEGACY_WIDGET_MAP: Record<string, string | null> = {
  retirement_confidence_gauge: 'optimized_retirement_confidence',
  retirement_confidence_score: 'optimized_retirement_confidence',
  net_worth_projection_optimized: 'optimized_portfolio_projection',
  net_worth_projection: 'optimized_portfolio_projection',
  increase_in_portfolio_value: 'ending_portfolio_value_increase',
  optimization_impact_on_balance: 'ending_portfolio_value_increase',
  optimization_impact_ending_portfolio: 'ending_portfolio_value_increase',
  emergency_readiness_score: 'emergency_readiness_score_new',
};

const normalizeWidgetKey = (key: string | null | undefined): string | null => {
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(LEGACY_WIDGET_MAP, key)) {
    return LEGACY_WIDGET_MAP[key] ?? null;
  }
  return key;
};

const sanitizeWidgetLayout = (layout?: string[] | null): string[] => {
  const source = Array.isArray(layout) && layout.length ? layout : WIDGET_ORDER;
  const canonical: string[] = [];
  const seenCanonical = new Set<string>();
  const extras: string[] = [];
  const seenExtras = new Set<string>();

  for (const rawKey of source) {
    const normalized = normalizeWidgetKey(rawKey);
    if (!normalized) continue;
    if (WIDGET_ORDER.includes(normalized)) {
      if (!seenCanonical.has(normalized)) {
        canonical.push(normalized);
        seenCanonical.add(normalized);
      }
    } else if (!seenExtras.has(normalized)) {
      extras.push(normalized);
      seenExtras.add(normalized);
    }
  }

  const ordered: string[] = [];
  const seen = new Set<string>();

  WIDGET_ORDER.forEach((key) => {
    if (canonical.includes(key) && !seen.has(key)) {
      ordered.push(key);
      seen.add(key);
    }
  });

  canonical.forEach((key) => {
    if (!seen.has(key)) {
      ordered.push(key);
      seen.add(key);
    }
  });

  extras.forEach((key) => {
    if (!seen.has(key)) {
      ordered.push(key);
      seen.add(key);
    }
  });

  return ordered;
};

function hash(value: any) {
  const json = JSON.stringify(value ?? null);
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16);
}

// Helper function to compute life goal funding percentage
function computeFundingPct(goal: any): number {
  const targetRaw = goal?.targetAmount ?? goal?.targetAmountToday ?? 0;
  const currentRaw = goal?.currentAmount ?? goal?.currentSavings ?? 0;
  const target = Number(targetRaw) || 0;
  let total = Number(currentRaw) || 0;

  // Prefer goal.metadata.fundingSources; fallback to goal.fundingSources
  const sources = (goal?.metadata?.fundingSources || goal?.fundingSources || []);
  if (Array.isArray(sources)) {
    const monthsToGoal = goal?.targetDate
      ? Math.max(0, Math.floor((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)))
      : 0;
    for (const s of sources) {
      const t = String(s?.type || '').toLowerCase();
      if (t === 'asset' || t === 'loan') total += Number(s?.amount || 0);
      else if (t === 'monthly_savings') total += Number(s?.monthlyAmount || 0) * monthsToGoal;
    }
  }
  if (goal?.fundingPercentage != null) return Number(goal.fundingPercentage);
  return target > 0 ? (total / target) * 100 : 0;
}

async function buildWidgetsSnapshot(userId: number, layout: string[]) {
  const layoutOrder = sanitizeWidgetLayout(layout);
  const profile = await storage.getFinancialProfile(userId);
  const calc = (profile as any)?.calculations || {};
  const base = {
    profileUpdatedAt: (profile as any)?.lastUpdated || null,
    keyTotals: {
      netWorth: calc.netWorth ?? null,
      monthlyCashFlow: calc.monthlyCashFlow ?? null,
      retirementScore: calc.retirementScore ?? (profile as any)?.retirementReadinessScore ?? null,
      insuranceAdequacyScore: (calc.insuranceAdequacy?.score ?? null),
      emergencyReadinessScore: calc.emergencyReadinessScoreCFP ?? (profile as any)?.emergencyReadinessScore ?? null,
    },
  };
  // Domain fingerprint: changes in intake, optimization vars, or plan data cause new snapshots
  const domainInputs = {
    updated: base.profileUpdatedAt,
    calcSubset: {
      healthScore: calc.healthScore,
      netWorth: calc.netWorth,
      monthlyCashFlow: calc.monthlyCashFlow,
      retirementScore: calc.retirementScore,
      insuranceAdequacyScore: calc.insuranceAdequacy?.score,
      emergencyReadinessScoreCFP: calc.emergencyReadinessScoreCFP,
      retirementStressTest: calc.retirementStressTest,
      netWorthProjectionOptimized: calc.netWorthProjectionOptimized,
    },
    optimizationVariables: (profile as any)?.optimizationVariables || null,
    retirementPlanningData: (profile as any)?.retirementPlanningData || null,
    monteCarloAt: (profile as any)?.monteCarloSimulation?.retirementSimulation?.calculatedAt || null,
  };
  const inputHash = hash(domainInputs);

  // Fetch all types of goals and compute progress
  const allGoalsProgress = [];
  
  // 1. Life goals (custom goals)
  const lifeGoals = await storage.getLifeGoals(userId).catch(() => []);
  lifeGoals.forEach((g: any) => {
    const pct = computeFundingPct(g);
    allGoalsProgress.push({
      id: g.id,
      name: g.goalName || g.description || g.goalType,
      pct,
      type: 'life_goal'
    });
  });
  
  // 2. Retirement goal from profile
  if (profile) {
    const retirementAge = (profile as any).desiredRetirementAge || (profile as any).retirementAge || 65;
    const currentAge = (profile as any).age || 30;
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);
    const retirementTarget = (profile as any).legacyGoal || (profile as any).retirementIncome || 0;
    const retirementAssets = ((profile as any).assets || [])
      .filter((a: any) => 
        String(a.type || '').toLowerCase().includes('401k') || 
        String(a.type || '').toLowerCase().includes('ira') || 
        String(a.type || '').toLowerCase().includes('retirement')
      )
      .reduce((sum: number, a: any) => sum + Number(a.value || 0), 0);
    
    if (retirementTarget > 0) {
      const retirementProgress = yearsToRetirement > 0 
        ? Math.min(100, (retirementAssets / (retirementTarget * 0.25)) * 100)
        : 0;
      
      allGoalsProgress.push({
        id: 'retirement',
        name: 'Retirement',
        pct: retirementProgress,
        type: 'retirement'
      });
    }
  }
  
  // 3. Education goals
  const educationGoals = await storage.getEducationGoals(userId).catch(() => []);
  educationGoals.forEach((g: any) => {
    const targetAmount = Number(g.totalCost || g.estimatedCost || 0);
    const currentAmount = Number(g.currentSavings || 0);
    const pct = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
    
    allGoalsProgress.push({
      id: `edu_${g.id}`,
      name: g.childName ? `${g.childName}'s Education` : 'Education',
      pct,
      type: 'education'
    });
  });
  
  // Sort by progress and take top 6
  const lifeGoalsProgress = allGoalsProgress
    .sort((a: any, b: any) => b.pct - a.pct)
    .slice(0, 6);

  const dataByKey: Record<string, any> = {
    financial_health_score: { score: calc.healthScore ?? null },
    monthly_cash_flow: { amount: calc.monthlyCashFlow ?? null },
    net_worth: { value: calc.netWorth ?? null },
    retirement_confidence_gauge: { score: base.keyTotals.retirementScore },
    
    // New: Optimized Retirement Confidence Score from retirementPlanningData
    optimized_retirement_confidence: (() => {
      console.log('[REPORT-GEN] Extracting optimized retirement confidence...');
      const rp = (profile as any)?.retirementPlanningData || {};
      const optVars = (profile as any)?.optimizationVariables || {};

      const normalize = (value: any) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return null;
        return value > 1 ? value / 100 : value;
      };

      let optimizedScore = normalize(rp.optimizedScore);
      if (optimizedScore === null) {
        optimizedScore = normalize(optVars.optimizedRetirementSuccessProbability);
        if (optimizedScore === null) optimizedScore = normalize(optVars.optimizedScore?.probabilityOfSuccess);
      }

      let baselineScore = normalize(rp.baselineScore);
      if (baselineScore === null) {
        baselineScore = normalize(optVars.baselineSuccessProbability);
        if (baselineScore === null) baselineScore = normalize(optVars.optimizedScore?.sensitivityAnalysis?.baselineSuccess);
      }

      let improvement = normalize(rp.improvement);
      if (improvement === null) {
        improvement = normalize(optVars.optimizedScore?.sensitivityAnalysis?.absoluteChange);
        if (improvement === null && optimizedScore !== null && baselineScore !== null) {
          improvement = optimizedScore - baselineScore;
        }
      }

      console.log('[REPORT-GEN] Optimized score data:', {
        optimizedScore,
        baselineScore,
        improvement
      });

      return {
        optimizedScore,
        baselineScore,
        improvement
      };
    })(),
    
    // New: Ending portfolio value increase from optimization impact
    ending_portfolio_value_increase: (() => {
      console.log('[REPORT-GEN] Extracting ending portfolio value increase...');
      const optimizationVars = (profile as any)?.optimizationVariables || {};
      const mcWithdrawalsData = optimizationVars.mcWithdrawalsData;
      console.log('[REPORT-GEN] MC withdrawals data:', {
        hasData: !!mcWithdrawalsData,
        hasBaselineData: !!mcWithdrawalsData?.baselineData?.length,
        hasOptimizedData: !!mcWithdrawalsData?.optimizedData?.length
      });
      
      if (!mcWithdrawalsData?.baselineData?.length || !mcWithdrawalsData?.optimizedData?.length) {
        console.log('[REPORT-GEN] No MC withdrawals data available for ending impact');
        return { endingPortfolioValueIncrease: null };
      }
      
      const lastBase = mcWithdrawalsData.baselineData[mcWithdrawalsData.baselineData.length - 1] || {};
      const lastOpt = mcWithdrawalsData.optimizedData[mcWithdrawalsData.optimizedData.length - 1] || {};
      
      const baseValue = lastBase.totalBalance ?? lastBase.portfolioValue ?? lastBase.totalPortfolioValue ?? 0;
      const optValue = lastOpt.totalBalance ?? lastOpt.portfolioValue ?? lastOpt.totalPortfolioValue ?? 0;
      const impact = optValue - baseValue;
      
      console.log('[REPORT-GEN] Calculated ending impact:', {
        baseValue,
        optValue,
        impact
      });
      
      return { endingPortfolioValueIncrease: impact };
    })(),
    
    optimization_impact_on_balance: { delta: (calc.optimizationImpact?.deltaBalance ?? null) },
    retirement_stress_test: { scenarios: calc.retirementStressTest ?? null },
    life_goals_progress: lifeGoalsProgress,
    insurance_adequacy_score: { score: base.keyTotals.insuranceAdequacyScore },
    emergency_readiness_score: { score: base.keyTotals.emergencyReadinessScore },
  };

  return layoutOrder.map((key) => ({ key, inputHash, data: dataByKey[key] ?? null, computedAt: new Date().toISOString() }));
}

export function setupReportRoutes(app: Express) {
  app.get('/api/report/branding', requireAuth, async (req, res) => {
    const user = (req as any).user as any;
    const realUser = (req as any).realUser as any | undefined;

    let advisorId: number | null = null;
    if (realUser && realUser.role === 'advisor') {
      advisorId = realUser.id;
    } else if (user?.role === 'advisor') {
      advisorId = user.id;
    } else {
      advisorId = await storage.getPrimaryAdvisorForClient(user.id);
    }

    let branding = null;
    if (advisorId) {
      branding = await storage.getWhiteLabelProfile(advisorId);
    }

    if (!branding) {
      return res.json({
        firmName: 'Affluvia',
        logoUrl: null,
        address: null,
        phone: null,
        email: null,
        defaultDisclaimer: null,
      });
    }

    res.json(branding);
  });

  // Get saved layout
  app.get('/api/report/layout', requireAuth, async (req, res) => {
    const userId = (req as any).user.id as number;
    const row = await storage.getReportLayout(userId);
    if (!row) return res.json({ layout: DEFAULT_WIDGETS, insightsSectionTitle: 'Insights', draftInsights: [] });
    const layout = sanitizeWidgetLayout((row.layout as any) || undefined);
    if (JSON.stringify(layout) !== JSON.stringify(row.layout)) {
      await storage.saveReportLayout(userId, { layout: layout as any, insightsSectionTitle: row.insightsSectionTitle || 'Insights' });
    }
    res.json({
      layout,
      insightsSectionTitle: row.insightsSectionTitle || 'Insights',
      draftInsights: (row.draftInsights as any) || [],
    });
  });

  // Save layout
  app.post('/api/report/layout', requireAuth, async (req, res) => {
    const userId = (req as any).user.id as number;
    const { layout, insightsSectionTitle } = req.body as { layout?: string[]; insightsSectionTitle?: string };
    const normalized = sanitizeWidgetLayout(layout);
    const saved = await storage.saveReportLayout(userId, { layout: normalized as any, insightsSectionTitle: insightsSectionTitle || 'Insights' });
    res.json({ layout: sanitizeWidgetLayout(saved.layout as any), insightsSectionTitle: saved.insightsSectionTitle });
  });

  // Save draft insights (auto-save while editing)
  app.post('/api/report/draft-insights', requireAuth, async (req, res) => {
    const userId = (req as any).user.id as number;
    const { insights } = req.body as { insights?: Array<{ id?: string; text: string; order: number; isCustom?: boolean }> };
    try {
      await storage.saveDraftInsights(userId, insights || []);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to save draft insights:', error);
      res.status(500).json({ error: 'Failed to save draft insights' });
    }
  });

  // Create (or refresh) snapshot
  app.post('/api/report/snapshot', requireAuth, async (req, res) => {
    const realUser = (req as any).realUser as any | undefined;
    const user = (req as any).user as any;
    const advisorId = realUser && realUser.role === 'advisor' ? realUser.id : null;

    const { layout, insights, insightsTitle, disclaimerText, force, forceRefresh } = req.body as {
      layout: string[];
      insights: Array<{ id?: string; text: string; order: number; isCustom?: boolean }>;
      insightsTitle?: string;
      disclaimerText?: string;
      force?: boolean;
      forceRefresh?: boolean;
    };

    const normalizedLayout = sanitizeWidgetLayout(layout);
    const widgets = await buildWidgetsSnapshot(user.id, normalizedLayout);

    // Try to reuse last snapshot if inputs and content have not changed
    const latest = await storage.getLatestReportSnapshot(user.id);
    const incomingInsights = (insights || []).map((i, idx) => ({ ...i, order: idx, text: (i.text || '').trim() }));
    const sameAsLatest = (() => {
      if (!latest) return false;
      try {
        const lastWidgets: any[] = (latest.widgets as any[]) || [];
        const lastInsights: any[] = (latest.insights as any[]) || [];
        const lastLayout: any[] = (latest.layout as any[]) || [];
        const sanitizedLastLayout = sanitizeWidgetLayout(lastLayout as any);
        const lastHash = lastWidgets[0]?.inputHash;
        const currentHash = widgets[0]?.inputHash;
        const layoutEqual = JSON.stringify(sanitizedLastLayout) === JSON.stringify(normalizedLayout);
        const insightsEqual = JSON.stringify(lastInsights.map(i => ({ text: (i.text || '').trim() }))) === JSON.stringify(incomingInsights.map(i => ({ text: (i.text || '').trim() })));
        const disclaimerEqual = (latest.disclaimerText || '') === (disclaimerText || '');
        return Boolean(lastHash && currentHash && lastHash === currentHash && layoutEqual && insightsEqual && disclaimerEqual);
      } catch {
        return false;
      }
    })();

    if (!force && !forceRefresh && sameAsLatest) {
      return res.json({ id: latest!.id, reused: true });
    }

    const snapshot = await storage.createReportSnapshot(user.id, {
      advisorId: advisorId ?? undefined,
      layout: normalizedLayout as any,
      widgets: widgets as any,
      insights: incomingInsights,
      insightsTitle: insightsTitle || 'Insights',
      disclaimerText: disclaimerText || null,
      disclaimerVersion: '1.0',
      themeVersion: 'report-light-1',
    });
    res.json({ id: snapshot.id });
  });

  // Light-theme HTML print view
  app.get('/report/print/:snapshotId', requireAuth, async (req, res) => {
    const user = (req as any).user as any;
    const realUser = (req as any).realUser as any | undefined;
    const snapshotId = parseInt(req.params.snapshotId, 10);
    if (!Number.isFinite(snapshotId)) return res.status(400).send('Invalid snapshot id');

    const snapshot = await storage.getReportSnapshot(user.id, snapshotId);
    if (!snapshot) return res.status(404).send('Snapshot not found');

    const profile = await storage.getFinancialProfile(user.id);
    const fullName = (user.fullName && user.fullName.trim().length > 0)
      ? user.fullName
      : `${(profile as any)?.firstName || ''} ${(profile as any)?.lastName || ''}`.trim();

    // Branding: advisor if present, otherwise default Affluvia
    let branding: any = { firmName: 'Affluvia', logoUrl: null, address: null, phone: null, email: null };
    if (realUser && realUser.role === 'advisor') {
      const wl = await storage.getWhiteLabelProfile(realUser.id);
      if (wl) branding = wl;
    }

    const insightsTitle = snapshot.insightsTitle || 'Insights';
    const insights: Array<{ text: string; order: number }> = (snapshot.insights as any[])?.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const layout: string[] = (snapshot.layout as any[]) || [];
    const widgets: Array<{ key: string; data: any }> = (snapshot.widgets as any[]) || [];

    const pageStyle = `
      <style>
        @page { size: A4; margin: 18mm 14mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: white; color: #111; }
        .header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .header .logo { height: 42px; width: auto; }
        .header .firm { font-weight: 700; font-size: 18px; }
        .header .meta { color: #555; font-size: 12px; }
        .divider { height: 1px; background: #e5e7eb; margin: 10px 0 12px; }
        .h1 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; min-height: 148px; }
        .title { font-weight: 600; margin-bottom: 4px; }
        .value { font-size: 26px; font-weight: 700; color: #111; line-height: 1.2; }
        .small { font-size: 11px; color: #666; line-height: 1.25; }
        .insights { margin-top: 18px; }
        .insight { margin-bottom: 10px; }
        .footer { position: fixed; bottom: 10mm; left: 14mm; right: 14mm; color: #666; font-size: 10px; display: flex; justify-content: space-between; }
        .footer .pageNumber::after { content: counter(page) " of " counter(pages); }
        .page-break { page-break-before: always; }
        /* Gauges and progress */
        .gauge { width: 100%; height: 0; padding-bottom: 50%; position: relative; }
        .gauge .arc { position: absolute; inset: 0; border-radius: 50% 50% 0 0 / 100% 100% 0 0; overflow: hidden; }
        .gauge .arc::before { content: ''; position: absolute; inset: 0; background: conic-gradient(#22c55e calc(var(--pct) * 1%), #e5e7eb 0); transform: rotate(-90deg); }
        .gauge .needle { position: absolute; left: 50%; bottom: 0; width: 2px; height: 100%; background: #111; transform-origin: bottom center; transform: rotate(calc(-90deg + (var(--pct) * 180deg))); }
        .bar { height: 8px; background: #f3f4f6; border-radius: 6px; overflow: hidden; }
        .bar > div { height: 100%; background: #111; }
        .chip { display: inline-block; padding: 2px 8px; border-radius: 9999px; border: 1px solid #e5e7eb; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; font-size: 11px; padding: 4px 0; }
        th { color: #555; }
        .muted { color: #777; }
      </style>
    `;

    function widgetTitle(key: string) {
      return (key || '').replace(/_/g, ' ');
    }

    function renderWidget(key: string, data: any) {
      switch (key) {
        case 'financial_health_score': {
          const s = Number(data?.score ?? 0);
          return `
            <div class="value">${isFinite(s) ? s : '-'}</div>
            <div class="bar"><div style="width:${Math.max(0, Math.min(100, s))}%; background:#22c55e"></div></div>
            <div class="small muted">Overall financial wellness</div>
          `;
        }
        case 'monthly_cash_flow': {
          const v = Number(data?.amount ?? 0);
          const color = v >= 0 ? '#16a34a' : '#dc2626';
          return `
            <div class="value" style="color:${color}">${isFinite(v) ? (v>=0?'+':'') + '$' + Math.abs(v).toLocaleString() : '-'}</div>
            <div class="small muted">After-tax monthly surplus/deficit</div>
          `;
        }
        case 'net_worth': {
          const v = Number(data?.value ?? 0);
          return `
            <div class="value">${isFinite(v) ? '$' + v.toLocaleString() : '-'}</div>
            <div class="small muted">Assets minus liabilities</div>
          `;
        }
        case 'retirement_confidence_gauge': {
          const pct = Math.max(0, Math.min(100, Number(data?.score ?? 0)))/100;
          return `
            <div class="gauge" style="--pct:${pct}">
              <div class="arc"></div>
              <div class="needle" style="--pct:${pct}"></div>
            </div>
            <div class="small" style="text-align:center;margin-top:6px;">${Math.round(pct*100)}% confidence</div>
          `;
        }
        case 'optimization_impact_on_balance': {
          const d = Number(data?.delta ?? 0);
          const sign = d>=0?'+':'-';
          const color = d>=0? '#16a34a' : '#dc2626';
          return `<span class="chip" style="border-color:${color}; color:${color}">${sign}$${Math.abs(d).toLocaleString()}</span>
            <div class="small muted" style="margin-top:6px;">Projected change from optimization</div>`;
        }
        case 'retirement_stress_test': {
          const rows: Array<{ name: string; score?: number }> = (data?.scenarios || []).slice(0,4);
          if (!rows.length) return `<div class="small muted">No stress test data</div>`;
          const body = rows.map(r => `<tr><td>${r.name || '-'}</td><td>${r.score!=null? r.score + '%' : '-'}</td></tr>`).join('');
          return `<table><thead><tr><th>Scenario</th><th>Confidence</th></tr></thead><tbody>${body}</tbody></table>`;
        }
        case 'life_goals_progress': {
          const items: Array<{ name: string; pct: number }> = Array.isArray(data) ? data : [];
          const rows = items.length
            ? items.map((it) => {
                const pct = Number(it.pct || 0);
                const clamped = Math.max(0, Math.min(100, pct));
                return `
                  <div style="display:flex; align-items:center; gap:8px; margin:6px 0;">
                    <div class="small" style="flex:0 0 100px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${it.name || 'Goal'}</div>
                    <div class="bar" style="flex:1; background:#f3f4f6;">
                      <div style="width:${clamped}%; background:#111; height:8px;"></div>
                    </div>
                    <div class="small" style="width:48px; text-align:right;">${Math.round(pct)}%</div>
                  </div>
                `;
              }).join('')
            : '<div class="small muted">No life goals available</div>';
          return rows;
        }
        case 'optimized_retirement_confidence': {
          const optimized = Number(data?.optimizedScore ?? 0);
          const baseline = Number(data?.baselineScore ?? 0);
          const improvement = Number(data?.improvement ?? 0);
          const optimizedValue = Math.round(optimized * 100);
          const baselineValue = Math.round(baseline * 100);
          const improvementValue = Math.round(improvement * 100);
          
          return `
            <div class="value">${optimizedValue}</div>
            <div class="bar"><div style="width:${optimizedValue}%; background:linear-gradient(90deg, #10b981, #16a34a);"></div></div>
            <div class="small muted">Optimized retirement confidence score</div>
            ${baseline > 0 ? `<div class="small" style="color:#10b981; margin-top:4px;">+${improvementValue} from baseline (${baselineValue})</div>` : ''}
          `;
        }
        case 'ending_portfolio_value_increase': {
          // Uses cached impactOnPortfolioBalance data
          const projectionData = Array.isArray(data?.projectionData) ? data.projectionData : [];
          const comparison = data?.comparison || null;
          
          // Get the final difference from comparison or calculate from last projection
          let finalDifference = 0;
          let percentageImprovement = 0;
          
          if (comparison?.finalDifference !== undefined) {
            finalDifference = comparison.finalDifference;
            percentageImprovement = comparison.percentageImprovement || 0;
          } else if (projectionData.length > 0) {
            const lastItem = projectionData[projectionData.length - 1];
            finalDifference = (lastItem?.proposed || lastItem?.optimized || 0) - (lastItem?.current || lastItem?.baseline || 0);
            if (lastItem?.current || lastItem?.baseline) {
              percentageImprovement = (finalDifference / (lastItem.current || lastItem.baseline)) * 100;
            }
          }
          
          if (!finalDifference) {
            return `
              <div class="metric-value muted">No data</div>
              <div class="small muted">Lock optimization variables to calculate</div>
            `;
          }
          
          const sign = finalDifference >= 0 ? '+' : '-';
          const color = finalDifference >= 0 ? '#10b981' : '#ef4444';
          
          return `
            <div class="metric-value" style="color:${color}">
              ${sign}$${Math.abs(finalDifference).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <div class="small" style="color:${color}">${percentageImprovement.toFixed(1)}% increase</div>
            <div class="small muted">Portfolio value at longevity age</div>
          `;
        }
        case 'insurance_adequacy_score': {
          const s = Number(data?.score ?? 0);
          return `
            <div class="value">${isFinite(s) ? s : '-'}</div>
            <div class="bar"><div style="width:${Math.max(0, Math.min(100, s))}%;"></div></div>
            <div class="small muted">Coverage adequacy</div>
          `;
        }
        case 'emergency_readiness_score': {
          const s = Number(data?.score ?? 0);
          return `
            <div class="value">${isFinite(s) ? s : '-'}</div>
            <div class="bar"><div style="width:${Math.max(0, Math.min(100, s))}%;"></div></div>
            <div class="small muted">Emergency fund readiness</div>
          `;
        }
        default:
          return `<div class="small">Prepared snapshot available</div>`;
      }
    }

    const widgetCardsHtml = layout.map((key) => {
      const data = widgets.find((w) => w.key === key)?.data;
      return `<div class="card"><div class="title">${widgetTitle(key)}</div>${renderWidget(key, data)}</div>`;
    }).join('');

    const page1 = `
      <div class="header">
        ${branding?.logoUrl ? `<img class="logo" src="${branding.logoUrl}" />` : ''}
        <div>
          <div class="firm">${branding?.firmName || 'Affluvia'}</div>
          <div class="meta">Prepared for: ${fullName || 'Client'} • ${new Date().toLocaleDateString()}</div>
          ${branding?.address || branding?.phone || branding?.email ? `<div class="meta">${branding.address || ''} ${branding.phone ? ' • '+branding.phone : ''} ${branding.email ? ' • '+branding.email : ''}</div>` : ''}
        </div>
      </div>
      <div class="divider"></div>
      <div class="grid">${widgetCardsHtml}</div>
    `;

    const page2 = `
      <div class="page-break"></div>
      <div class="h1">${insightsTitle}</div>
      <div class="insights">
        ${insights.map((i) => `<div class="insight">• ${i.text}</div>`).join('')}
      </div>
      ${snapshot.disclaimerText ? `<div style="margin-top:16px; border-top:1px solid #e5e7eb; padding-top:10px; white-space:pre-wrap;" class="small">${snapshot.disclaimerText}</div>` : ''}
    `;

    const shouldAutoPrint = String(req.query.autoPrint || '') === '1';
    const autoPrintScript = shouldAutoPrint ? `<script>window.onload = () => setTimeout(()=>window.print(), 200);</script>` : '';
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8">${pageStyle}</head><body>${page1}${page2}<div class="footer"><div>${branding?.firmName || 'Affluvia'}</div><div>Page <span class="pageNumber"></span></div></div>${autoPrintScript}</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(doc);
  });

  // Generate PDF from print route using Playwright Chromium (if available)
  app.get('/api/report/docx/:snapshotId', requireAuth, async (req, res) => {
    try {
      console.log('[DOCX-GENERATION] Starting Word document generation for snapshot:', req.params.snapshotId);
      
      const snapshotId = parseInt(req.params.snapshotId, 10);
      if (!Number.isFinite(snapshotId)) {
        console.log('[DOCX-GENERATION] Invalid snapshot ID:', req.params.snapshotId);
        return res.status(400).json({ error: 'invalid_id' });
      }
      
      const snapshot = await storage.getReportSnapshot(req.user!.id, snapshotId);
      if (!snapshot) {
        console.log('[DOCX-GENERATION] Snapshot not found:', snapshotId);
        return res.status(404).json({ error: 'snapshot_not_found' });
      }
      
      console.log('[DOCX-GENERATION] Snapshot found, generating document...');
      
      // Generate Word document using docx library
      const { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = await import('docx');
      
      // Parse snapshot data
      const widgets = Array.isArray(snapshot.widgets) ? snapshot.widgets : [];
      const insights = Array.isArray(snapshot.insights) ? snapshot.insights : [];
      const layout = Array.isArray(snapshot.layout) ? snapshot.layout : [];
      
      // Get user profile for branding
      const profile = await storage.getFinancialProfile(req.user!.id);
      const realUser = (req as any).realUser;
      const isAdvisor = realUser && realUser.role === 'advisor';
      
      // Get branding information
      let branding = null;
      if (isAdvisor) {
        // Get advisor's white label branding
        branding = await storage.getWhiteLabelProfile(realUser.id);
      }
      
      // Document sections
      const docSections = [];
      
      // HEADER SECTION with branding
      const firmName = branding?.firmName || 'Affluvia';
      const headerText = `${firmName}`;
      
      console.log('[DOCX-GENERATION] Adding header with firm name:', firmName);
      
      // Add firm name/logo header
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: headerText,
              bold: true,
              size: 32,
              color: "0066CC", // Blue color for firm name
            }),
          ],
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );
      
      // Add report title
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Financial Planning Report",
              size: 24,
              bold: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );
      
      // Add generation date
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Report Generated: ${new Date().toLocaleDateString()}`,
              size: 20,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        })
      );
      
      // Add branding details if available
      if (branding) {
        console.log('[DOCX-GENERATION] Adding branding details');
        
        // Add a section divider
        docSections.push(
          new Paragraph({
            children: [new TextRun({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", size: 16 })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 100 },
          })
        );
        
        if (branding.address) {
          docSections.push(
            new Paragraph({
              children: [new TextRun({ text: branding.address, size: 18 })],
              alignment: AlignmentType.CENTER,
            })
          );
        }
        if (branding.phone || branding.email) {
          const contactInfo = [branding.phone, branding.email].filter(Boolean).join(' • ');
          docSections.push(
            new Paragraph({
              children: [new TextRun({ text: contactInfo, size: 18 })],
              alignment: AlignmentType.CENTER,
            })
          );
        }
        
        // Add another section divider
        docSections.push(
          new Paragraph({
            children: [new TextRun({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", size: 16 })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 400 },
          })
        );
      } else {
        // Add Affluvia branding for individual users
        docSections.push(
          new Paragraph({
            children: [new TextRun({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", size: 16 })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 400 },
          })
        );
      }
      
      // WIDGETS SECTION
      docSections.push(
        new Paragraph({
          text: "Financial Overview",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );
      
      // Use snapshot data as single source of truth (same as what's displayed)
      console.log('[DOCX-GENERATION] Using snapshot widget data...');
      console.log('[DOCX-GENERATION] Snapshot layout:', layout);
      console.log('[DOCX-GENERATION] Snapshot widgets count:', widgets.length);
      
      // Build widget data map from snapshot
      const widgetDataMap = {};
      widgets.forEach((widget, index) => {
        if (widget && widget.key) {
          widgetDataMap[widget.key] = widget.data;
          console.log(`[DOCX-GENERATION] Mapped widget ${widget.key}:`, widget.data);
        }
      });
      
      // Helper function to format values
      const formatValue = (value, type, fallback = '—') => {
        if (value === null || value === undefined || value === '') return fallback;
        
        switch (type) {
          case 'percentage':
            return `${Math.round(Number(value) || 0)}%`;
          case 'currency':
            const num = Number(value) || 0;
            return `$${num.toLocaleString()}`;
          case 'number':
            return Number(value).toLocaleString();
          default:
            return String(value);
        }
      };
      
      // Widget display name and data extraction mapping
      const widgetConfig = {
        financial_health_score: {
          name: 'Financial Health Score',
          extract: (data) => formatValue(data?.score, 'percentage')
        },
        monthly_cash_flow: {
          name: 'Monthly Cash Flow',
          extract: (data) => formatValue(data?.amount, 'currency')
        },
        net_worth: {
          name: 'Net Worth',
          extract: (data) => formatValue(data?.value, 'currency')
        },
        retirement_confidence_gauge: {
          name: 'Retirement Confidence',
          extract: (data) => formatValue(data?.score, 'percentage')
        },
        optimized_retirement_confidence: {
          name: 'Optimized Retirement Confidence',
          extract: (data) => {
            if (data?.optimizedScore !== undefined) {
              const baseline = data.baselineScore || 0;
              const optimized = data.optimizedScore || 0;
              const improvement = data.improvement || 0;
              return `${formatValue(optimized, 'percentage')} (↑${formatValue(improvement, 'percentage')} from baseline)`;
            }
            return formatValue(data?.score, 'percentage');
          }
        },
        ending_portfolio_value_increase: {
          name: 'Ending Portfolio Value Increase',
          extract: (data) => {
            const delta = data?.endingPortfolioValueIncrease ?? data?.delta ?? data?.value;
            return formatValue(delta, 'currency');
          }
        },
        retirement_stress_test: {
          name: 'Retirement Stress Test',
          extract: (data) => {
            if (data?.scenarios && Array.isArray(data.scenarios)) {
              const scenarios = data.scenarios.slice(0, 3); // Top 3 scenarios
              return scenarios.map(s => `${s.name}: ${formatValue(s.successProbability, 'percentage')}`).join(', ');
            }
            return formatValue(data?.overallImpact ?? data?.impact, 'percentage');
          }
        },
        life_goals_progress: {
          name: 'Life Goals Progress',
          extract: (data) => {
            if (data?.goals && Array.isArray(data.goals)) {
              const goals = data.goals.slice(0, 3); // Top 3 goals
              return goals.map(g => `${g.name}: ${formatValue(g.pct, 'percentage')}`).join(', ');
            }
            return data?.goals?.length ? `${data.goals.length} goals tracked` : 'No goals';
          }
        },
        insurance_adequacy_score: {
          name: 'Insurance Adequacy Score',
          extract: (data) => formatValue(data?.score, 'percentage')
        },
        emergency_readiness_score: {
          name: 'Emergency Readiness Score',
          extract: (data) => formatValue(data?.score, 'percentage')
        }
      };
      
      // Add widgets data in table format using snapshot data
      const widgetRows = [];
      
      // Create rows for each widget type based on saved layout
      for (const widgetType of layout.slice(0, 9)) { // Limit to 9 widgets as specified
        const config = widgetConfig[widgetType];
        if (config) {
          const data = widgetDataMap[widgetType];
          const displayValue = config.extract(data);
          
          console.log(`[DOCX-GENERATION] Widget ${widgetType}: ${config.name} = ${displayValue}`);
          
          widgetRows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: config.name, bold: true })] })],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: displayValue })] })],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                }),
              ],
            })
          );
        } else {
          // Fallback for unknown widget types
          const displayName = widgetType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          console.log(`[DOCX-GENERATION] Unknown widget type: ${widgetType}, using fallback`);
          
          widgetRows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: displayName, bold: true })] })],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Data available' })] })],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                }),
              ],
            })
          );
        }
      }
      
      if (widgetRows.length > 0) {
        docSections.push(
          new Table({
            rows: widgetRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({ text: "", spacing: { after: 400 } })
        );
      }
      
      // INSIGHTS/RECOMMENDATIONS SECTION
      const insightsTitle = snapshot.insightsTitle || 'Insights & Recommendations';
      docSections.push(
        new Paragraph({
          text: insightsTitle,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );
      
      // Add insights content
      for (const insight of insights) {
        if (insight.text && insight.text.trim()) {
          docSections.push(
            new Paragraph({
              children: [new TextRun({ text: `• ${insight.text}` })],
              spacing: { after: 200 },
            })
          );
        }
      }
      
      // DISCLAIMER SECTION
      const disclaimerText = snapshot.disclaimerText || 
        branding?.defaultDisclaimer || 
        'This report is for informational purposes only and does not constitute personalized investment, tax, or legal advice. All projections are estimates and are not guarantees of future results. Assumptions, data inputs, and methodologies are subject to change. Please review with a qualified professional before making decisions.';
      
      docSections.push(
        new Paragraph({
          text: "Important Disclosures",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 600, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: disclaimerText, size: 18, italics: true })],
          spacing: { after: 200 },
        })
      );
      
      // Create document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: docSections,
          },
        ],
      });
      
      // Generate and send document
      const buffer = await Packer.toBuffer(doc);
      
      console.log('[DOCX-GENERATION] Document generated successfully, buffer size:', buffer.length);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="Affluvia_Report_${new Date().toISOString().slice(0,10)}.docx"`);
      res.send(buffer);
      
      console.log('[DOCX-GENERATION] Word document sent successfully');
      
    } catch (error) {
      console.error('[DOCX-GENERATION] Error generating Word document:', error);
      res.status(501).json({ error: 'docx_generation_failed' });
    }
  });

  app.get('/api/report/pdf/:snapshotId', requireAuth, async (req, res) => {
    try {
      const snapshotId = parseInt(req.params.snapshotId, 10);
      if (!Number.isFinite(snapshotId)) return res.status(400).json({ error: 'invalid_id' });
      const origin = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
      const url = `${origin}/report/print/${snapshotId}`;

      const { chromium } = await import('@playwright/test');
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ deviceScaleFactor: 2 });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '18mm', bottom: '18mm', left: '14mm', right: '14mm' } });
      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Affluvia_Report.pdf"');
      return res.send(pdf);
    } catch (err) {
      console.error('PDF generation error:', err);
      return res.status(501).json({ error: 'pdf_generation_unavailable' });
    }
  });
}
