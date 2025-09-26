import { 
  users, 
  financialProfiles, 
  chatMessages, 
  chatDocuments,
  pdfReports, 
  investmentCache,
  whiteLabelProfiles,
  reportLayouts,
  reportSnapshots,
  goals,
  goalTasks,
  goalAuditLog,
  estatePlans,
  estateDocuments,
  estateBeneficiaries,
  estateTrusts,
  estateScenarios,
  educationGoals,
  collegeReference,
  state529Plans,
  educationScenarios,
  lifeGoalsTable,
  actionPlanTasks,
  dashboardInsights,
  rothConversionAnalyses,
  advisorClients,
  advisorInvites,
  advisorAuditLogs,
  sharedVaultFiles,
  // Debt management tables
  debts,
  debtPayoffPlans,
  debtScenarios,
  debtPayments,
  debtMilestones,
  debtAIInsights,
  // Plaid tables
  plaidItems,
  plaidAccounts,
  plaidTransactions,
  plaidInvestmentHoldings,
  plaidLiabilities,
  plaidSyncStatus,
  plaidAccountMappings,
  plaidSyncSchedule,
  plaidAggregatedSnapshot,
  // Gamification tables
  userAchievements,
  userProgress,
  sectionProgress,
  // Cache and widget tables
  widgetCache,
  // Audit and security tables
  auditLogs,
  dataAccessLogs,
  securityEvents,
  type User, 
  type InsertUser, 
  type FinancialProfile, 
  type InsertFinancialProfile, 
  type ChatMessage, 
  type InsertChatMessage, 
  type ChatDocument,
  type InsertChatDocument,
  type InvestmentCache,
  type Goal,
  type InsertGoal,
  type GoalTask,
  type InsertGoalTask,
  type GoalAuditLog,
  type EstatePlan,
  type InsertEstatePlan,
  type EstateDocument,
  type InsertEstateDocument,
  type EstateBeneficiary,
  type InsertEstateBeneficiary,
  type EstateTrust,
  type InsertEstateTrust,
  type EstateScenario,
  type InsertEstateScenario,
  type EducationGoal,
  type InsertEducationGoal,
  type CollegeReference,
  type InsertCollegeReference,
  type State529Plan,
  type InsertState529Plan,
  type EducationScenario,
  type InsertEducationScenario,
  type LifeGoal,
  type InsertLifeGoal,
  type ActionPlanTask,
  type DashboardInsight,
  type InsertDashboardInsight,
  type RothConversionAnalysis,
  type InsertRothConversionAnalysis
  , type AdvisorClient, type AdvisorInvite, type AdvisorAuditLog
  , type WhiteLabelProfile, type InsertWhiteLabelProfile
  , type ReportLayout, type InsertReportLayout
  , type ReportSnapshot, type InsertReportSnapshot
  , type SharedVaultFile, type InsertSharedVaultFile
} from "@shared/schema";
import { db } from "./db";
import { withDatabaseRetry } from "./db-utils";
import { eq, and, gt, asc, desc, sql } from "drizzle-orm";
import session from "express-session";
import pgSession from "connect-pg-simple";
import memorystore from "memorystore";
import pg from "pg";
import { lookup as dnsLookup } from 'node:dns';
import { pool as sharedPool } from "./db";
import crypto from "node:crypto";

const PgStore = pgSession(session);
const MemoryStore = memorystore(session);

// Create a dedicated pool for session store using env, with IPv4 preference via NODE_OPTIONS
const usePgSession = process.env.NODE_ENV === 'production' || process.env.USE_PG_SESSION === 'true';
const sessionPool = usePgSession ? (() => {
  const conString = process.env.SESSION_DATABASE_URL || process.env.DATABASE_URL || '';
  const ssl = (process.env.SESSION_DB_SSL === 'true' || process.env.NODE_ENV === 'production') ? { rejectUnauthorized: false, require: true } : undefined as any;
  const max = Number(process.env.SESSION_DB_MAX || 5);
  if (conString) {
    return new pg.Pool({ connectionString: conString, ssl, max });
  }
  // Fallback to discrete host/port envs if provided
  const host = process.env.SESSION_DB_HOST;
  const port = Number(process.env.SESSION_DB_PORT || 6543);
  const database = process.env.SESSION_DB_NAME || 'postgres';
  const user = process.env.SESSION_DB_USER;
  const password = process.env.SESSION_DB_PASSWORD;
  return new pg.Pool({ host, port, database, user, password, ssl, max, min: 1, idleTimeoutMillis: 10000, connectionTimeoutMillis: 30000 });
})() : null as any;

export type SharedVaultFileWithUploader = SharedVaultFile & {
  uploaderEmail: string | null;
  uploaderName: string | null;
};

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getFinancialProfile(userId: number): Promise<FinancialProfile | undefined>;
  updateFinancialProfile(userId: number, data: Partial<InsertFinancialProfile>): Promise<FinancialProfile>;
  deleteFinancialProfile(userId: number): Promise<void>;
  getRothConversionAnalysis(userId: number): Promise<RothConversionAnalysis | undefined>;
  saveRothConversionAnalysis(userId: number, analysis: unknown): Promise<RothConversionAnalysis>;
  deleteRothConversionAnalysis(userId: number): Promise<void>;
  
  // Comprehensive reset - deletes ALL user data
  deleteAllUserData(userId: number): Promise<void>;
  
  getChatMessages(userId: number): Promise<ChatMessage[]>;
  createChatMessage(userId: number, message: InsertChatMessage): Promise<ChatMessage>;
  updateChatMessage(messageId: number, updates: Partial<InsertChatMessage>): Promise<ChatMessage>;
  deleteChatMessages(userId: number): Promise<void>;
  
  // Chat documents methods
  createChatDocument(document: InsertChatDocument): Promise<ChatDocument>;
  getChatDocuments(messageId: number): Promise<ChatDocument[]>;
  getChatDocument(documentId: number, userId: number): Promise<ChatDocument | undefined>;
  getUserChatDocuments(userId: number): Promise<ChatDocument[]>;
  createSharedVaultFile(file: InsertSharedVaultFile): Promise<SharedVaultFile>;
  listSharedVaultFiles(ownerClientId: number): Promise<SharedVaultFileWithUploader[]>;
  getSharedVaultFileById(fileId: number): Promise<SharedVaultFile | undefined>;
  deleteSharedVaultFile(fileId: number): Promise<void>;
  getActiveAdvisorsForClient(clientId: number): Promise<AdvisorClient[]>;
  getInvestmentCache(userId: number, category: string): Promise<InvestmentCache | undefined>;
  setInvestmentCache(userId: number, category: string, data: any, ttlHours?: number): Promise<InvestmentCache>;
  
  // Goals methods
  getGoals(userId: number): Promise<Goal[]>;
  getGoal(userId: number, goalId: number): Promise<Goal | undefined>;
  createGoal(userId: number, goal: InsertGoal): Promise<Goal>;
  updateGoal(userId: number, goalId: number, data: Partial<InsertGoal>): Promise<Goal>;
  deleteGoal(userId: number, goalId: number): Promise<void>;
  
  // Goal Tasks methods
  getGoalTasks(userId: number, goalId: number): Promise<GoalTask[]>;
  getGoalTask(userId: number, taskId: number): Promise<GoalTask | undefined>;
  createGoalTask(userId: number, goalId: number, task: InsertGoalTask): Promise<GoalTask>;
  updateGoalTask(userId: number, taskId: number, data: Partial<InsertGoalTask>): Promise<GoalTask>;
  deleteGoalTask(userId: number, taskId: number): Promise<void>;
  
  // Audit log
  createGoalAuditLog(log: Partial<GoalAuditLog>): Promise<GoalAuditLog>;
  
  // Estate Planning methods
  getEstatePlan(userId: number): Promise<EstatePlan | undefined>;
  createEstatePlan(userId: number, plan: InsertEstatePlan): Promise<EstatePlan>;
  updateEstatePlan(userId: number, planId: number, data: Partial<InsertEstatePlan>): Promise<EstatePlan>;
  deleteEstatePlan(userId: number, planId: number): Promise<void>;
  
  // Estate Documents
  getEstateDocuments(userId: number, estatePlanId?: number): Promise<EstateDocument[]>;
  getEstateDocument(userId: number, documentId: number): Promise<EstateDocument | undefined>;
  createEstateDocument(userId: number, document: InsertEstateDocument): Promise<EstateDocument>;
  updateEstateDocument(userId: number, documentId: number, data: Partial<InsertEstateDocument>): Promise<EstateDocument>;
  deleteEstateDocument(userId: number, documentId: number): Promise<void>;
  
  // Estate Beneficiaries
  getEstateBeneficiaries(userId: number, estatePlanId?: number): Promise<EstateBeneficiary[]>;
  getEstateBeneficiary(userId: number, beneficiaryId: number): Promise<EstateBeneficiary | undefined>;
  createEstateBeneficiary(userId: number, beneficiary: InsertEstateBeneficiary): Promise<EstateBeneficiary>;
  updateEstateBeneficiary(userId: number, beneficiaryId: number, data: Partial<InsertEstateBeneficiary>): Promise<EstateBeneficiary>;
  deleteEstateBeneficiary(userId: number, beneficiaryId: number): Promise<void>;
  
  // Estate Trusts
  getEstateTrusts(userId: number, estatePlanId?: number): Promise<EstateTrust[]>;
  getEstateTrust(userId: number, trustId: number): Promise<EstateTrust | undefined>;
  createEstateTrust(userId: number, trust: InsertEstateTrust): Promise<EstateTrust>;
  updateEstateTrust(userId: number, trustId: number, data: Partial<InsertEstateTrust>): Promise<EstateTrust>;
  deleteEstateTrust(userId: number, trustId: number): Promise<void>;
  
  // Estate Scenarios
  getEstateScenarios(userId: number, estatePlanId?: number): Promise<EstateScenario[]>;
  getEstateScenario(userId: number, scenarioId: number): Promise<EstateScenario | undefined>;
  createEstateScenario(userId: number, scenario: InsertEstateScenario): Promise<EstateScenario>;
  updateEstateScenario(userId: number, scenarioId: number, data: Partial<InsertEstateScenario>): Promise<EstateScenario>;
  deleteEstateScenario(userId: number, scenarioId: number): Promise<void>;
  
  // Education Goals
  getEducationGoals(userId: number): Promise<EducationGoal[]>;
  getEducationGoal(userId: number, goalId: number): Promise<EducationGoal | undefined>;
  createEducationGoal(userId: number, goal: InsertEducationGoal): Promise<EducationGoal>;
  updateEducationGoal(userId: number, goalId: number, data: Partial<InsertEducationGoal>): Promise<EducationGoal>;
  deleteEducationGoal(userId: number, goalId: number): Promise<void>;
  
  
  // College Reference Data
  getCollegeByName(name: string): Promise<CollegeReference[]>;
  getCollegeById(id: string): Promise<CollegeReference | undefined>;
  
  // State 529 Plan Info
  getState529Plan(state: string): Promise<State529Plan | undefined>;
  
  // Education Scenarios
  getEducationScenariosByGoal(userId: number, goalId: number): Promise<EducationScenario[]>;
  createEducationScenario(userId: number, scenario: InsertEducationScenario): Promise<EducationScenario>;
  updateEducationScenario(userId: number, scenarioId: number, data: Partial<InsertEducationScenario>): Promise<EducationScenario>;
  deleteEducationScenario(userId: number, scenarioId: number): Promise<void>;
  
  // Life Goals
  getLifeGoals(userId: number): Promise<any[]>;
  getLifeGoal(userId: number, goalId: number): Promise<any | undefined>;
  createLifeGoal(userId: number, goal: any): Promise<any>;
  updateLifeGoal(userId: number, goalId: number, data: any): Promise<any>;
  deleteLifeGoal(userId: number, goalId: number): Promise<void>;
  
  // Advisor linking & invites
  getAdvisorClients(advisorId: number): Promise<Array<{ id: number; email: string; fullName: string | null; status: string; lastUpdated: Date | null }>>;
  linkAdvisorToClient(advisorId: number, clientId: number): Promise<AdvisorClient>;
  getAdvisorClientLink(advisorId: number, clientId: number): Promise<AdvisorClient | undefined>;
  createAdvisorInvite(advisorId: number, email: string, inviteToken: string | undefined, tokenHash: string | undefined, expiresAt: Date): Promise<AdvisorInvite>;
  getInviteByTokenHash(tokenHash: string): Promise<AdvisorInvite | undefined>;
  markInviteAccepted(inviteId: number, clientId: number): Promise<void>;
  getPendingInvitesByEmail(email: string): Promise<AdvisorInvite[]>;
  createAdvisorAuditLog(entry: Omit<AdvisorAuditLog, 'id' | 'createdAt'>): Promise<AdvisorAuditLog>;
  getAdvisorInvites(advisorId: number): Promise<AdvisorInvite[]>;
  getPrimaryAdvisorForClient(clientId: number): Promise<number | null>;
  updateAdvisorInviteToken(inviteId: number, inviteToken: string | undefined, tokenHash: string | undefined, expiresAt: Date): Promise<AdvisorInvite>;
  cancelAdvisorInvite(inviteId: number): Promise<void>;

  // Advisor branding (white label)
  getWhiteLabelProfile(advisorId: number): Promise<WhiteLabelProfile | undefined>;
  upsertWhiteLabelProfile(advisorId: number, data: Partial<InsertWhiteLabelProfile>): Promise<WhiteLabelProfile>;

  // Report builder persistence
  getReportLayout(userId: number): Promise<ReportLayout | undefined>;
  saveReportLayout(userId: number, data: InsertReportLayout): Promise<ReportLayout>;
  saveDraftInsights(userId: number, insights: Array<{ id?: string; text: string; order: number; isCustom?: boolean }>): Promise<void>;
  createReportSnapshot(userId: number, snapshot: Omit<InsertReportSnapshot, 'userId'> & { advisorId?: number | null }): Promise<ReportSnapshot>;
  getReportSnapshot(userId: number, snapshotId: number): Promise<ReportSnapshot | undefined>;
  getReportSnapshotById(snapshotId: number): Promise<ReportSnapshot | undefined>;
  getLatestReportSnapshot(userId: number): Promise<ReportSnapshot | undefined>;

  sessionStore: session.Store;

  // Account management
  updateUserEmail(userId: number, newEmail: string): Promise<User>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    const usePg = process.env.NODE_ENV === 'production' || process.env.USE_PG_SESSION === 'true';

    if (!usePg) {
      // Use in-memory session store in development to avoid DB dependency
      this.sessionStore = new (MemoryStore as any)({ checkPeriod: 24 * 60 * 60 * 1000 });
      console.log('[SessionStore] Using in-memory session store (dev)');
    } else {
      // Use dedicated IPv4-only pool for session store to avoid connection errors
      this.sessionStore = new (PgStore as any)({
        pool: sessionPool!, // Use dedicated IPv4 pool instead of sharedPool
        tableName: 'sessions',
        createTableIfMissing: false, // Table already exists, don't try to create it
        errorLog: (error: any) => {
          // Ignore "already exists" errors as they're harmless
          if (error && error.code !== '42P07') {
            console.error('[SessionStore] Error:', error);
          }
        }
      });
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await withDatabaseRetry(() =>
      db.select().from(users).where(eq(users.id, id))
    );
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await withDatabaseRetry(() =>
      db.select().from(users).where(eq(users.email, email))
    );
    return user || undefined;
  }

  async updateUserEmail(userId: number, newEmail: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ email: newEmail })
      .where(eq(users.id, userId))
      .returning();
    return user as User;
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId))
      .returning();
    return user as User;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getFinancialProfile(userId: number): Promise<FinancialProfile | undefined> {
    // Use retry wrapper to mitigate transient pool timeouts and connection issues
    const profiles = await withDatabaseRetry(() =>
      db.select().from(financialProfiles).where(eq(financialProfiles.userId, userId))
    );

    const profile = profiles[0];

    if (!profile) {
      return undefined;
    }

    return this.parseProfileJsonFields(profile);
  }

  async updateFinancialProfile(userId: number, data: Partial<InsertFinancialProfile>): Promise<FinancialProfile> {
    // Define valid column names from the schema
    const validColumns = [
      'firstName', 'lastName', 'dateOfBirth', 'maritalStatus', 'dependents', 'spouseName', 'spouseDateOfBirth', 'state',
      'employmentStatus', 'annualIncome', 'taxWithholdingStatus', 'takeHomeIncome', 'otherIncome',
      'spouseEmploymentStatus', 'spouseAnnualIncome', 'spouseTaxWithholdingStatus', 'spouseTakeHomeIncome',
      'savingsRate', 'assets', 'liabilities', 'primaryResidence', 'additionalProperties', 'monthlyExpenses', 'totalMonthlyExpenses',
      'emergencyFundSize', 'lifeInsurance', 'spouseLifeInsurance', 'healthInsurance', 'disabilityInsurance',
      'spouseDisabilityInsurance', 'autoInsurance', 'homeownerInsurance', 'umbrellaInsurance', 'businessLiabilityInsurance', 'insurance', 'riskTolerance', 'riskQuestionnaire', 'riskQuestions',
      'currentAllocation', 'currentStockAllocation', 'currentBondAllocation', 'currentCashAllocation', 'currentAlternativesAllocation', 'spouseRiskQuestions', 'spouseAllocation', 
      'userRiskProfile', 'targetAllocation', 'spouseRiskProfile', 'spouseTargetAllocation', 'hasWill', 'hasTrust', 'hasPowerOfAttorney',
      'hasHealthcareProxy', 'hasBeneficiaries', 'estatePlanning', 'goals', 'lifeGoals', 'retirementAge',
      'retirementIncome', 'additionalNotes', 'lifeExpectancy', 'retirementExpenseBudget', 'socialSecurityBenefit',
      'spouseSocialSecurityBenefit', 'pensionBenefit', 'spousePensionBenefit', 'retirementContributions', 
      'spouseRetirementContributions', 'expectedRealReturn', 'investmentStrategy', 'withdrawalRate', 'hasLongTermCareInsurance',
      'legacyGoal', 'partTimeIncomeRetirement', 'spousePartTimeIncomeRetirement', 'desiredRetirementAge', 'spouseDesiredRetirementAge', 'socialSecurityClaimAge', 'spouseSocialSecurityClaimAge',
      'userLifeExpectancy', 'spouseLifeExpectancy', 'expectedMonthlyExpensesRetirement', 'retirementState', 
      'traditionalIRAContribution', 'rothIRAContribution', 'spouseTraditionalIRAContribution', 'spouseRothIRAContribution',
      'userHealthStatus', 'spouseHealthStatus', 'expectedInflationRate',
      'lastYearAGI', 'deductionAmount', 
      'taxFilingStatus', 'taxReturns', 'taxRecommendations', 'financialHealthScore',
      'emergencyReadinessScore', 'retirementReadinessScore', 'riskManagementScore', 'cashFlowScore',
      'netWorth', 'monthlyCashFlow', 'monthlyCashFlowAfterContributions',
      'calculations', 'retirementPlanningData', 'centralInsights', 'retirementInsights', 'monteCarloSimulation', 'isComplete', 'optimizationVariables',
      'retirementPlanningUIPreferences', 'lastStressTestResults', 'lastStressTestDate',
      // Self-employed data fields
      'isSelfEmployed', 'selfEmploymentIncome', 'businessType', 'hasRetirementPlan', 'quarterlyTaxPayments', 'selfEmployedData'
    ];

    // Filter out any properties that aren't valid columns
    const filteredData: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (validColumns.includes(key)) {
        filteredData[key] = value;
      } else {
        console.warn(`Skipping invalid column: ${key}`);
        // Log more details if the key contains 'monte' for debugging
        if (key.toLowerCase().includes('monte')) {
          console.error(`Found problematic monte carlo field: "${key}"`);
        }
      }
    }

    // Prepare data for database insertion - ensure JSON fields are properly handled
    const preparedData = { ...filteredData };

    // Ensure JSON fields are objects, not strings and handle null/undefined
    const jsonFields = ['assets', 'liabilities', 'calculations', 'monthlyExpenses', 'primaryResidence', 
                       'additionalProperties', 'lifeInsurance', 'spouseLifeInsurance', 'healthInsurance', 
                       'disabilityInsurance', 'spouseDisabilityInsurance', 'insurance', 'currentAllocation', 
                       'spouseAllocation', 'riskQuestions', 'riskQuestionnaire', 'spouseRiskQuestions', 
                       'goals', 'lifeGoals', 'estatePlanning', 'taxReturns', 'taxRecommendations', 'retirementPlanningData', 'centralInsights', 'retirementInsights',
                       'monteCarloSimulation', 'optimizationVariables', 'retirementPlanningUIPreferences',
                       'lastStressTestResults', 'lastStressTestDate',
                       // Self-employed JSON fields
                       'selfEmployedData', 'quarterlyTaxPayments',
                       // Retirement JSON fields
                       'retirementExpenseBudget', 'retirementContributions', 'spouseRetirementContributions'];
    
    jsonFields.forEach(field => {
      if (preparedData[field as keyof typeof preparedData]) {
        if (typeof preparedData[field as keyof typeof preparedData] === 'string') {
          try {
            preparedData[field as keyof typeof preparedData] = JSON.parse(preparedData[field as keyof typeof preparedData] as string);
          } catch (e) {
            console.warn(`Failed to parse JSON field ${field}, keeping as string`);
          }
        }
      }
    });

    // Guardrails for oversized JSON payloads to prevent timeouts/TOAST bloat
    const ensureSafe = (obj: any, maxBytes = 2_000_000) => {
      try {
        const s = JSON.stringify(obj);
        if (Buffer.byteLength(s, 'utf8') > maxBytes) return { truncated: true } as any;
        return obj;
      } catch {
        return { truncated: true } as any;
      }
    };

    // Proactively trim/shape large Monte Carlo/optimization trees, and merge with existing to prevent clobbering
    if ((preparedData as any).monteCarloSimulation) {
      const incoming: any = (preparedData as any).monteCarloSimulation;

      // Drop large arrays if present in incoming
      if (incoming.yearlyCashFlows) delete incoming.yearlyCashFlows;
      if (incoming.withdrawalRates) delete incoming.withdrawalRates;
      if (incoming.successByYear) delete incoming.successByYear;
      if (incoming.retirementSimulation?.results) {
        const r = incoming.retirementSimulation.results;
        if (r.yearlyCashFlows) r.yearlyCashFlows = [];
        if (Array.isArray(r.percentileData) && r.percentileData.length > 1000) {
          r.percentileData = { truncated: true };
        }
      }
      if (incoming.percentileData) incoming.percentileData = ensureSafe(incoming.percentileData);

      // Merge with existing to avoid wiping saved results when incoming is partial
      const existingProfile = await this.getFinancialProfile(userId);
      const currentMC: any = (existingProfile as any)?.monteCarloSimulation || {};
      const merged: any = {
        ...currentMC,
        ...incoming,
        retirementSimulation: {
          ...(currentMC?.retirementSimulation || {}),
          ...(incoming?.retirementSimulation || {}),
        }
      };
      if (!incoming?.retirementSimulation?.results && currentMC?.retirementSimulation?.results) {
        merged.retirementSimulation.results = currentMC.retirementSimulation.results;
      }

      const safe = ensureSafe(merged);
      if ((safe as any)?.truncated) {
        console.warn('[Storage] monteCarloSimulation payload exceeded size limits; preserving existing value');
        // Keep existing value rather than overwriting with truncated stub
        (preparedData as any).monteCarloSimulation = currentMC;
      } else {
        (preparedData as any).monteCarloSimulation = safe;
      }
    }

    if ((preparedData as any).optimizationVariables) {
      const ov: any = (preparedData as any).optimizationVariables;
      if (ov.optimizedScore) {
        const { probabilityOfSuccess, medianEndingBalance, percentileData } = ov.optimizedScore || {};
        ov.optimizedScore = {
          probabilityOfSuccess,
          medianEndingBalance,
          percentileData: ensureSafe(percentileData)
        };
      }
      (preparedData as any).optimizationVariables = ensureSafe(ov);
    }

    // Special handling for UI preferences - merge instead of replace
    if (preparedData.retirementPlanningUIPreferences) {
      const existingProfile = await this.getFinancialProfile(userId);
      if (existingProfile?.retirementPlanningUIPreferences) {
        preparedData.retirementPlanningUIPreferences = {
          ...existingProfile.retirementPlanningUIPreferences,
          ...preparedData.retirementPlanningUIPreferences
        };
      }
    }

    // Special handling for optimizationVariables - merge instead of replace
    // This ensures that when we save new optimization fields (like optimizedRetirementBands),
    // we don't lose previously saved fields (like optimizedRetirementSuccessProbability)
    if (preparedData.optimizationVariables) {
      const existingProfile = await this.getFinancialProfile(userId);
      if (existingProfile?.optimizationVariables) {
        console.log('🔍 Merging optimizationVariables - existing keys:', Object.keys(existingProfile.optimizationVariables));
        console.log('🔍 Merging optimizationVariables - new keys:', Object.keys(preparedData.optimizationVariables));
        preparedData.optimizationVariables = {
          ...existingProfile.optimizationVariables,
          ...preparedData.optimizationVariables
        };
        console.log('🔍 Merged optimizationVariables - final keys:', Object.keys(preparedData.optimizationVariables));
      }
    }

    // Use retry wrapper for database operations
    return withDatabaseRetry(async () => {
      const updatedProfiles = await db
        .update(financialProfiles)
        .set({ ...preparedData, lastUpdated: new Date() })
        .where(eq(financialProfiles.userId, userId))
        .returning();

      // Invalidate widget cache when profile is updated
      try {
        const { widgetCacheManager } = await import('./widget-cache-manager');
        
        // Determine which widget caches need to be invalidated based on what changed
        const dataKeys = Object.keys(filteredData);
        
        // Always invalidate Monte Carlo if financial data changed
        const financialDataChanged = dataKeys.some(key => [
          'annualIncome', 'assets', 'liabilities', 'monthlyExpenses', 'retirementAge',
          'desiredRetirementAge', 'socialSecurityBenefit', 'expectedRealReturn',
          'spouseAnnualIncome', 'spouseSocialSecurityBenefit', 'maritalStatus'
        ].includes(key));
        
        if (financialDataChanged) {
          console.log('[CACHE-INVALIDATION] Invalidating Monte Carlo cache due to financial data changes');
          await widgetCacheManager.invalidateWidget(userId, 'monte_carlo_retirement');
          await widgetCacheManager.invalidateWidget(userId, 'retirement_confidence_bands');
        }
        
        // Invalidate optimization-dependent caches if optimization variables changed
        if (dataKeys.includes('optimizationVariables')) {
          console.log('[CACHE-INVALIDATION] Invalidating optimization-dependent caches');
          await widgetCacheManager.invalidateWidget(userId, 'stress_test_scenarios');
          await widgetCacheManager.invalidateWidget(userId, 'portfolio_impact');
        }
        
        // Invalidate goals cache if life goals changed
        if (dataKeys.includes('lifeGoals') || dataKeys.includes('goals')) {
          console.log('[CACHE-INVALIDATION] Invalidating life goals cache');
          await widgetCacheManager.invalidateWidget(userId, 'life_goals_progress');
        }
        
        console.log('[CACHE-INVALIDATION] Widget cache invalidation completed');
      } catch (cacheError) {
        console.error('[CACHE-INVALIDATION] Error invalidating widget cache:', cacheError);
        // Don't fail the profile update if cache invalidation fails
      }

      if (updatedProfiles.length === 0) {
        // Create new profile if doesn't exist
        const createdProfiles = await db
          .insert(financialProfiles)
          .values({ ...preparedData, userId })
          .returning();

        if (createdProfiles.length > 0) {
          const created = createdProfiles[0];
          // Backfill user's full name from intake first/last name
          try {
            const first = (created as any).firstName?.toString().trim() || '';
            const last = (created as any).lastName?.toString().trim() || '';
            const fullName = `${first} ${last}`.trim();
            if (fullName) {
              await db.update(users).set({ fullName }).where(eq(users.id, userId));
            }
          } catch (e) {
            console.warn('Failed to backfill users.full_name (create):', e);
          }
          return this.parseProfileJsonFields(created);
        }
        throw new Error('Failed to create financial profile');
      }

      const updated = updatedProfiles[0];
      // Backfill user's full name from intake first/last name
      try {
        const first = (updated as any).firstName?.toString().trim() || '';
        const last = (updated as any).lastName?.toString().trim() || '';
        const fullName = `${first} ${last}`.trim();
        if (fullName) {
          await db.update(users).set({ fullName }).where(eq(users.id, userId));
        }
      } catch (e) {
        console.warn('Failed to backfill users.full_name (update):', e);
      }
      return this.parseProfileJsonFields(updated);
    });
  }

  async getRothConversionAnalysis(userId: number): Promise<RothConversionAnalysis | undefined> {
    const [record] = await db
      .select()
      .from(rothConversionAnalyses)
      .where(eq(rothConversionAnalyses.userId, userId))
      .limit(1);

    return record || undefined;
  }

  async saveRothConversionAnalysis(userId: number, analysis: unknown): Promise<RothConversionAnalysis> {
    let normalized = analysis;
    if (typeof analysis === 'string') {
      try {
        normalized = JSON.parse(analysis);
      } catch (error) {
        console.warn('[saveRothConversionAnalysis] Failed to parse string analysis payload, storing raw string');
      }
    }

    const now = new Date();
    const payload: InsertRothConversionAnalysis = {
      userId,
      analysis: normalized as any,
      createdAt: now,
      updatedAt: now,
    };

    const [record] = await db
      .insert(rothConversionAnalyses)
      .values(payload)
      .onConflictDoUpdate({
        target: rothConversionAnalyses.userId,
        set: {
          analysis: payload.analysis,
          updatedAt: now,
        },
      })
      .returning();

    return record;
  }

  async deleteRothConversionAnalysis(userId: number): Promise<void> {
    await db
      .delete(rothConversionAnalyses)
      .where(eq(rothConversionAnalyses.userId, userId));
  }

  private parseProfileJsonFields(profile: any): FinancialProfile {
    // Parse JSON fields that might be stored as strings
    const jsonFields = [
      'assets', 'liabilities', 'realEstate', 'monthlyExpenses', 'insurance', 
      'calculations', 'lifeGoals', 'riskQuestionnaire', 'estatePlanning', 
      'taxReturns', 'taxRecommendations', 'primaryResidence', 'additionalProperties', 'lifeInsurance',
      'spouseLifeInsurance', 'healthInsurance', 'disabilityInsurance', 
      'spouseDisabilityInsurance', 'goals', 'currentAllocation', 'spouseAllocation',
      'riskQuestions', 'spouseRiskQuestions', 'retirementPlanningData', 'monteCarloSimulation', 'optimizationVariables',
      // Self-employed JSON fields
      'selfEmployedData', 'quarterlyTaxPayments',
      // Retirement JSON fields
      'retirementExpenseBudget', 'retirementContributions', 'spouseRetirementContributions'
    ];

    jsonFields.forEach(field => {
      if (profile[field] && typeof profile[field] === 'string') {
        try {
          profile[field] = JSON.parse(profile[field]);
        } catch (e) {
          console.warn(`Failed to parse JSON field ${field}:`, e);
          profile[field] = null;
        }
      }
    });

    return profile;
  }

  async getChatMessages(userId: number): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(chatMessages.timestamp);
  }

  async createChatMessage(userId: number, message: InsertChatMessage): Promise<ChatMessage> {
    const [chatMessage] = await db
      .insert(chatMessages)
      .values({ ...message, userId })
      .returning();
    return chatMessage;
  }

  async updateChatMessage(messageId: number, updates: Partial<InsertChatMessage>): Promise<ChatMessage> {
    const [chatMessage] = await db
      .update(chatMessages)
      .set(updates)
      .where(eq(chatMessages.id, messageId))
      .returning();
    return chatMessage;
  }

  // Chat documents methods
  async createChatDocument(document: InsertChatDocument): Promise<ChatDocument> {
    const [chatDocument] = await db
      .insert(chatDocuments)
      .values(document)
      .returning();
    return chatDocument;
  }

  async getChatDocuments(messageId: number): Promise<ChatDocument[]> {
    return await db
      .select()
      .from(chatDocuments)
      .where(eq(chatDocuments.messageId, messageId))
      .orderBy(chatDocuments.uploadedAt);
  }

  async getChatDocument(documentId: number, userId: number): Promise<ChatDocument | undefined> {
    const [document] = await db
      .select()
      .from(chatDocuments)
      .where(and(eq(chatDocuments.id, documentId), eq(chatDocuments.userId, userId)));
    return document;
  }

  async getUserChatDocuments(userId: number): Promise<ChatDocument[]> {
    return await db
      .select()
      .from(chatDocuments)
      .where(eq(chatDocuments.userId, userId))
      .orderBy(chatDocuments.uploadedAt);
  }

  async createSharedVaultFile(file: InsertSharedVaultFile): Promise<SharedVaultFile> {
    const [created] = await db
      .insert(sharedVaultFiles)
      .values(file)
      .returning();
    return created as SharedVaultFile;
  }

  async listSharedVaultFiles(ownerClientId: number): Promise<SharedVaultFileWithUploader[]> {
    const rows = await db
      .select({
        file: sharedVaultFiles,
        uploaderEmail: users.email,
        uploaderName: users.fullName,
      })
      .from(sharedVaultFiles)
      .leftJoin(users, eq(sharedVaultFiles.uploaderId, users.id))
      .where(eq(sharedVaultFiles.ownerClientId, ownerClientId))
      .orderBy(desc(sharedVaultFiles.createdAt));

    return rows.map((row) => ({
      ...row.file,
      uploaderEmail: row.uploaderEmail ?? null,
      uploaderName: row.uploaderName ?? null,
    }));
  }

  async getSharedVaultFileById(fileId: number): Promise<SharedVaultFile | undefined> {
    const [file] = await db
      .select()
      .from(sharedVaultFiles)
      .where(eq(sharedVaultFiles.id, fileId));
    return (file as SharedVaultFile) || undefined;
  }

  async deleteSharedVaultFile(fileId: number): Promise<void> {
    await db.delete(sharedVaultFiles).where(eq(sharedVaultFiles.id, fileId));
  }

  async getActiveAdvisorsForClient(clientId: number): Promise<AdvisorClient[]> {
    const rows = await db
      .select()
      .from(advisorClients)
      .where(and(eq(advisorClients.clientId, clientId), eq(advisorClients.status, 'active')));
    return rows as AdvisorClient[];
  }

  async deleteFinancialProfile(userId: number): Promise<void> {
    await db
      .delete(financialProfiles)
      .where(eq(financialProfiles.userId, userId));
  }

  async deleteChatMessages(userId: number): Promise<void> {
    // First delete chat documents (cascade will handle this, but we'll be explicit)
    await db
      .delete(chatDocuments)
      .where(eq(chatDocuments.userId, userId));
      
    // Then delete chat messages
    await db
      .delete(chatMessages)
      .where(eq(chatMessages.userId, userId));
  }

  async deleteAllUserData(userId: number): Promise<void> {
    console.log(`🧹 Starting comprehensive data deletion for user ${userId}`);
    
    try {
      // Delete in order to respect foreign key constraints
      
      // 1. Delete Chat Data
      await db.delete(chatDocuments).where(eq(chatDocuments.userId, userId));
      await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
      console.log('✅ Deleted chat data');
      
      // 2. Delete Goal Data
      await db.delete(goalTasks).where(eq(goalTasks.userId, userId));
      await db.delete(goalAuditLog).where(eq(goalAuditLog.userId, userId));
      await db.delete(goals).where(eq(goals.userId, userId));
      await db.delete(lifeGoalsTable).where(eq(lifeGoalsTable.userId, userId));
      console.log('✅ Deleted goals data');
      
      // 3. Delete Estate Planning Data
      await db.delete(estateScenarios).where(eq(estateScenarios.userId, userId));
      await db.delete(estateTrusts).where(eq(estateTrusts.userId, userId));
      await db.delete(estateBeneficiaries).where(eq(estateBeneficiaries.userId, userId));
      await db.delete(estateDocuments).where(eq(estateDocuments.userId, userId));
      await db.delete(estatePlans).where(eq(estatePlans.userId, userId));
      console.log('✅ Deleted estate planning data');
      
      // 4. Delete Education Planning Data
      await db.delete(educationScenarios).where(eq(educationScenarios.userId, userId));
      await db.delete(educationGoals).where(eq(educationGoals.userId, userId));
      console.log('✅ Deleted education planning data');
      
      // 5. Delete Debt Management Data
      await db.delete(debtAIInsights).where(eq(debtAIInsights.userId, userId));
      await db.delete(debtMilestones).where(eq(debtMilestones.userId, userId));
      await db.delete(debtPayments).where(eq(debtPayments.userId, userId));
      await db.delete(debtScenarios).where(eq(debtScenarios.userId, userId));
      await db.delete(debtPayoffPlans).where(eq(debtPayoffPlans.userId, userId));
      await db.delete(debts).where(eq(debts.userId, userId));
      console.log('✅ Deleted debt management data');
      
      // 6. Delete Plaid Connection Data (important - removes bank connections)
      await db.delete(plaidTransactions).where(eq(plaidTransactions.userId, userId));
      await db.delete(plaidInvestmentHoldings).where(eq(plaidInvestmentHoldings.userId, userId));
      await db.delete(plaidLiabilities).where(eq(plaidLiabilities.userId, userId));
      await db.delete(plaidAccounts).where(eq(plaidAccounts.userId, userId));
      await db.delete(plaidAccountMappings).where(eq(plaidAccountMappings.userId, userId));
      await db.delete(plaidAggregatedSnapshot).where(eq(plaidAggregatedSnapshot.userId, userId));
      await db.delete(plaidSyncSchedule).where(eq(plaidSyncSchedule.userId, userId));
      await db.delete(plaidSyncStatus).where(eq(plaidSyncStatus.userId, userId));
      await db.delete(plaidItems).where(eq(plaidItems.userId, userId));
      console.log('✅ Deleted Plaid connection data');
      
      // 7. Delete Caching Data
      await db.delete(investmentCache).where(eq(investmentCache.userId, userId));
      await db.delete(widgetCache).where(eq(widgetCache.userId, userId));
      await db.delete(dashboardInsights).where(eq(dashboardInsights.userId, userId));
      console.log('✅ Deleted cache data');
      
      // 8. Delete Reports
      await db.delete(reportSnapshots).where(eq(reportSnapshots.userId, userId));
      await db.delete(reportLayouts).where(eq(reportLayouts.userId, userId));
      await db.delete(pdfReports).where(eq(pdfReports.userId, userId));
      console.log('✅ Deleted report data');
      
      // 9. Delete Gamification Data
      await db.delete(actionPlanTasks).where(eq(actionPlanTasks.userId, userId));
      await db.delete(sectionProgress).where(eq(sectionProgress.userId, userId));
      await db.delete(userAchievements).where(eq(userAchievements.userId, userId));
      await db.delete(userProgress).where(eq(userProgress.userId, userId));
      console.log('✅ Deleted gamification data');
      
      // 10. Delete Audit and Security Data (optional - for privacy)
      await db.delete(auditLogs).where(eq(auditLogs.userId, userId));
      await db.delete(dataAccessLogs).where(eq(dataAccessLogs.userId, userId));
      await db.delete(securityEvents).where(eq(securityEvents.userId, userId));
      console.log('✅ Deleted audit and security logs');
      
      // 11. Delete Financial Profile (main data)
      await db.delete(financialProfiles).where(eq(financialProfiles.userId, userId));
      console.log('✅ Deleted financial profile');
      
      console.log(`🎉 Comprehensive data deletion completed for user ${userId}`);
    } catch (error) {
      console.error(`❌ Error during comprehensive data deletion for user ${userId}:`, error);
      throw error;
    }
  }

  async getInvestmentCache(userId: number, category: string): Promise<InvestmentCache | undefined> {
    try {
      const now = new Date();
      const [cache] = await db
        .select()
        .from(investmentCache)
        .where(
          and(
            eq(investmentCache.userId, userId),
            eq(investmentCache.category, category),
            gt(investmentCache.expiresAt, now)
          )
        );
      return cache || undefined;
    } catch (e: any) {
      const msg = (e?.message || '').toString();
      if (e?.code === '42703' || /column\s+data\s+does\s+not\s+exist/i.test(msg)) {
        try { await db.execute(sql`ALTER TABLE IF NOT EXISTS investment_cache ADD COLUMN IF NOT EXISTS data JSONB;`); } catch {}
        try { await db.execute(sql`ALTER TABLE IF NOT EXISTS investment_cache ADD COLUMN IF NOT EXISTS category TEXT;`); } catch {}
        // Retry once
        try {
          const now = new Date();
          const [cache] = await db
            .select()
            .from(investmentCache)
            .where(
              and(
                eq(investmentCache.userId, userId),
                eq(investmentCache.category, category),
                gt(investmentCache.expiresAt, now)
              )
            );
          return cache || undefined;
        } catch {}
      }
      console.warn('getInvestmentCache failed:', msg);
      return undefined;
    }
  }

  async setInvestmentCache(userId: number, category: string, data: any, ttlHours: number = 6): Promise<InvestmentCache> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
      await db
        .delete(investmentCache)
        .where(and(eq(investmentCache.userId, userId), eq(investmentCache.category, category)));
      const [cache] = await db
        .insert(investmentCache)
        .values({ userId, category, data, expiresAt })
        .returning();
      return cache;
    } catch (e: any) {
      const msg = (e?.message || '').toString();
      if (e?.code === '42703' || /column\s+data\s+does\s+not\s+exist/i.test(msg)) {
        try { await db.execute(sql`ALTER TABLE IF NOT EXISTS investment_cache ADD COLUMN IF NOT EXISTS data JSONB;`); } catch {}
        try { await db.execute(sql`ALTER TABLE IF NOT EXISTS investment_cache ADD COLUMN IF NOT EXISTS category TEXT;`); } catch {}
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
        await db
          .delete(investmentCache)
          .where(and(eq(investmentCache.userId, userId), eq(investmentCache.category, category)));
        const [cache] = await db
          .insert(investmentCache)
          .values({ userId, category, data, expiresAt })
          .returning();
        return cache;
      }
      console.warn('setInvestmentCache failed:', msg);
      return { id: -1, userId, category, data, lastUpdated: new Date(), expiresAt: new Date(Date.now() + ttlHours * 3600 * 1000) } as any;
    }
  }

  // Goals methods
  async getGoals(userId: number): Promise<Goal[]> {
    try {
      const userGoals = await db
        .select()
        .from(goals)
        .where(eq(goals.userId, userId))
        .orderBy(asc(goals.priority));
      return userGoals;
    } catch (e: any) {
      const msg = (e?.message || '').toString();
      if (e?.code === '42703' || /inflation_assumption_pct|funding_source_account_ids/i.test(msg)) {
        try { await db.execute(sql`ALTER TABLE IF EXISTS goals ADD COLUMN IF NOT EXISTS inflation_assumption_pct DECIMAL(5,2) DEFAULT 2.5;`); } catch {}
        try { await db.execute(sql`ALTER TABLE IF NOT EXISTS goals ADD COLUMN IF NOT EXISTS funding_source_account_ids JSONB;`); } catch {}
        try {
          const userGoals = await db
            .select()
            .from(goals)
            .where(eq(goals.userId, userId))
            .orderBy(asc(goals.priority));
          return userGoals;
        } catch {}
      }
      console.warn('getGoals failed:', msg);
      return [] as any[];
    }
  }

  async getGoal(userId: number, goalId: number): Promise<Goal | undefined> {
    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.id, goalId)));
    
    return goal || undefined;
  }

  async createGoal(userId: number, goal: InsertGoal): Promise<Goal> {
    // Convert date string to Date object if needed
    const goalData = {
      ...goal,
      userId,
      targetDate: goal.targetDate instanceof Date ? goal.targetDate : new Date(goal.targetDate)
    };
    
    const [created] = await db
      .insert(goals)
      .values(goalData)
      .returning();
    
    return created;
  }

  async updateGoal(userId: number, goalId: number, data: Partial<InsertGoal>): Promise<Goal> {
    // Convert date string to Date object if needed
    const updateData: any = {
      ...data,
      updatedAt: new Date()
    };
    
    if (data.targetDate) {
      updateData.targetDate = data.targetDate instanceof Date ? data.targetDate : new Date(data.targetDate);
    }
    
    const [updated] = await db
      .update(goals)
      .set(updateData)
      .where(and(eq(goals.userId, userId), eq(goals.id, goalId)))
      .returning();
    
    if (!updated) {
      throw new Error('Goal not found');
    }
    
    return updated;
  }

  async deleteGoal(userId: number, goalId: number): Promise<void> {
    await db
      .delete(goals)
      .where(and(eq(goals.userId, userId), eq(goals.id, goalId)));
  }

  // Goal Tasks methods
  async getGoalTasks(userId: number, goalId: number): Promise<GoalTask[]> {
    const tasks = await db
      .select()
      .from(goalTasks)
      .where(and(eq(goalTasks.userId, userId), eq(goalTasks.goalId, goalId)))
      .orderBy(asc(goalTasks.dueDate));
    
    return tasks;
  }

  async getGoalTask(userId: number, taskId: number): Promise<GoalTask | undefined> {
    const [task] = await db
      .select()
      .from(goalTasks)
      .where(and(eq(goalTasks.userId, userId), eq(goalTasks.id, taskId)));
    
    return task || undefined;
  }

  async createGoalTask(userId: number, goalId: number, task: InsertGoalTask): Promise<GoalTask> {
    // Convert date string to Date object if needed
    const taskData: any = {
      ...task,
      userId,
      goalId
    };
    
    if (task.dueDate) {
      taskData.dueDate = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
    }
    
    const [created] = await db
      .insert(goalTasks)
      .values(taskData)
      .returning();
    
    return created;
  }

  async updateGoalTask(userId: number, taskId: number, data: Partial<InsertGoalTask>): Promise<GoalTask> {
    // Handle status change to completed
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    if (data.dueDate) {
      updateData.dueDate = data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate);
    }
    
    const [updated] = await db
      .update(goalTasks)
      .set(updateData)
      .where(and(eq(goalTasks.userId, userId), eq(goalTasks.id, taskId)))
      .returning();
    
    if (!updated) {
      throw new Error('Task not found');
    }
    
    return updated;
  }

  async deleteGoalTask(userId: number, taskId: number): Promise<void> {
    await db
      .delete(goalTasks)
      .where(and(eq(goalTasks.userId, userId), eq(goalTasks.id, taskId)));
  }

  // Audit log
  async createGoalAuditLog(log: Partial<GoalAuditLog>): Promise<GoalAuditLog> {
    const [created] = await db
      .insert(goalAuditLog)
      .values(log as any)
      .returning();
    
    return created;
  }

  // Estate Planning methods
  async getEstatePlan(userId: number): Promise<EstatePlan | undefined> {
    const [plan] = await db
      .select()
      .from(estatePlans)
      .where(eq(estatePlans.userId, userId))
      .orderBy(desc(estatePlans.updatedAt));
    
    return plan || undefined;
  }

  async createEstatePlan(userId: number, plan: InsertEstatePlan): Promise<EstatePlan> {
    const [created] = await db
      .insert(estatePlans)
      .values({ ...plan, userId })
      .returning();
    
    return created;
  }

  async updateEstatePlan(userId: number, planId: number, data: Partial<InsertEstatePlan>): Promise<EstatePlan> {
    const [updated] = await db
      .update(estatePlans)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(estatePlans.userId, userId), eq(estatePlans.id, planId)))
      .returning();
    
    if (!updated) {
      throw new Error('Estate plan not found');
    }
    
    return updated;
  }

  async deleteEstatePlan(userId: number, planId: number): Promise<void> {
    await db
      .delete(estatePlans)
      .where(and(eq(estatePlans.userId, userId), eq(estatePlans.id, planId)));
  }

  // Estate Documents
  async getEstateDocuments(userId: number, estatePlanId?: number): Promise<EstateDocument[]> {
    if (estatePlanId) {
      return await db
        .select()
        .from(estateDocuments)
        .where(and(eq(estateDocuments.userId, userId), eq(estateDocuments.estatePlanId, estatePlanId)))
        .orderBy(asc(estateDocuments.documentType));
    }
    
    return await db
      .select()
      .from(estateDocuments)
      .where(eq(estateDocuments.userId, userId))
      .orderBy(estateDocuments.documentType);
  }

  async getEstateDocument(userId: number, documentId: number): Promise<EstateDocument | undefined> {
    const [document] = await db
      .select()
      .from(estateDocuments)
      .where(and(eq(estateDocuments.userId, userId), eq(estateDocuments.id, documentId)));
    
    return document || undefined;
  }

  async createEstateDocument(userId: number, document: InsertEstateDocument): Promise<EstateDocument> {
    // Convert date strings to Date objects for timestamp columns
    const documentData = {
      ...document,
      userId,
      executionDate: document.executionDate ? new Date(document.executionDate) : null,
      expirationDate: document.expirationDate ? new Date(document.expirationDate) : null,
      lastReviewDate: document.lastReviewDate ? new Date(document.lastReviewDate) : null,
    };
    
    const [created] = await db
      .insert(estateDocuments)
      .values(documentData)
      .returning();
    
    return created;
  }

  async updateEstateDocument(userId: number, documentId: number, data: Partial<InsertEstateDocument>): Promise<EstateDocument> {
    // Convert date strings to Date objects for timestamp columns
    const updateData = {
      ...data,
      executionDate: data.executionDate ? new Date(data.executionDate) : data.executionDate,
      expirationDate: data.expirationDate ? new Date(data.expirationDate) : data.expirationDate,
      lastReviewDate: data.lastReviewDate ? new Date(data.lastReviewDate) : data.lastReviewDate,
      updatedAt: new Date()
    };
    
    const [updated] = await db
      .update(estateDocuments)
      .set(updateData)
      .where(and(eq(estateDocuments.userId, userId), eq(estateDocuments.id, documentId)))
      .returning();
    
    if (!updated) {
      throw new Error('Estate document not found');
    }
    
    return updated;
  }

  async deleteEstateDocument(userId: number, documentId: number): Promise<void> {
    await db
      .delete(estateDocuments)
      .where(and(eq(estateDocuments.userId, userId), eq(estateDocuments.id, documentId)));
  }

  // Advisor branding (white label)
  async getWhiteLabelProfile(advisorId: number): Promise<WhiteLabelProfile | undefined> {
    const [row] = await db.select().from(whiteLabelProfiles).where(eq(whiteLabelProfiles.advisorId, advisorId));
    return row || undefined;
  }

  async upsertWhiteLabelProfile(advisorId: number, data: Partial<InsertWhiteLabelProfile>): Promise<WhiteLabelProfile> {
    const existing = await this.getWhiteLabelProfile(advisorId);
    if (existing) {
      const updatePayload: Record<string, any> = { ...data, updatedAt: new Date() };
      if (!('logoUrl' in data)) {
        delete updatePayload.logoUrl;
      }
      const [updated] = await db
        .update(whiteLabelProfiles)
        .set(updatePayload as any)
        .where(eq(whiteLabelProfiles.advisorId, advisorId))
        .returning();
      return updated;
    } else {
      const insertPayload: Record<string, any> = { ...data, advisorId };
      if (!('logoUrl' in data)) {
        insertPayload.logoUrl = null;
      }
      const [created] = await db
        .insert(whiteLabelProfiles)
        .values(insertPayload)
        .returning();
      return created;
    }
  }

  // Report builder persistence
  async getReportLayout(userId: number): Promise<ReportLayout | undefined> {
    const [row] = await db.select().from(reportLayouts).where(eq(reportLayouts.userId, userId));
    return row || undefined;
  }

  async saveReportLayout(userId: number, data: InsertReportLayout): Promise<ReportLayout> {
    const existing = await this.getReportLayout(userId);
    if (existing) {
      const updatePayload: any = { updatedAt: new Date() };
      if (data.layout) updatePayload.layout = data.layout;
      if (data.insightsSectionTitle !== undefined) updatePayload.insightsSectionTitle = data.insightsSectionTitle;
      if (data.draftInsights !== undefined) updatePayload.draftInsights = data.draftInsights;
      const [updated] = await db
        .update(reportLayouts)
        .set(updatePayload)
        .where(eq(reportLayouts.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(reportLayouts)
        .values({ ...data, userId })
        .returning();
      return created;
    }
  }

  async saveDraftInsights(
    userId: number,
    insights: Array<{ id?: string; text: string; order: number; isCustom?: boolean }>,
  ): Promise<void> {
    const normalized = Array.isArray(insights)
      ? insights.map((ins, idx) => ({
          id: ins.id,
          text: (ins.text ?? '').toString().trim(),
          order: Number.isFinite(ins.order) ? ins.order : idx,
          isCustom: Boolean(ins.isCustom),
        }))
      : [];

    const existing = await this.getReportLayout(userId);
    const payload = { draftInsights: normalized, updatedAt: new Date() } as any;

    if (existing) {
      await db
        .update(reportLayouts)
        .set(payload)
        .where(eq(reportLayouts.userId, userId));
    } else {
      await db.insert(reportLayouts).values({
        userId,
        insightsSectionTitle: 'Insights',
        draftInsights: normalized,
      });
    }
  }

  async createReportSnapshot(userId: number, snapshot: Omit<InsertReportSnapshot, 'userId'> & { advisorId?: number | null }): Promise<ReportSnapshot> {
    const [created] = await db
      .insert(reportSnapshots)
      .values({ ...snapshot, userId } as any)
      .returning();
    return created;
  }

  async getReportSnapshot(userId: number, snapshotId: number): Promise<ReportSnapshot | undefined> {
    const [row] = await db
      .select()
      .from(reportSnapshots)
      .where(and(eq(reportSnapshots.userId, userId), eq(reportSnapshots.id, snapshotId)));
    return row || undefined;
  }

  async getReportSnapshotById(snapshotId: number): Promise<ReportSnapshot | undefined> {
    const [row] = await db
      .select()
      .from(reportSnapshots)
      .where(eq(reportSnapshots.id, snapshotId));
    return row || undefined;
  }

  async getLatestReportSnapshot(userId: number): Promise<ReportSnapshot | undefined> {
    const rows = await db
      .select()
      .from(reportSnapshots)
      .where(eq(reportSnapshots.userId, userId))
      .orderBy(desc(reportSnapshots.createdAt))
      .limit(1);
    return rows[0] || undefined;
  }

  // Estate Beneficiaries
  async getEstateBeneficiaries(userId: number, estatePlanId?: number): Promise<EstateBeneficiary[]> {
    if (estatePlanId) {
      return await db
        .select()
        .from(estateBeneficiaries)
        .where(and(eq(estateBeneficiaries.userId, userId), eq(estateBeneficiaries.estatePlanId, estatePlanId)))
        .orderBy(desc(estateBeneficiaries.isPrimary));
    }
    
    return await db
      .select()
      .from(estateBeneficiaries)
      .where(eq(estateBeneficiaries.userId, userId))
      .orderBy(estateBeneficiaries.isPrimary);
  }

  async getEstateBeneficiary(userId: number, beneficiaryId: number): Promise<EstateBeneficiary | undefined> {
    const [beneficiary] = await db
      .select()
      .from(estateBeneficiaries)
      .where(and(eq(estateBeneficiaries.userId, userId), eq(estateBeneficiaries.id, beneficiaryId)));
    
    return beneficiary || undefined;
  }

  async createEstateBeneficiary(userId: number, beneficiary: InsertEstateBeneficiary): Promise<EstateBeneficiary> {
    // Convert date strings to Date objects for timestamp columns
    const beneficiaryData = {
      ...beneficiary,
      userId,
      dateOfBirth: beneficiary.dateOfBirth ? new Date(beneficiary.dateOfBirth) : null,
    };
    
    const [created] = await db
      .insert(estateBeneficiaries)
      .values(beneficiaryData)
      .returning();
    
    return created;
  }

  async updateEstateBeneficiary(userId: number, beneficiaryId: number, data: Partial<InsertEstateBeneficiary>): Promise<EstateBeneficiary> {
    // Convert date strings to Date objects for timestamp columns
    const updateData: any = {
      ...data,
      updatedAt: new Date()
    };
    
    // Handle dateOfBirth conversion if present
    if (data.dateOfBirth !== undefined) {
      updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth as any) : null;
    }
    
    const [updated] = await db
      .update(estateBeneficiaries)
      .set(updateData)
      .where(and(eq(estateBeneficiaries.userId, userId), eq(estateBeneficiaries.id, beneficiaryId)))
      .returning();
    
    if (!updated) {
      throw new Error('Estate beneficiary not found');
    }
    
    return updated;
  }

  async deleteEstateBeneficiary(userId: number, beneficiaryId: number): Promise<void> {
    await db
      .delete(estateBeneficiaries)
      .where(and(eq(estateBeneficiaries.userId, userId), eq(estateBeneficiaries.id, beneficiaryId)));
  }

  // Estate Trusts
  async getEstateTrusts(userId: number, estatePlanId?: number): Promise<EstateTrust[]> {
    if (estatePlanId) {
      return await db
        .select()
        .from(estateTrusts)
        .where(and(eq(estateTrusts.userId, userId), eq(estateTrusts.estatePlanId, estatePlanId)))
        .orderBy(asc(estateTrusts.trustName));
    }
    
    return await db
      .select()
      .from(estateTrusts)
      .where(eq(estateTrusts.userId, userId))
      .orderBy(estateTrusts.trustName);
  }

  async getEstateTrust(userId: number, trustId: number): Promise<EstateTrust | undefined> {
    const [trust] = await db
      .select()
      .from(estateTrusts)
      .where(and(eq(estateTrusts.userId, userId), eq(estateTrusts.id, trustId)));
    
    return trust || undefined;
  }

  async createEstateTrust(userId: number, trust: InsertEstateTrust): Promise<EstateTrust> {
    const [created] = await db
      .insert(estateTrusts)
      .values({ ...trust, userId })
      .returning();
    
    return created;
  }

  async updateEstateTrust(userId: number, trustId: number, data: Partial<InsertEstateTrust>): Promise<EstateTrust> {
    const [updated] = await db
      .update(estateTrusts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(estateTrusts.userId, userId), eq(estateTrusts.id, trustId)))
      .returning();
    
    if (!updated) {
      throw new Error('Estate trust not found');
    }
    
    return updated;
  }

  async deleteEstateTrust(userId: number, trustId: number): Promise<void> {
    await db
      .delete(estateTrusts)
      .where(and(eq(estateTrusts.userId, userId), eq(estateTrusts.id, trustId)));
  }

  // Estate Scenarios
  async getEstateScenarios(userId: number, estatePlanId?: number): Promise<EstateScenario[]> {
    if (estatePlanId) {
      return await db
        .select()
        .from(estateScenarios)
        .where(and(eq(estateScenarios.userId, userId), eq(estateScenarios.estatePlanId, estatePlanId)))
        .orderBy(desc(estateScenarios.isBaseline));
    }
    
    return await db
      .select()
      .from(estateScenarios)
      .where(eq(estateScenarios.userId, userId))
      .orderBy(estateScenarios.isBaseline);
  }

  async getEstateScenario(userId: number, scenarioId: number): Promise<EstateScenario | undefined> {
    const [scenario] = await db
      .select()
      .from(estateScenarios)
      .where(and(eq(estateScenarios.userId, userId), eq(estateScenarios.id, scenarioId)));
    
    return scenario || undefined;
  }

  async createEstateScenario(userId: number, scenario: InsertEstateScenario): Promise<EstateScenario> {
    const [created] = await db
      .insert(estateScenarios)
      .values({ ...scenario, userId })
      .returning();
    
    return created;
  }

  async updateEstateScenario(userId: number, scenarioId: number, data: Partial<InsertEstateScenario>): Promise<EstateScenario> {
    const [updated] = await db
      .update(estateScenarios)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(estateScenarios.userId, userId), eq(estateScenarios.id, scenarioId)))
      .returning();
    
    if (!updated) {
      throw new Error('Estate scenario not found');
    }
    
    return updated;
  }

  async deleteEstateScenario(userId: number, scenarioId: number): Promise<void> {
    await db
      .delete(estateScenarios)
      .where(and(eq(estateScenarios.userId, userId), eq(estateScenarios.id, scenarioId)));
  }

  // Education Goals Implementation
  async getEducationGoals(userId: number): Promise<EducationGoal[]> {
    return await db
      .select()
      .from(educationGoals)
      .where(eq(educationGoals.userId, userId))
      .orderBy(asc(educationGoals.startYear));
  }

  async getEducationGoal(userId: number, goalId: number): Promise<EducationGoal | undefined> {
    const [goal] = await db
      .select()
      .from(educationGoals)
      .where(and(eq(educationGoals.userId, userId), eq(educationGoals.id, goalId)));
    return goal || undefined;
  }

  async createEducationGoal(userId: number, goal: InsertEducationGoal): Promise<EducationGoal> {
    const [newGoal] = await db
      .insert(educationGoals)
      .values({ ...goal, userId })
      .returning();
    return newGoal;
  }

  async updateEducationGoal(userId: number, goalId: number, data: Partial<InsertEducationGoal>): Promise<EducationGoal> {
    const [updated] = await db
      .update(educationGoals)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(educationGoals.userId, userId), eq(educationGoals.id, goalId)))
      .returning();
    if (!updated) throw new Error("Education goal not found");
    return updated;
  }

  async deleteEducationGoal(userId: number, goalId: number): Promise<void> {
    await db
      .delete(educationGoals)
      .where(and(eq(educationGoals.userId, userId), eq(educationGoals.id, goalId)));
  }
  
  // Life Goals Implementation
  async getLifeGoals(userId: number): Promise<any[]> {
    const goals = await db
      .select()
      .from(lifeGoalsTable)
      .where(eq(lifeGoalsTable.userId, userId));
    
    // Parse JSON fields
    return goals.map(goal => ({
      ...goal,
      fundingSources: typeof goal.fundingSources === 'string' ? 
        JSON.parse(goal.fundingSources) : goal.fundingSources,
      metadata: typeof goal.metadata === 'string' ? 
        JSON.parse(goal.metadata) : goal.metadata
    }));
  }

  async getLifeGoal(userId: number, goalId: number): Promise<any | undefined> {
    const [goal] = await db
      .select()
      .from(lifeGoalsTable)
      .where(and(eq(lifeGoalsTable.userId, userId), eq(lifeGoalsTable.id, goalId)));
    
    if (!goal) return undefined;
    
    return {
      ...goal,
      fundingSources: typeof goal.fundingSources === 'string' ? 
        JSON.parse(goal.fundingSources) : goal.fundingSources,
      metadata: typeof goal.metadata === 'string' ? 
        JSON.parse(goal.metadata) : goal.metadata
    };
  }

  async createLifeGoal(userId: number, goal: any): Promise<any> {
    console.log('Raw goal data received:', goal);
    console.log('fundingSources type:', typeof goal.fundingSources, 'value:', goal.fundingSources);
    console.log('metadata type:', typeof goal.metadata, 'value:', goal.metadata);

    // Enhanced safe stringify function
    const safeStringify = (obj: any, fieldName: string): string => {
      console.log(`Processing ${fieldName}:`, obj, 'type:', typeof obj);
      
      if (obj === null || obj === undefined) {
        console.log(`${fieldName} is null/undefined, returning empty array/object`);
        return fieldName === 'fundingSources' ? '[]' : '{}';
      }
      
      if (typeof obj === 'string') {
        try {
          JSON.parse(obj);
          console.log(`${fieldName} is valid JSON string`);
          return obj;
        } catch {
          console.log(`${fieldName} is non-JSON string, wrapping in JSON`);
          return fieldName === 'fundingSources' ? '[]' : '{}';
        }
      }
      
      if (typeof obj === 'object') {
        try {
          const stringified = JSON.stringify(obj);
          console.log(`${fieldName} stringified successfully:`, stringified);
          return stringified;
        } catch (e) {
          console.error(`Failed to stringify ${fieldName}:`, e);
          return fieldName === 'fundingSources' ? '[]' : '{}';
        }
      }
      
      console.log(`${fieldName} has unexpected type, returning default`);
      return fieldName === 'fundingSources' ? '[]' : '{}';
    };

    const fundingSourcesVal = ((): any => {
      if (goal.fundingSources === null || goal.fundingSources === undefined) return [];
      if (typeof goal.fundingSources === 'string') {
        try { return JSON.parse(goal.fundingSources); } catch { return []; }
      }
      return goal.fundingSources;
    })();
    const metadataVal = ((): any => {
      if (goal.metadata === null || goal.metadata === undefined) return {};
      if (typeof goal.metadata === 'string') {
        try { return JSON.parse(goal.metadata); } catch { return {}; }
      }
      return goal.metadata;
    })();
    
    // Log normalized values (avoid referencing undefined vars)
    console.log("Final fundingSources value:", fundingSourcesVal);
    console.log("Final metadata value:", metadataVal);

    const [created] = await db
      .insert(lifeGoalsTable)
      .values({
        ...goal,
        userId,
        // Store as JSONB in DB
        fundingSources: fundingSourcesVal,
        metadata: metadataVal
      })
      .returning();
    
    // Safely handle both string and object return types from PG driver
    const parsedFundingSources = typeof (created as any).fundingSources === 'string'
      ? JSON.parse((created as any).fundingSources as any)
      : (created as any).fundingSources;
    const parsedMetadata = typeof (created as any).metadata === 'string'
      ? JSON.parse((created as any).metadata as any)
      : (created as any).metadata;

    return {
      ...created,
      fundingSources: parsedFundingSources,
      metadata: parsedMetadata,
    };
  }

  async updateLifeGoal(userId: number, goalId: number, data: any): Promise<any> {
    const updateData: any = { ...data };

    // Normalize jsonb fields to objects (not JSON strings) for insertion
    if (data.fundingSources !== undefined) {
      updateData.fundingSources = typeof data.fundingSources === 'string'
        ? (() => { try { return JSON.parse(data.fundingSources); } catch { return []; } })()
        : (data.fundingSources ?? []);
    }

    if (data.metadata !== undefined) {
      updateData.metadata = typeof data.metadata === 'string'
        ? (() => { try { return JSON.parse(data.metadata); } catch { return {}; } })()
        : (data.metadata ?? {});
    }
    
    const [updated] = await db
      .update(lifeGoalsTable)
      .set(updateData)
      .where(and(eq(lifeGoalsTable.userId, userId), eq(lifeGoalsTable.id, goalId)))
      .returning();
    
    if (!updated) throw new Error("Life goal not found");
    
    return {
      ...updated,
      fundingSources: JSON.parse(updated.fundingSources as string),
      metadata: JSON.parse(updated.metadata as string)
    };
  }

  async deleteLifeGoal(userId: number, goalId: number): Promise<void> {
    await db
      .delete(lifeGoalsTable)
      .where(and(eq(lifeGoalsTable.userId, userId), eq(lifeGoalsTable.id, goalId)));
  }

  // Advisor linking & invites
  async getAdvisorClients(advisorId: number): Promise<Array<{ id: number; email: string; fullName: string | null; status: string; lastUpdated: Date | null }>> {
    const rows = await db.execute(sql`
      SELECT 
        u.id, 
        u.email,
        CASE 
          WHEN COALESCE(u.full_name,'') <> '' THEN u.full_name
          WHEN COALESCE(fp.first_name,'') <> '' OR COALESCE(fp.last_name,'') <> '' 
            THEN TRIM(COALESCE(fp.first_name,'') || ' ' || COALESCE(fp.last_name,''))
          ELSE NULL
        END AS "fullName",
        ac.status, 
        fp.last_updated AS "lastUpdated"
      FROM advisor_clients ac
      JOIN users u ON u.id = ac.client_id
      LEFT JOIN financial_profiles fp ON fp.user_id = u.id
      WHERE ac.advisor_id = ${advisorId} AND ac.status != 'removed'
      ORDER BY COALESCE(fp.last_updated, u.created_at) DESC
    `);
    return rows.rows as any;
  }

  async linkAdvisorToClient(advisorId: number, clientId: number): Promise<AdvisorClient> {
    const [link] = await db
      .insert(advisorClients)
      .values({ advisorId, clientId, status: 'active' })
      .onConflictDoNothing({ target: [advisorClients.advisorId, advisorClients.clientId] })
      .returning();
    if (link) return link as AdvisorClient;
    const [existing] = await db
      .select()
      .from(advisorClients)
      .where(and(eq(advisorClients.advisorId, advisorId), eq(advisorClients.clientId, clientId)));
    if (!existing) throw new Error('Failed to link advisor and client');
    return existing as AdvisorClient;
  }

  async getAdvisorClientLink(advisorId: number, clientId: number): Promise<AdvisorClient | undefined> {
    const [row] = await db
      .select()
      .from(advisorClients)
      .where(and(eq(advisorClients.advisorId, advisorId), eq(advisorClients.clientId, clientId)));
    return row as any || undefined;
  }

  async createAdvisorInvite(advisorId: number, email: string, inviteToken: string | undefined, tokenHash: string | undefined, expiresAt: Date): Promise<AdvisorInvite> {
    const rawToken = (inviteToken && inviteToken.trim().length > 0) ? inviteToken : crypto.randomBytes(32).toString("hex");
    const hashedToken = (tokenHash && tokenHash.trim().length > 0) ? tokenHash : crypto.createHash("sha256").update(rawToken).digest("hex");
    const [invite] = await db
      .insert(advisorInvites)
      .values({ advisorId, email, inviteToken: rawToken, tokenHash: hashedToken, expiresAt, status: "sent" })
      .returning();
    return invite as AdvisorInvite;
  }

  async getInviteByTokenHash(tokenHash: string): Promise<AdvisorInvite | undefined> {
    const [invite] = await db
      .select()
      .from(advisorInvites)
      .where(eq(advisorInvites.tokenHash, tokenHash));
    return (invite as any) || undefined;
  }

  async markInviteAccepted(inviteId: number, clientId: number): Promise<void> {
    await db
      .update(advisorInvites)
      .set({ status: 'accepted', clientId })
      .where(eq(advisorInvites.id, inviteId));
  }

  async getPendingInvitesByEmail(email: string): Promise<AdvisorInvite[]> {
    const now = new Date();
    const rows = await db
      .select()
      .from(advisorInvites)
      .where(and(eq(advisorInvites.email, email), eq(advisorInvites.status, 'sent'), gt(advisorInvites.expiresAt, now)));
    return rows as any;
  }

  async createAdvisorAuditLog(entry: Omit<AdvisorAuditLog, 'id' | 'createdAt'>): Promise<AdvisorAuditLog> {
    const [log] = await db
      .insert(advisorAuditLogs)
      .values(entry as any)
      .returning();
    return log as AdvisorAuditLog;
  }

  async getAdvisorInvites(advisorId: number): Promise<AdvisorInvite[]> {
    const rows = await db
      .select()
      .from(advisorInvites)
      .where(and(eq(advisorInvites.advisorId, advisorId), eq(advisorInvites.status, 'sent')))
      .orderBy(desc(advisorInvites.createdAt));
    return rows as any;
  }

  async getPrimaryAdvisorForClient(clientId: number): Promise<number | null> {
    const rows = await db
      .select({ advisorId: advisorClients.advisorId, updatedAt: advisorClients.updatedAt })
      .from(advisorClients)
      .where(and(eq(advisorClients.clientId, clientId), eq(advisorClients.status, 'active')))
      .orderBy(desc(advisorClients.updatedAt))
      .limit(1);
    return rows.length ? rows[0].advisorId : null;
  }

  async updateAdvisorInviteToken(inviteId: number, inviteToken: string | undefined, tokenHash: string | undefined, expiresAt: Date): Promise<AdvisorInvite> {
    const rawToken = (inviteToken && inviteToken.trim().length > 0) ? inviteToken : crypto.randomBytes(32).toString("hex");
    const hashedToken = (tokenHash && tokenHash.trim().length > 0) ? tokenHash : crypto.createHash("sha256").update(rawToken).digest("hex");
    const [row] = await db
      .update(advisorInvites)
      .set({ inviteToken: rawToken, tokenHash: hashedToken, expiresAt, createdAt: new Date(), status: 'sent' })
      .where(eq(advisorInvites.id, inviteId))
      .returning();
    if (!row) throw new Error('Invite not found');
    return row as any;
  }

  async cancelAdvisorInvite(inviteId: number): Promise<void> {
    await db
      .update(advisorInvites)
      .set({ status: 'expired' })
      .where(eq(advisorInvites.id, inviteId));
  }

  // College Reference Data Implementation
  async getCollegeByName(name: string): Promise<CollegeReference[]> {
    return await db
      .select()
      .from(collegeReference)
      .where(eq(collegeReference.name, name))
      .limit(10);
  }

  async getCollegeById(id: string): Promise<CollegeReference | undefined> {
    const [college] = await db
      .select()
      .from(collegeReference)
      .where(eq(collegeReference.id, id));
    return college || undefined;
  }

  // State 529 Plan Info Implementation
  async getState529Plan(state: string): Promise<State529Plan | undefined> {
    const [plan] = await db
      .select()
      .from(state529Plans)
      .where(eq(state529Plans.state, state));
    return plan || undefined;
  }

  // Education Scenarios Implementation
  async getEducationScenariosByGoal(userId: number, goalId: number): Promise<EducationScenario[]> {
    return await db
      .select()
      .from(educationScenarios)
      .where(and(eq(educationScenarios.userId, userId), eq(educationScenarios.educationGoalId, goalId)))
      .orderBy(asc(educationScenarios.createdAt));
  }

  async createEducationScenario(userId: number, scenario: InsertEducationScenario): Promise<EducationScenario> {
    const [newScenario] = await db
      .insert(educationScenarios)
      .values({ ...scenario, userId })
      .returning();
    return newScenario;
  }

  async updateEducationScenario(userId: number, scenarioId: number, data: Partial<InsertEducationScenario>): Promise<EducationScenario> {
    const [updated] = await db
      .update(educationScenarios)
      .set(data)
      .where(and(eq(educationScenarios.userId, userId), eq(educationScenarios.id, scenarioId)))
      .returning();
    if (!updated) throw new Error("Education scenario not found");
    return updated;
  }

  async deleteEducationScenario(userId: number, scenarioId: number): Promise<void> {
    await db
      .delete(educationScenarios)
      .where(and(eq(educationScenarios.userId, userId), eq(educationScenarios.id, scenarioId)));
  }

  // Action Plan Tasks
  async getActionPlanTasks(userId: number): Promise<ActionPlanTask[]> {
    return await db
      .select()
      .from(actionPlanTasks)
      .where(eq(actionPlanTasks.userId, userId))
      .orderBy(actionPlanTasks.createdAt);
  }

  async getActionPlanTask(userId: number, taskId: string): Promise<ActionPlanTask | undefined> {
    const [task] = await db
      .select()
      .from(actionPlanTasks)
      .where(and(eq(actionPlanTasks.userId, userId), eq(actionPlanTasks.taskId, taskId)));
    
    return task || undefined;
  }

  async createActionPlanTask(userId: number, data: {
    taskId: string;
    recommendationTitle: string;
    isCompleted: boolean;
    completedAt: Date | null;
  }): Promise<ActionPlanTask> {
    const [created] = await db
      .insert(actionPlanTasks)
      .values({ ...data, userId })
      .returning();
    
    return created;
  }

  async updateActionPlanTask(userId: number, taskId: string, data: {
    isCompleted: boolean;
    completedAt: Date | null;
  }): Promise<ActionPlanTask> {
    const [updated] = await db
      .update(actionPlanTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(actionPlanTasks.userId, userId), eq(actionPlanTasks.taskId, taskId)))
      .returning();
    
    if (!updated) throw new Error("Action plan task not found");
    return updated;
  }

  // Dashboard Insights
  async getDashboardInsights(userId: number): Promise<DashboardInsight | undefined> {
    // Primary path: prefer active row
    try {
      const [active] = await db
        .select()
        .from(dashboardInsights)
        .where(and(
          eq(dashboardInsights.userId, userId),
          eq(dashboardInsights.isActive, true)
        ))
        .orderBy(desc(dashboardInsights.createdAt))
        .limit(1);
      if (active) return active;
    } catch (e) {
      try { console.warn('[getDashboardInsights] active-row query failed; falling back to latest-any:', (e as any)?.message || e); } catch {}
    }

    // Fallback: any latest row (covers legacy rows without is_active column or with null)
    try {
      const [latestAny] = await db
        .select()
        .from(dashboardInsights)
        .where(eq(dashboardInsights.userId, userId))
        .orderBy(desc(dashboardInsights.createdAt))
        .limit(1);
      return latestAny || undefined;
    } catch (e2) {
      try { console.error('[getDashboardInsights] fallback query failed:', (e2 as any)?.message || e2); } catch {}
      return undefined;
    }
  }

  async createDashboardInsights(userId: number, data: {
    insights: any;
    generatedByModel?: string;
    generationPrompt?: string;
    generationVersion?: string;
    financialSnapshot?: any;
    profileDataHash?: string;
    validUntil?: Date;
  }): Promise<DashboardInsight> {
    // Upsert to avoid duplicate key on unique user_id constraint
    const now = new Date();
    try {
      const [upserted] = await db
        .insert(dashboardInsights)
        .values({
          userId,
          insights: data.insights,
          generatedByModel: data.generatedByModel,
          generationPrompt: data.generationPrompt,
          generationVersion: data.generationVersion,
          financialSnapshot: data.financialSnapshot,
          profileDataHash: data.profileDataHash,
          validUntil: data.validUntil,
          isActive: true,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: dashboardInsights.userId,
          set: {
            insights: data.insights,
            generatedByModel: data.generatedByModel,
            generationPrompt: data.generationPrompt,
            generationVersion: data.generationVersion,
            financialSnapshot: data.financialSnapshot,
            profileDataHash: data.profileDataHash,
            validUntil: data.validUntil,
            isActive: true,
            updatedAt: now,
            // reset view stats on regeneration
            viewCount: 0,
            lastViewed: null,
            regenerationTriggered: false
          }
        })
        .returning();
      return upserted;
    } catch (e) {
      // Fallback path for environments without UNIQUE(user_id) supporting ON CONFLICT
      try { console.warn('[createDashboardInsights] onConflict upsert failed; applying manual upsert:', (e as any)?.message || e); } catch {}

      // Try update latest row for this user; if none, insert fresh
      const [existing] = await db
        .select()
        .from(dashboardInsights)
        .where(eq(dashboardInsights.userId, userId))
        .orderBy(desc(dashboardInsights.createdAt))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(dashboardInsights)
          .set({
            insights: data.insights,
            generatedByModel: data.generatedByModel,
            generationPrompt: data.generationPrompt,
            generationVersion: data.generationVersion,
            financialSnapshot: data.financialSnapshot,
            profileDataHash: data.profileDataHash,
            validUntil: data.validUntil,
            isActive: true,
            updatedAt: now,
            viewCount: 0,
            lastViewed: null,
            regenerationTriggered: false,
          })
          .where(eq(dashboardInsights.id, existing.id))
          .returning();
        return updated;
      }

      const [inserted] = await db
        .insert(dashboardInsights)
        .values({
          userId,
          insights: data.insights,
          generatedByModel: data.generatedByModel,
          generationPrompt: data.generationPrompt,
          generationVersion: data.generationVersion,
          financialSnapshot: data.financialSnapshot,
          profileDataHash: data.profileDataHash,
          validUntil: data.validUntil,
          isActive: true,
          updatedAt: now,
          createdAt: now,
          viewCount: 0,
          regenerationTriggered: false,
        })
        .returning();
      return inserted;
    }
  }

  async updateDashboardInsightsViewCount(userId: number): Promise<void> {
    await db
      .update(dashboardInsights)
      .set({ 
        viewCount: sql`${dashboardInsights.viewCount} + 1`,
        lastViewed: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(dashboardInsights.userId, userId),
        eq(dashboardInsights.isActive, true)
      ));
  }

  async shouldRegenerateInsights(userId: number, currentProfileHash: string): Promise<boolean> {
    const existing = await this.getDashboardInsights(userId);
    
    if (!existing) return true;
    
    // Check if profile data has changed
    if (existing.profileDataHash !== currentProfileHash) return true;
    
    // Check if insights are expired (if validUntil is set)
    if (existing.validUntil && new Date() > existing.validUntil) return true;
    
    // Check if insights are older than 7 days
    const weekOld = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (existing.createdAt && existing.createdAt < weekOld) return true;
    
    return false;
  }

  // Comprehensive Insights - access ALL database data for enhanced analysis
  async getComprehensiveInsights(userId: number): Promise<DashboardInsight | undefined> {
    try {
      const [insights] = await db
        .select()
        .from(dashboardInsights)
        .where(and(
          eq(dashboardInsights.userId, userId),
          eq(dashboardInsights.isActive, true),
          eq(dashboardInsights.generationVersion, "2.0-comprehensive")
        ))
        .orderBy(desc(dashboardInsights.createdAt))
        .limit(1);
      if (insights) return insights;
    } catch (e) {
      try { console.warn('[getComprehensiveInsights] dashboard_insights query failed; falling back to financial_profiles.central_insights:', (e as any)?.message || e); } catch {}
    }

    // Fallback: use financial_profiles.central_insights if present
    try {
      const profile = await this.getFinancialProfile(userId);
      const ci: any = (profile as any)?.centralInsights || null;
      const arr = Array.isArray(ci) ? ci : (Array.isArray(ci?.insights) ? ci.insights : null);
      if (arr && arr.length > 0) {
        const fake: any = {
          id: -1,
          userId,
          insights: arr,
          generatedByModel: (ci && ci.generatedByModel) || 'grok-4-fast-reasoning',
          generationVersion: '2.0-comprehensive',
          financialSnapshot: (ci && ci.financialSnapshot) || null,
          profileDataHash: (ci && ci.profileDataHash) || null,
          isActive: true,
          validUntil: null,
          viewCount: 0,
          lastViewed: null,
          createdAt: (ci && (ci.createdAt || ci.lastUpdated)) || new Date(),
          updatedAt: (ci && (ci.updatedAt || ci.lastUpdated)) || new Date(),
        };
        return fake as DashboardInsight;
      }
    } catch {}
    return undefined;
  }

  async createComprehensiveInsights(userId: number, data: {
    insights: any;
    generatedByModel?: string;
    generationPrompt?: string;
    generationVersion?: string;
    financialSnapshot?: any;
    profileDataHash?: string;
    validUntil?: Date;
  }): Promise<DashboardInsight> {
    // Deactivate previous comprehensive insights (keep regular insights separate)
    await db
      .update(dashboardInsights)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(dashboardInsights.userId, userId),
        eq(dashboardInsights.isActive, true),
        eq(dashboardInsights.generationVersion, "2.0-comprehensive")
      ));

    // Create new comprehensive insight record (upsert on user_id)
    const [newInsight] = await db
      .insert(dashboardInsights)
      .values({
        userId,
        insights: data.insights,
        generatedByModel: data.generatedByModel || "grok-4-fast-reasoning",
        generationPrompt: data.generationPrompt,
        generationVersion: data.generationVersion || "2.0-comprehensive",
        financialSnapshot: data.financialSnapshot,
        profileDataHash: data.profileDataHash,
        validUntil: data.validUntil,
        isActive: true,
        regenerationTriggered: false,
        viewCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: dashboardInsights.userId,
        set: {
          insights: data.insights,
          generatedByModel: data.generatedByModel || "grok-4-fast-reasoning",
          generationPrompt: data.generationPrompt,
          generationVersion: data.generationVersion || "2.0-comprehensive",
          financialSnapshot: data.financialSnapshot,
          profileDataHash: data.profileDataHash,
          validUntil: data.validUntil,
          isActive: true,
          regenerationTriggered: false,
          updatedAt: new Date()
        }
      })
      .returning();
    
    return newInsight;
  }

  async markComprehensiveInsightsViewed(userId: number): Promise<void> {
    await db
      .update(dashboardInsights)
      .set({ 
        viewCount: sql`${dashboardInsights.viewCount} + 1`,
        lastViewed: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(dashboardInsights.userId, userId),
        eq(dashboardInsights.isActive, true),
        eq(dashboardInsights.generationVersion, "2.0-comprehensive")
      ));
  }

}

export const storage = new DatabaseStorage();
