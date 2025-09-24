import type { Express, Request, Response } from 'express';
import { getDashboardSnapshot, getModelVersion, computeScenarioHash } from '../services/dashboard-snapshot';
import crypto from 'crypto';
import { storage } from '../storage';

export function setupDashboardSnapshotRoutes(app: Express) {
  app.get('/api/dashboard-snapshot', async (req: Request, res: Response, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const actingAsClientId = (req.session as any)?.actingAsClientId as number | undefined;
      const userId = actingAsClientId || req.user!.id;

      const bypass = req.query.refresh === 'true';
      const profile = await storage.getFinancialProfile(userId);
      const currentHash = computeScenarioHash(profile);
      // Include insights updated-at in ETag so client refreshes when insights regenerate
      const di = await storage.getDashboardInsights(userId);
      // Include fallback timestamp from financial_profiles.central_insights to keep ETag sensitive to persisted insights
      const ci: any = (profile as any)?.centralInsights || null;
      const ciTs = (ci && (ci.updatedAt || ci.lastUpdated)) ? (ci.updatedAt || ci.lastUpdated).toString() : '';
      const insightsUpdatedAt = (((di as any)?.updatedAt || (di as any)?.createdAt || '') as any)?.toString() || ciTs;
      const etagRaw = `${currentHash}|${insightsUpdatedAt}|${getModelVersion()}`;
      const etagHash = crypto.createHash('sha256').update(etagRaw).digest('hex').slice(0, 16);
      const etag = `W/"${etagHash}"`;
      const ifNoneMatch = req.headers['if-none-match'];
      if (!bypass && ifNoneMatch && ifNoneMatch === etag) {
        res.status(304).end();
        return;
      }

      const snapshot = await getDashboardSnapshot(userId, { bypassCache: !!bypass });

      res.set({
        ETag: etag,
        'Cache-Control': 'private, max-age=0, stale-while-revalidate=30',
        Vary: 'Authorization',
        'Affluvia-Model-Version': getModelVersion(),
        'Affluvia-Scenario-Hash': currentHash,
        'Affluvia-Insights-Updated': insightsUpdatedAt,
      });

      res.json(snapshot);
    } catch (err) {
      next(err);
    }
  });
}
