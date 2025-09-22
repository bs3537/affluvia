import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { debts, debtPayoffPlans, debtScenarios, debtPayments, debtMilestones, debtAIInsights, financialProfiles } from "@shared/schema";
import { 
  debtSchema, 
  payoffPlanSchema,
  scenarioSchema,
  paymentSchema,
  idParamSchema,
  validateRequest,
  validateParams,
  validateDebtWithBusinessLogic
} from "../validation/debt-validation";
import { DebtCalculationService, type DebtInfo } from "../services/debt-calculation-service";
import { z } from "zod";

// Import enhanced debt calculation service functions
import { simulateHybridStrategy, calculatePayoffProjections } from "../services/debt-strategy-service";

import { debtStrategies } from "@db/schema";

export function setupDebtManagementRoutes(app: Express) {
  // ============================================
  // Debt Management API Endpoints
  // ============================================

  // Clear all debt management data for user
  app.delete("/api/debts/clear-all", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Delete all debt-related data for the user (without transaction since neon-http doesn't support it)
      await db.delete(debtPayments).where(eq(debtPayments.userId, req.user.id));
      await db.delete(debtMilestones).where(eq(debtMilestones.userId, req.user.id));
      await db.delete(debtAIInsights).where(eq(debtAIInsights.userId, req.user.id));
      await db.delete(debtScenarios).where(eq(debtScenarios.userId, req.user.id));
      await db.delete(debtPayoffPlans).where(eq(debtPayoffPlans.userId, req.user.id));
      await db.delete(debts).where(eq(debts.userId, req.user.id));

      res.json({ 
        success: true, 
        message: "All debt management data has been cleared successfully"
      });
    } catch (error) {
      console.error('Clear debts error:', error);
      next(error);
    }
  });

  // Sync debts from intake form and Plaid to debt management tables
  app.post("/api/debts/sync-from-intake", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Get user's financial profile
      const [profile] = await db
        .select()
        .from(financialProfiles)
        .where(eq(financialProfiles.userId, req.user.id))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ error: "Financial profile not found. Please complete intake form first." });
      }

      // Extract liabilities and mortgages from profile
      const liabilities = (profile.liabilities as any[]) || [];
      const primaryMortgage = profile.primaryResidence as any;
      const additionalProperties = (profile.additionalProperties as any[]) || [];

      console.log('Syncing debts for user:', req.user.id);
      console.log('Found liabilities:', liabilities.length);
      console.log('Primary mortgage:', primaryMortgage);
      console.log('Additional properties:', additionalProperties.length);
      
      // Get Plaid liability data if available
      let plaidLiabilities: any[] = [];
      try {
        const { db: dbImport } = await import("../db");
        const { plaidLiabilities: plaidLiabilitiesTable, plaidAccounts } = await import("@shared/schema");
        
        // Get all Plaid liabilities for the user
        const plaidLiabilityData = await dbImport
          .select({
            liability: plaidLiabilitiesTable,
            account: plaidAccounts
          })
          .from(plaidLiabilitiesTable)
          .leftJoin(plaidAccounts, eq(plaidLiabilitiesTable.plaidAccountId, plaidAccounts.id))
          .where(eq(plaidLiabilitiesTable.userId, req.user.id));
        
        console.log('Found Plaid liabilities:', plaidLiabilityData.length);
        
        // Convert Plaid liabilities to debt format
        for (const { liability, account } of plaidLiabilityData) {
          if (!liability) continue;
          
          const debtType = liability.liabilityType === 'credit_card' ? 'credit_card' :
                          liability.liabilityType === 'student_loan' ? 'student_loan' :
                          liability.liabilityType === 'mortgage' ? 'mortgage' :
                          liability.liabilityType === 'auto_loan' ? 'auto_loan' :
                          'personal_loan';
          
          plaidLiabilities.push({
            name: account?.accountName || `${debtType} (Plaid)`,
            type: debtType,
            balance: parseFloat(liability.currentBalance || '0'),
            originalBalance: parseFloat(liability.originalBalance || '0'),
            interestRate: parseFloat(liability.interestRate || liability.apr || '0'),
            minimumPayment: parseFloat(liability.minimumPayment || '0'),
            monthlyPayment: parseFloat(liability.minimumPayment || '0'),
            lender: account?.officialName || account?.accountName || 'Unknown',
            dataSource: 'plaid',
            plaidAccountId: account?.id,
            nextPaymentDueDate: liability.nextPaymentDueDate
          });
        }
      } catch (plaidError) {
        console.log('Could not fetch Plaid liabilities:', plaidError);
      }

      // Sync all debts (without transaction since neon-http doesn't support it)
      // First, DELETE all existing debts to prevent stacking
      await db.delete(debts).where(eq(debts.userId, req.user.id));

      const allSyncedDebts = [];
      
      // Merge Plaid liabilities with manual liabilities
      // Create a map to track which debts have been added (to avoid duplicates)
      const addedDebts = new Set<string>();

      // Map liability types from intake form to debt management types
      const typeMapping: Record<string, string> = {
        'credit-card': 'credit_card',
        'federal-student-loan': 'federal_student_loan',
        'private-student-loan': 'private_student_loan',
        'auto-loan': 'auto_loan',
        'personal-loan': 'personal_loan',
        'other': 'other'
      };
      
      // First, sync Plaid liabilities (they take priority)
      for (const plaidLiability of plaidLiabilities) {
        const balance = plaidLiability.balance || 0;
        
        if (balance > 0) {
          const debtKey = `${plaidLiability.type}_${plaidLiability.name}_${balance}`;
          addedDebts.add(debtKey);
          
          const [syncedDebt] = await db
            .insert(debts)
            .values({
              userId: req.user.id,
              debtName: plaidLiability.name,
              debtType: plaidLiability.type,
              originalBalance: (plaidLiability.originalBalance || balance).toString(),
              currentBalance: balance.toString(),
              annualInterestRate: (plaidLiability.interestRate || 0).toString(),
              minimumPayment: (plaidLiability.minimumPayment || 0).toString(),
              paymentDueDate: plaidLiability.nextPaymentDueDate ? 
                new Date(plaidLiability.nextPaymentDueDate).getDate() : 1,
              lender: plaidLiability.lender || '',
              notes: `Synced from Plaid - Last updated: ${new Date().toLocaleDateString()}`,
              status: 'active',
              owner: 'user',
              isIncludedInPayoff: true,
              isSecured: plaidLiability.type === 'mortgage' || plaidLiability.type === 'auto_loan',
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          
          allSyncedDebts.push(syncedDebt);
          console.log('Synced Plaid debt:', syncedDebt.debtName);
        }
      }

      // Sync liabilities (non-mortgage debts) - only if not already added from Plaid
      for (const liability of liabilities) {
        const balance = parseFloat(liability.balance) || 0;
        console.log('Processing liability:', liability.type, 'Balance:', balance);
        
        // Create a key to check for duplicates
        const mappedType = typeMapping[liability.type] || 'other';
        const debtKey = `${mappedType}_${liability.description}_${balance}`;
        
        // Skip if this debt was already added from Plaid
        if (addedDebts.has(debtKey)) {
          console.log('Skipping duplicate debt from manual entry:', liability.description);
          continue;
        }
        
        if (balance > 0) {
          const [syncedDebt] = await db
            .insert(debts)
            .values({
              userId: req.user.id,
              debtName: liability.description || `${liability.type} Debt`,
              debtType: typeMapping[liability.type] || 'other',
              originalBalance: balance.toString(),
              currentBalance: balance.toString(),
              annualInterestRate: (parseFloat(liability.interestRate) || 0).toString(),
              minimumPayment: (parseFloat(liability.monthlyPayment) || 0).toString(),
              paymentDueDate: 1, // Default to 1st of month
              lender: liability.description || '',
              notes: `Synced from intake form - Owner: ${liability.owner}`,
              status: 'active',
              owner: liability.owner || 'user',
              isIncludedInPayoff: true,
              isSecured: false, // Assume unsecured unless it's a mortgage
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          
          allSyncedDebts.push(syncedDebt);
          console.log('Synced debt:', syncedDebt.debtName);
        }
      }

      // Sync primary residence mortgage if exists
      if (primaryMortgage) {
        const mortgageBalance = parseFloat(primaryMortgage.mortgageBalance) || 0;
        console.log('Primary mortgage balance:', mortgageBalance);
        
        if (mortgageBalance > 0) {
          const [mortgageDebt] = await db
            .insert(debts)
            .values({
              userId: req.user.id,
              debtName: "Primary Residence Mortgage",
              debtType: 'mortgage',
              originalBalance: mortgageBalance.toString(),
              currentBalance: mortgageBalance.toString(),
              annualInterestRate: (parseFloat(primaryMortgage.interestRate) || 4.5).toString(),
              minimumPayment: (parseFloat(primaryMortgage.monthlyPayment) || 0).toString(),
              paymentDueDate: 1,
              lender: '',
              notes: `Primary residence mortgage - Remaining term: ${primaryMortgage.yearsToPayOffMortgage || 'Unknown'} years`,
              status: 'active',
              owner: primaryMortgage.owner || 'joint',
              isIncludedInPayoff: true,
              isSecured: true, // Mortgages are secured debt
              collateral: 'Primary Residence',
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          
          allSyncedDebts.push(mortgageDebt);
          console.log('Synced mortgage:', mortgageDebt.debtName);
        }
      }

      // Sync additional property mortgages
      for (const property of additionalProperties) {
        const propertyMortgageBalance = parseFloat(property.mortgageBalance) || 0;
        console.log('Property mortgage balance:', propertyMortgageBalance);
        
        if (propertyMortgageBalance > 0) {
          const [propertyDebt] = await db
            .insert(debts)
            .values({
              userId: req.user.id,
              debtName: property.description || `${property.type} Mortgage`,
              debtType: 'mortgage',
              originalBalance: propertyMortgageBalance.toString(),
              currentBalance: propertyMortgageBalance.toString(),
              annualInterestRate: (parseFloat(property.interestRate) || 5.0).toString(),
              minimumPayment: (parseFloat(property.monthlyPayment) || 0).toString(),
              paymentDueDate: 1,
              lender: '',
              notes: `Investment property mortgage`,
              status: 'active',
              owner: property.owner || 'joint',
              isIncludedInPayoff: true,
              isSecured: true, // Mortgages are secured debt
              collateral: property.description || 'Investment Property',
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          
          allSyncedDebts.push(propertyDebt);
          console.log('Synced property mortgage:', propertyDebt.debtName);
        }
      }

      const syncedDebts = allSyncedDebts;

      res.json({ 
        success: true, 
        message: `Successfully synced ${syncedDebts.length} debts from intake form`,
        debts: syncedDebts 
      });
    } catch (error) {
      console.error('Debt sync error:', error);
      next(error);
    }
  });

  // Get all debts for current user
  app.get("/api/debts", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userDebts = await db
        .select()
        .from(debts)
        .where(
          and(
            eq(debts.userId, req.user.id),
            eq(debts.status, 'active')
          )
        );

      res.json(userDebts);
    } catch (error: any) {
      // If the database is missing a column (e.g., debts.notes), avoid 500s and return an empty list
      // while we guide the environment to run the DB patch.
      if (error?.code === '42703') {
        console.warn('[Debt API] Missing column detected while SELECTing debts. Returning empty list until DB patch applied.');
        return res.json([]);
      }
      next(error);
    }
  });

  // Add a new debt
  app.post("/api/debts", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const validatedData = validateRequest(debtSchema, req.body);
      validateDebtWithBusinessLogic(validatedData);

      const newDebt = await db
        .insert(debts)
        .values({
          ...validatedData,
          userId: req.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.json(newDebt[0]);
    } catch (error) {
      next(error);
    }
  });

  // Update a debt
  app.put("/api/debts/:id", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { id } = validateParams(idParamSchema, req.params);
      const validatedData = validateRequest(debtSchema, req.body);
      validateDebtWithBusinessLogic(validatedData);

      const updatedDebt = await db
        .update(debts)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(debts.id, id),
            eq(debts.userId, req.user.id)
          )
        )
        .returning();

      if (updatedDebt.length === 0) {
        return res.status(404).json({ error: "Debt not found" });
      }

      res.json(updatedDebt[0]);
    } catch (error) {
      next(error);
    }
  });

  // Delete a debt
  app.delete("/api/debts/:id", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { id } = validateParams(idParamSchema, req.params);

      const deletedDebt = await db
        .delete(debts)
        .where(
          and(
            eq(debts.id, id),
            eq(debts.userId, req.user.id)
          )
        )
        .returning();

      if (deletedDebt.length === 0) {
        return res.status(404).json({ error: "Debt not found" });
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Delete debt with sync back to intake form
  app.delete("/api/debts/:id/delete-with-sync", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const debtId = parseInt(req.params.id);

      // First, get the debt to be deleted
      const [debtToDelete] = await db
        .select()
        .from(debts)
        .where(
          and(
            eq(debts.id, debtId),
            eq(debts.userId, req.user.id)
          )
        )
        .limit(1);

      if (!debtToDelete) {
        return res.status(404).json({ error: "Debt not found" });
      }

      // Delete the debt from debts table
      await db
        .delete(debts)
        .where(
          and(
            eq(debts.id, debtId),
            eq(debts.userId, req.user.id)
          )
        );

      // Update the intake form (financialProfiles) to remove this debt
      const [profile] = await db
        .select()
        .from(financialProfiles)
        .where(eq(financialProfiles.userId, req.user.id))
        .limit(1);

      if (profile) {
        let updated = false;
        let liabilities = (profile.liabilities as any[]) || [];
        let primaryResidence = profile.primaryResidence as any;
        let additionalProperties = (profile.additionalProperties as any[]) || [];

        // Check if it's a liability (non-mortgage debt)
        if (debtToDelete.debtType !== 'mortgage') {
          const newLiabilities = liabilities.filter(
            (liability: any) => liability.description !== debtToDelete.debtName
          );
          if (newLiabilities.length !== liabilities.length) {
            liabilities = newLiabilities;
            updated = true;
          }
        } else {
          // Check if it's primary residence mortgage
          if (debtToDelete.debtName === "Primary Residence Mortgage" && primaryResidence) {
            primaryResidence.mortgageBalance = 0;
            primaryResidence.monthlyPayment = 0;
            updated = true;
          } else {
            // Check additional properties
            const newProperties = additionalProperties.map((prop: any) => {
              if (prop.description === debtToDelete.debtName || 
                  debtToDelete.debtName.includes(prop.description)) {
                return { ...prop, mortgageBalance: 0, monthlyPayment: 0 };
              }
              return prop;
            });
            if (JSON.stringify(newProperties) !== JSON.stringify(additionalProperties)) {
              additionalProperties = newProperties;
              updated = true;
            }
          }
        }

        if (updated) {
          // Update the financial profile
          await db
            .update(financialProfiles)
            .set({
              liabilities,
              primaryResidence,
              additionalProperties,
              updatedAt: new Date()
            })
            .where(eq(financialProfiles.userId, req.user.id));

          // Trigger recalculation of financial metrics
          const { calculateFinancialMetrics } = await import('../services/financial-calculations');
          const updatedProfile = {
            ...profile,
            liabilities,
            primaryResidence,
            additionalProperties
          };
          
          const calculations = calculateFinancialMetrics(updatedProfile);
          
          // Save the recalculated metrics
          await db
            .update(financialProfiles)
            .set({
              calculations,
              updatedAt: new Date()
            })
            .where(eq(financialProfiles.userId, req.user.id));
        }
      }

      res.json({ 
        success: true, 
        message: "Debt deleted and financial metrics updated",
        debtName: debtToDelete.debtName
      });
    } catch (error) {
      console.error('Delete debt with sync error:', error);
      next(error);
    }
  });

  // Calculate debt strategies
  app.post("/api/calculate-debt-strategies", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { strategy, extraPayment } = req.body;

      // Get user's active debts
      const userDebts = await db
        .select()
        .from(debts)
        .where(
          and(
            eq(debts.userId, req.user.id),
            eq(debts.isActive, true),
            eq(debts.status, 'active')
          )
        );

      if (userDebts.length === 0) {
        return res.json({ message: "No active debts to calculate strategies for" });
      }

      // Convert debts to DebtInfo format for calculation
      const debtInfos: DebtInfo[] = userDebts.map((debt: any) => ({
        id: debt.id,
        debtName: debt.debtName,
        currentBalance: Number(debt.currentBalance),
        annualInterestRate: Number(debt.annualInterestRate),
        minimumPayment: Number(debt.minimumPayment),
      }));

      const extra = Number(extraPayment || 0);
      const baseMin = debtInfos.reduce((s, d) => s + d.minimumPayment, 0);
      const totalMonthlyPayment = baseMin + extra;
      const payoffPlan = DebtCalculationService.calculatePayoffPlan(
        debtInfos as any,
        totalMonthlyPayment,
        (strategy as any) || 'avalanche'
      );

      // Store the payoff plan
      await db
        .insert(debtPayoffPlans)
        .values({
          userId: req.user.id,
          planName: `${(strategy as any) || 'avalanche'} Strategy`,
          strategy: (strategy as any) || 'avalanche',
          extraMonthlyPayment: extra,
          startDate: new Date(),
          payoffDate: (payoffPlan as any).debtFreeDate,
          totalInterestPaid: (payoffPlan as any).totalInterestPaid?.toString?.() || '0',
          totalAmountPaid: (payoffPlan as any).totalAmountPaid?.toString?.() || '0',
          monthsToPayoff: (payoffPlan as any).totalMonths || 0,
          interestSaved: (payoffPlan as any).savingsVsMinimum?.toString?.() || '0',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      res.json(payoffPlan);
    } catch (error) {
      next(error);
    }
  });

  // Get active payoff plan
  app.get("/api/debt-payoff-plan/active", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      try {
        const [activePlan] = await db
          .select()
          .from(debtPayoffPlans)
          .where(
            and(
              eq(debtPayoffPlans.userId, req.user.id),
              eq(debtPayoffPlans.isActive, true)
            )
          )
          .limit(1);
        return res.json(activePlan || null);
      } catch (e: any) {
        if (e?.code === '42703') {
          // Missing columns in this environment, return null rather than 500
          return res.json(null);
        }
        throw e;
      }
    } catch (error) {
      next(error);
    }
  });

  // Save a what-if scenario
  app.post("/api/debt-scenarios", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { 
        scenarioName, 
        scenarioType, 
        parameters, 
        results,
        payoffDate,
        totalInterestPaid,
        monthsToPayoff,
        monthsSaved,
        interestSaved
      } = req.body;

      const [newScenario] = await db
        .insert(debtScenarios)
        .values({
          userId: req.user.id,
          scenarioName,
          scenarioType,
          parameters,
          results,
          payoffDate: payoffDate ? new Date(payoffDate) : null,
          totalInterestPaid: totalInterestPaid?.toString(),
          monthsToPayoff,
          monthsSaved,
          interestSaved: interestSaved?.toString(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.json(newScenario);
    } catch (error) {
      console.error('Save scenario error:', error);
      next(error);
    }
  });

  // Get all scenarios for user
  app.get("/api/debt-scenarios", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const scenarios = await db
        .select()
        .from(debtScenarios)
        .where(eq(debtScenarios.userId, req.user.id))
        .orderBy(desc(debtScenarios.createdAt));

      res.json(scenarios);
    } catch (error) {
      next(error);
    }
  });

  // Delete a scenario
  app.delete("/api/debt-scenarios/:id", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const scenarioId = parseInt(req.params.id);

      await db
        .delete(debtScenarios)
        .where(
          and(
            eq(debtScenarios.id, scenarioId),
            eq(debtScenarios.userId, req.user.id)
          )
        );

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Generate AI-powered debt insights (Gemini) with full DB context
  app.get("/api/ai-debt-insights", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      // Load most-recent active insights from DB
      const rows = await db
        .select()
        .from(debtAIInsights)
        .where(eq(debtAIInsights.userId, req.user.id));

      if (!rows || rows.length === 0) {
        return res.json({ insights: [], generatedAt: null });
      }

      const latest = rows.reduce((max: any, r: any) => {
        const t = (r as any).createdAt ? new Date((r as any).createdAt as any).getTime() : 0;
        return t > max ? t : max;
      }, 0);

      // Map DB rows to UI payload and sort by priority desc (3=high)
      const insights = rows
        .sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0))
        .map((r: any) => ({
          id: String(r.id),
          type: r.insightType === 'warning' ? 'warning' : (r.insightType?.includes('optimization') ? 'opportunity' : 'recommendation'),
          title: r.insightTitle,
          content: r.insightContent,
          priority: (r.priority || 0) >= 3 ? 'high' : (r.priority || 0) === 2 ? 'medium' : 'low',
          actionable: !!r.isActionable,
          potentialSavings: undefined,
          relatedDebtId: r.relatedDebtId || undefined,
        }));

      return res.json({ insights, generatedAt: latest ? new Date(latest).toISOString() : null });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai-debt-insights", async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Use DB as source of truth; ignore client-passed debts/summary/plan
      const { generateDebtInsightsForUser } = await import('../debt-gemini-insights');
      const { insights } = await generateDebtInsightsForUser(req.user.id);
      // Return UI-friendly payload with timestamp
      return res.json({ insights, generatedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error('[Debt AI Insights] Error:', error?.message || error);
      // Non-fatal: return empty list so UI can fall back
      return res.status(500).json({ insights: [], error: 'Failed to generate insights' });
    }
  });
}
