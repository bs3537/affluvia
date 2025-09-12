import { db } from "../db";
import { eq, and } from "drizzle-orm";
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

      await db.transaction(async (tx) => {
        // Delete all debt-related data for the user
        await tx.delete(debtPayments).where(eq(debtPayments.userId, req.user.id));
        await tx.delete(debtMilestones).where(eq(debtMilestones.userId, req.user.id));
        await tx.delete(debtAIInsights).where(eq(debtAIInsights.userId, req.user.id));
        await tx.delete(debtScenarios).where(eq(debtScenarios.userId, req.user.id));
        await tx.delete(debtPayoffPlans).where(eq(debtPayoffPlans.userId, req.user.id));
        await tx.delete(debts).where(eq(debts.userId, req.user.id));
      });

      res.json({ 
        success: true, 
        message: "All debt management data has been cleared successfully"
      });
    } catch (error) {
      console.error('Clear debts error:', error);
      next(error);
    }
  });

  // Sync debts from intake form to debt management tables
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

      // Use transaction to sync all debts
      const syncedDebts = await db.transaction(async (tx) => {
        // First, DELETE all existing debts to prevent stacking
        await tx.delete(debts).where(eq(debts.userId, req.user.id));

        const allSyncedDebts = [];

        // Map liability types from intake form to debt management types
        const typeMapping: Record<string, string> = {
          'credit-card': 'credit_card',
          'student-loan': 'student_loan',
          'auto-loan': 'auto_loan',
          'personal-loan': 'personal_loan',
          'other': 'other'
        };

        // Sync liabilities (non-mortgage debts)
        for (const liability of liabilities) {
          const balance = parseFloat(liability.balance) || 0;
          console.log('Processing liability:', liability.type, 'Balance:', balance);
          
          if (balance > 0) {
            const [syncedDebt] = await tx
              .insert(debts)
              .values({
                userId: req.user.id,
                debtName: liability.description || `${liability.type} Debt`,
                debtType: typeMapping[liability.type] || 'other',
                currentBalance: balance.toString(),
                originalBalance: balance.toString(),
                annualInterestRate: (parseFloat(liability.interestRate) || 0).toString(),
                minimumPayment: (parseFloat(liability.monthlyPayment) || 0).toString(),
                paymentDueDate: 1, // Default to 1st of month
                extraPayment: "0",
                isPromotionalRate: false,
                creditorName: liability.description || '',
                notes: `Synced from intake form - Owner: ${liability.owner}`,
                status: 'active',
                isActive: true,
                owner: liability.owner || 'user',
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
            const [mortgageDebt] = await tx
              .insert(debts)
              .values({
                userId: req.user.id,
                debtName: "Primary Residence Mortgage",
                debtType: 'mortgage',
                currentBalance: mortgageBalance.toString(),
                originalBalance: mortgageBalance.toString(),
                annualInterestRate: (parseFloat(primaryMortgage.mortgageRate) || 4.5).toString(),
                minimumPayment: (parseFloat(primaryMortgage.monthlyPayment) || 0).toString(),
                paymentDueDate: 1,
                extraPayment: "0",
                isPromotionalRate: false,
                creditorName: '',
                notes: `Primary residence mortgage`,
                status: 'active',
                isActive: true,
                owner: primaryMortgage.owner || 'joint',
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
            const [propertyDebt] = await tx
              .insert(debts)
              .values({
                userId: req.user.id,
                debtName: property.description || "Investment Property Mortgage",
                debtType: 'mortgage',
                currentBalance: propertyMortgageBalance.toString(),
                originalBalance: propertyMortgageBalance.toString(),
                annualInterestRate: (parseFloat(property.mortgageRate) || 5.0).toString(),
                minimumPayment: (parseFloat(property.monthlyPayment) || 0).toString(),
                paymentDueDate: 1,
                extraPayment: "0",
                isPromotionalRate: false,
                creditorName: '',
                notes: `Investment property mortgage`,
                status: 'active',
                isActive: true,
                owner: property.owner || 'joint',
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();
            
            allSyncedDebts.push(propertyDebt);
            console.log('Synced property mortgage:', propertyDebt.debtName);
          }
        }

        return allSyncedDebts;
      });

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
            eq(debts.isActive, true)
          )
        );

      res.json(userDebts);
    } catch (error) {
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
      const debtInfos: DebtInfo[] = userDebts.map(debt => ({
        id: debt.id,
        name: debt.debtName,
        balance: parseFloat(debt.currentBalance),
        interestRate: parseFloat(debt.annualInterestRate),
        minimumPayment: parseFloat(debt.minimumPayment),
      }));

      const calculationService = new DebtCalculationService();
      const payoffPlan = calculationService.calculatePayoffPlan(
        debtInfos,
        strategy,
        extraPayment || 0
      );

      // Store the payoff plan
      await db
        .insert(debtPayoffPlans)
        .values({
          userId: req.user.id,
          planName: `${strategy} Strategy`,
          strategy,
          extraMonthlyPayment: extraPayment || 0,
          projectedPayoffDate: payoffPlan.payoffDate,
          totalInterestSaved: payoffPlan.interestSaved.toString(),
          monthsSaved: payoffPlan.monthsSaved,
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

      res.json(activePlan || null);
    } catch (error) {
      next(error);
    }
  });
}