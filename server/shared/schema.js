"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertEstateDocumentSchema = exports.insertEstatePlanSchema = exports.insertGoalTaskSchema = exports.insertGoalSchema = exports.insertChatMessageSchema = exports.insertFinancialProfileSchema = exports.insertUserSchema = exports.actionPlanTasksRelations = exports.achievementDefinitionsRelations = exports.sectionProgressRelations = exports.userProgressRelations = exports.userAchievementsRelations = exports.educationScenariosRelations = exports.educationGoalsRelations = exports.estateScenariosRelations = exports.estateTrustsRelations = exports.estateBeneficiariesRelations = exports.estateDocumentsRelations = exports.estatePlansRelations = exports.goalAuditLogRelations = exports.goalTasksRelations = exports.goalsRelations = exports.investmentCacheRelations = exports.pdfReportsRelations = exports.chatMessagesRelations = exports.financialProfilesRelations = exports.usersRelations = exports.achievementDefinitions = exports.actionPlanTasks = exports.sectionProgress = exports.userProgress = exports.userAchievements = exports.educationScenarios = exports.state529Plans = exports.collegeReference = exports.educationGoals = exports.estateScenarios = exports.estateTrusts = exports.estateBeneficiaries = exports.estateDocuments = exports.estatePlans = exports.goalAuditLog = exports.goalTasks = exports.goals = exports.investmentCache = exports.pdfReports = exports.chatMessages = exports.financialProfiles = exports.sessions = exports.users = void 0;
exports.scenarioTypeEnum = exports.trustTypeEnum = exports.distributionTypeEnum = exports.beneficiaryTypeEnum = exports.documentStatusEnum = exports.documentTypeEnum = exports.taskStatusEnum = exports.riskPreferenceEnum = exports.goalTypeEnum = exports.insertEducationScenarioSchema = exports.insertState529PlanSchema = exports.insertCollegeReferenceSchema = exports.insertEducationGoalSchema = exports.insertEstateScenarioSchema = exports.insertEstateTrustSchema = exports.insertEstateBeneficiarySchema = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
const zod_1 = require("zod");
const drizzle_orm_1 = require("drizzle-orm");
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    password: (0, pg_core_1.text)("password").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.sessions = (0, pg_core_1.pgTable)("sessions", {
    sid: (0, pg_core_1.text)("sid").primaryKey(),
    sess: (0, pg_core_1.jsonb)("sess").notNull(),
    expire: (0, pg_core_1.timestamp)("expire", { withTimezone: true }).notNull()
});
exports.financialProfiles = (0, pg_core_1.pgTable)("financial_profiles", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    // Personal Information
    firstName: (0, pg_core_1.text)("first_name"),
    lastName: (0, pg_core_1.text)("last_name"),
    dateOfBirth: (0, pg_core_1.text)("date_of_birth"),
    maritalStatus: (0, pg_core_1.text)("marital_status"),
    dependents: (0, pg_core_1.integer)("dependents"),
    spouseName: (0, pg_core_1.text)("spouse_name"),
    spouseDateOfBirth: (0, pg_core_1.text)("spouse_date_of_birth"),
    state: (0, pg_core_1.text)("state"), // US state for tax calculations
    // Employment & Income
    employmentStatus: (0, pg_core_1.text)("employment_status"),
    annualIncome: (0, pg_core_1.decimal)("annual_income", { precision: 12, scale: 2 }),
    taxWithholdingStatus: (0, pg_core_1.text)("tax_withholding_status"), // 'employer', 'self', 'none'
    takeHomeIncome: (0, pg_core_1.decimal)("take_home_income", { precision: 12, scale: 2 }),
    otherIncome: (0, pg_core_1.decimal)("other_income", { precision: 12, scale: 2 }),
    spouseEmploymentStatus: (0, pg_core_1.text)("spouse_employment_status"),
    spouseAnnualIncome: (0, pg_core_1.decimal)("spouse_annual_income", { precision: 12, scale: 2 }),
    spouseTaxWithholdingStatus: (0, pg_core_1.text)("spouse_tax_withholding_status"), // 'employer', 'self', 'none'
    spouseTakeHomeIncome: (0, pg_core_1.decimal)("spouse_take_home_income", { precision: 12, scale: 2 }),
    savingsRate: (0, pg_core_1.decimal)("savings_rate", { precision: 12, scale: 2 }),
    // Assets & Liabilities
    assets: (0, pg_core_1.jsonb)("assets"), // JSON array with various asset types
    liabilities: (0, pg_core_1.jsonb)("liabilities"), // JSON array with various liability types
    // Real Estate
    primaryResidence: (0, pg_core_1.jsonb)("primary_residence"), // JSON object with primary residence details
    additionalProperties: (0, pg_core_1.jsonb)("additional_properties"), // JSON array of additional properties
    // Monthly Expenses
    monthlyExpenses: (0, pg_core_1.jsonb)("monthly_expenses"), // JSON object with expense categories
    emergencyFundSize: (0, pg_core_1.decimal)("emergency_fund_size", { precision: 12, scale: 2 }),
    // Insurance
    lifeInsurance: (0, pg_core_1.jsonb)("life_insurance"), // JSON object with life insurance details
    spouseLifeInsurance: (0, pg_core_1.jsonb)("spouse_life_insurance"), // JSON object with spouse life insurance details
    healthInsurance: (0, pg_core_1.jsonb)("health_insurance"), // JSON object with health insurance details
    disabilityInsurance: (0, pg_core_1.jsonb)("disability_insurance"), // JSON object with disability insurance details
    spouseDisabilityInsurance: (0, pg_core_1.jsonb)("spouse_disability_insurance"), // JSON object with spouse disability insurance details
    autoInsurance: (0, pg_core_1.jsonb)("auto_insurance"),
    homeownerInsurance: (0, pg_core_1.jsonb)("homeowner_insurance"),
    umbrellaInsurance: (0, pg_core_1.jsonb)("umbrella_insurance"),
    businessLiabilityInsurance: (0, pg_core_1.jsonb)("business_liability_insurance"),
    insurance: (0, pg_core_1.jsonb)("insurance"), // JSON object with all insurance details
    // Risk Profile
    riskTolerance: (0, pg_core_1.text)("risk_tolerance"), // conservative, moderate, aggressive
    riskQuestionnaire: (0, pg_core_1.jsonb)("risk_questionnaire"), // Answers to risk questions
    riskQuestions: (0, pg_core_1.jsonb)("risk_questions"), // Alternative field name for risk questions
    currentAllocation: (0, pg_core_1.jsonb)("current_allocation"), // User's current investment allocation
    // Spouse Risk Profile
    spouseRiskQuestions: (0, pg_core_1.jsonb)("spouse_risk_questions"), // Spouse risk assessment answers
    spouseAllocation: (0, pg_core_1.jsonb)("spouse_allocation"), // Spouse's current investment allocation
    // Estate Planning - Individual fields for intake form
    hasWill: (0, pg_core_1.boolean)("has_will"),
    hasTrust: (0, pg_core_1.boolean)("has_trust"),
    hasPowerOfAttorney: (0, pg_core_1.boolean)("has_power_of_attorney"),
    hasHealthcareProxy: (0, pg_core_1.boolean)("has_healthcare_proxy"),
    hasBeneficiaries: (0, pg_core_1.boolean)("has_beneficiaries"),
    estatePlanning: (0, pg_core_1.jsonb)("estate_planning"), // Will, trust, beneficiaries etc
    // Life Goals
    goals: (0, pg_core_1.jsonb)("goals"), // Array of goals with target dates and amounts
    lifeGoals: (0, pg_core_1.jsonb)("life_goals"), // Array of goals with target dates and amounts
    retirementAge: (0, pg_core_1.integer)("retirement_age"),
    retirementIncome: (0, pg_core_1.decimal)("retirement_income", { precision: 12, scale: 2 }),
    additionalNotes: (0, pg_core_1.text)("additional_notes"),
    // Retirement Planning - Step 11 Fields
    desiredRetirementAge: (0, pg_core_1.integer)("desired_retirement_age"),
    spouseDesiredRetirementAge: (0, pg_core_1.integer)("spouse_desired_retirement_age"),
    socialSecurityClaimAge: (0, pg_core_1.integer)("social_security_claim_age"),
    spouseSocialSecurityClaimAge: (0, pg_core_1.integer)("spouse_social_security_claim_age"),
    userHealthStatus: (0, pg_core_1.text)("user_health_status"),
    spouseHealthStatus: (0, pg_core_1.text)("spouse_health_status"),
    userLifeExpectancy: (0, pg_core_1.integer)("user_life_expectancy"),
    spouseLifeExpectancy: (0, pg_core_1.integer)("spouse_life_expectancy"),
    expectedMonthlyExpensesRetirement: (0, pg_core_1.decimal)("expected_monthly_expenses_retirement", { precision: 12, scale: 2 }),
    retirementState: (0, pg_core_1.text)("retirement_state"),
    partTimeIncomeRetirement: (0, pg_core_1.decimal)("part_time_income_retirement", { precision: 12, scale: 2 }),
    spousePartTimeIncomeRetirement: (0, pg_core_1.decimal)("spouse_part_time_income_retirement", { precision: 12, scale: 2 }),
    spousePensionBenefit: (0, pg_core_1.decimal)("spouse_pension_benefit", { precision: 12, scale: 2 }),
    expectedInflationRate: (0, pg_core_1.decimal)("expected_inflation_rate", { precision: 5, scale: 2 }),
    // IRA Contributions
    traditionalIRAContribution: (0, pg_core_1.decimal)("traditional_ira_contribution", { precision: 12, scale: 2 }),
    rothIRAContribution: (0, pg_core_1.decimal)("roth_ira_contribution", { precision: 12, scale: 2 }),
    spouseTraditionalIRAContribution: (0, pg_core_1.decimal)("spouse_traditional_ira_contribution", { precision: 12, scale: 2 }),
    spouseRothIRAContribution: (0, pg_core_1.decimal)("spouse_roth_ira_contribution", { precision: 12, scale: 2 }),
    // ARRS (Affluvia Retirement Readiness Score) Fields - Legacy
    lifeExpectancy: (0, pg_core_1.integer)("life_expectancy"), // Legacy field, use userLifeExpectancy instead
    retirementExpenseBudget: (0, pg_core_1.jsonb)("retirement_expense_budget"), // {essential: number, discretionary: number}
    socialSecurityBenefit: (0, pg_core_1.decimal)("social_security_benefit", { precision: 12, scale: 2 }),
    spouseSocialSecurityBenefit: (0, pg_core_1.decimal)("spouse_social_security_benefit", { precision: 12, scale: 2 }),
    pensionBenefit: (0, pg_core_1.decimal)("pension_benefit", { precision: 12, scale: 2 }),
    retirementContributions: (0, pg_core_1.jsonb)("retirement_contributions"), // {employee: number, employer: number}
    spouseRetirementContributions: (0, pg_core_1.jsonb)("spouse_retirement_contributions"), // {employee: number, employer: number}
    expectedRealReturn: (0, pg_core_1.decimal)("expected_real_return", { precision: 5, scale: 2 }),
    investmentStrategy: (0, pg_core_1.text)("investment_strategy"),
    withdrawalRate: (0, pg_core_1.decimal)("withdrawal_rate", { precision: 5, scale: 2 }),
    hasLongTermCareInsurance: (0, pg_core_1.boolean)("has_long_term_care_insurance"),
    legacyGoal: (0, pg_core_1.decimal)("legacy_goal", { precision: 12, scale: 2 }),
    // Tax Information
    lastYearAGI: (0, pg_core_1.decimal)("last_year_agi", { precision: 12, scale: 2 }),
    deductionAmount: (0, pg_core_1.decimal)("deduction_amount", { precision: 12, scale: 2 }),
    taxFilingStatus: (0, pg_core_1.text)("tax_filing_status"),
    taxReturns: (0, pg_core_1.jsonb)("tax_returns"), // Processed tax return data
    taxRecommendations: (0, pg_core_1.jsonb)("tax_recommendations"), // Hyperpersonalized tax strategies from Gemini API
    // Calculated Scores
    financialHealthScore: (0, pg_core_1.integer)("financial_health_score"),
    emergencyReadinessScore: (0, pg_core_1.integer)("emergency_readiness_score"),
    retirementReadinessScore: (0, pg_core_1.integer)("retirement_readiness_score"),
    riskManagementScore: (0, pg_core_1.integer)("risk_management_score"),
    cashFlowScore: (0, pg_core_1.integer)("cash_flow_score"),
    // Comprehensive calculations object
    calculations: (0, pg_core_1.jsonb)("calculations"),
    // Comprehensive retirement planning data
    retirementPlanningData: (0, pg_core_1.jsonb)("retirement_planning_data"),
    // Monte Carlo simulation results and state
    monteCarloSimulation: (0, pg_core_1.jsonb)("monte_carlo_simulation"),
    // Optimization variables from retirement planning
    optimizationVariables: (0, pg_core_1.jsonb)("optimization_variables"),
    // Metadata
    isComplete: (0, pg_core_1.boolean)("is_complete").default(false),
    lastUpdated: (0, pg_core_1.timestamp)("last_updated").defaultNow(),
});
exports.chatMessages = (0, pg_core_1.pgTable)("chat_messages", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    message: (0, pg_core_1.text)("message").notNull(),
    response: (0, pg_core_1.text)("response"),
    timestamp: (0, pg_core_1.timestamp)("timestamp").defaultNow(),
});
exports.pdfReports = (0, pg_core_1.pgTable)("pdf_reports", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    reportData: (0, pg_core_1.jsonb)("report_data"),
    generatedAt: (0, pg_core_1.timestamp)("generated_at").defaultNow(),
});
exports.investmentCache = (0, pg_core_1.pgTable)("investment_cache", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    category: (0, pg_core_1.text)("category").notNull(), // 'market', 'ai_infra', 'ai_software', 'cloud_saas', 'cybersec'
    data: (0, pg_core_1.jsonb)("data").notNull(), // Cached API response data
    lastUpdated: (0, pg_core_1.timestamp)("last_updated").defaultNow(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(), // When the cache expires
});
// Goals-Based Planning Tables
exports.goals = (0, pg_core_1.pgTable)("goals", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    type: (0, pg_core_1.text)("type").notNull().default('custom'), // 'retirement', 'college', 'home', 'travel', 'healthcare', 'custom'
    description: (0, pg_core_1.text)("description").notNull(),
    targetAmountToday: (0, pg_core_1.decimal)("target_amount_today", { precision: 12, scale: 2 }).notNull(),
    targetDate: (0, pg_core_1.timestamp)("target_date").notNull(),
    inflationAssumptionPct: (0, pg_core_1.decimal)("inflation_assumption_pct", { precision: 5, scale: 2 }).default('2.5'),
    priority: (0, pg_core_1.integer)("priority").notNull().default(1), // 1 = highest priority
    fundingSourceAccountIds: (0, pg_core_1.jsonb)("funding_source_account_ids"), // Array of account IDs
    currentSavings: (0, pg_core_1.decimal)("current_savings", { precision: 12, scale: 2 }).default('0'),
    riskPreference: (0, pg_core_1.text)("risk_preference").default('moderate'), // 'conservative', 'moderate', 'aggressive'
    successThresholdPct: (0, pg_core_1.decimal)("success_threshold_pct", { precision: 5, scale: 2 }).default('70'),
    notes: (0, pg_core_1.text)("notes"), // Markdown supported
    probabilityOfSuccess: (0, pg_core_1.decimal)("probability_of_success", { precision: 5, scale: 2 }), // Cached value from Monte Carlo
    lastCalculatedAt: (0, pg_core_1.timestamp)("last_calculated_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.goalTasks = (0, pg_core_1.pgTable)("goal_tasks", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    goalId: (0, pg_core_1.integer)("goal_id").references(() => exports.goals.id, { onDelete: 'cascade' }).notNull(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description"),
    assignee: (0, pg_core_1.text)("assignee"), // Could be 'user', 'spouse', 'advisor'
    dueDate: (0, pg_core_1.timestamp)("due_date"),
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'cancelled'
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Audit log for compliance
exports.goalAuditLog = (0, pg_core_1.pgTable)("goal_audit_log", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    goalId: (0, pg_core_1.integer)("goal_id").references(() => exports.goals.id, { onDelete: 'cascade' }),
    taskId: (0, pg_core_1.integer)("task_id").references(() => exports.goalTasks.id, { onDelete: 'cascade' }),
    action: (0, pg_core_1.text)("action").notNull(), // 'create', 'update', 'delete'
    entityType: (0, pg_core_1.text)("entity_type").notNull(), // 'goal', 'task'
    oldValues: (0, pg_core_1.jsonb)("old_values"),
    newValues: (0, pg_core_1.jsonb)("new_values"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Estate Planning Tables
exports.estatePlans = (0, pg_core_1.pgTable)("estate_plans", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    // Core Estate Information
    totalEstateValue: (0, pg_core_1.decimal)("total_estate_value", { precision: 15, scale: 2 }),
    liquidAssets: (0, pg_core_1.decimal)("liquid_assets", { precision: 15, scale: 2 }),
    illiquidAssets: (0, pg_core_1.decimal)("illiquid_assets", { precision: 15, scale: 2 }),
    // Tax Planning
    federalExemptionUsed: (0, pg_core_1.decimal)("federal_exemption_used", { precision: 15, scale: 2 }).default('0'),
    stateExemptionUsed: (0, pg_core_1.decimal)("state_exemption_used", { precision: 15, scale: 2 }).default('0'),
    estimatedFederalEstateTax: (0, pg_core_1.decimal)("estimated_federal_estate_tax", { precision: 15, scale: 2 }),
    estimatedStateEstateTax: (0, pg_core_1.decimal)("estimated_state_estate_tax", { precision: 15, scale: 2 }),
    // Trust Strategies
    trustStrategies: (0, pg_core_1.jsonb)("trust_strategies"), // Array of trust configurations
    // Distribution Plan
    distributionPlan: (0, pg_core_1.jsonb)("distribution_plan"), // Beneficiary allocations
    // Charitable Planning
    charitableGifts: (0, pg_core_1.jsonb)("charitable_gifts"), // Planned charitable donations
    // Business Succession
    businessSuccessionPlan: (0, pg_core_1.jsonb)("business_succession_plan"),
    // Analysis Results
    analysisResults: (0, pg_core_1.jsonb)("analysis_results"), // Scenarios, projections, etc.
    // Metadata
    lastReviewDate: (0, pg_core_1.timestamp)("last_review_date"),
    nextReviewDate: (0, pg_core_1.timestamp)("next_review_date"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.estateDocuments = (0, pg_core_1.pgTable)("estate_documents", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    estatePlanId: (0, pg_core_1.integer)("estate_plan_id").references(() => exports.estatePlans.id, { onDelete: 'cascade' }),
    documentType: (0, pg_core_1.text)("document_type").notNull(), // 'will', 'trust', 'poa', 'healthcare_directive', 'beneficiary_form', 'other'
    documentName: (0, pg_core_1.text)("document_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    // Document Status
    status: (0, pg_core_1.text)("status").notNull().default('draft'), // 'draft', 'executed', 'needs_update', 'expired'
    executionDate: (0, pg_core_1.timestamp)("execution_date"),
    expirationDate: (0, pg_core_1.timestamp)("expiration_date"),
    lastReviewDate: (0, pg_core_1.timestamp)("last_review_date"),
    // Related Parties
    preparedBy: (0, pg_core_1.text)("prepared_by"), // Attorney/Professional name
    witnesses: (0, pg_core_1.jsonb)("witnesses"), // Array of witness names
    notarized: (0, pg_core_1.boolean)("notarized").default(false),
    forSpouse: (0, pg_core_1.boolean)("for_spouse").default(false), // true if document belongs to spouse
    // Storage
    storageLocation: (0, pg_core_1.text)("storage_location"), // Physical or digital location
    documentUrl: (0, pg_core_1.text)("document_url"), // If stored digitally
    // Parsed Document Data
    parsedInsights: (0, pg_core_1.jsonb)("parsed_insights"), // Gemini-parsed document insights
    // Reminders
    reviewReminderDays: (0, pg_core_1.integer)("review_reminder_days").default(365),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.estateBeneficiaries = (0, pg_core_1.pgTable)("estate_beneficiaries", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    estatePlanId: (0, pg_core_1.integer)("estate_plan_id").references(() => exports.estatePlans.id, { onDelete: 'cascade' }),
    // Beneficiary Information
    beneficiaryType: (0, pg_core_1.text)("beneficiary_type").notNull(), // 'individual', 'charity', 'trust'
    name: (0, pg_core_1.text)("name").notNull(),
    relationship: (0, pg_core_1.text)("relationship"), // 'spouse', 'child', 'parent', 'sibling', 'friend', 'charity', etc.
    dateOfBirth: (0, pg_core_1.timestamp)("date_of_birth"),
    taxId: (0, pg_core_1.text)("tax_id"), // SSN or EIN (encrypted)
    // Contact Information
    contactInfo: (0, pg_core_1.jsonb)("contact_info"), // Address, phone, email
    // Distribution Details
    distributionType: (0, pg_core_1.text)("distribution_type").notNull(), // 'percentage', 'specific_amount', 'specific_assets'
    distributionPercentage: (0, pg_core_1.decimal)("distribution_percentage", { precision: 5, scale: 2 }),
    distributionAmount: (0, pg_core_1.decimal)("distribution_amount", { precision: 15, scale: 2 }),
    specificAssets: (0, pg_core_1.jsonb)("specific_assets"), // List of specific assets
    // Conditions
    conditions: (0, pg_core_1.text)("conditions"), // Any conditions on the distribution
    trustee: (0, pg_core_1.text)("trustee"), // If distribution is through trust
    ageRestriction: (0, pg_core_1.integer)("age_restriction"), // Minimum age for distribution
    // Contingency
    isPrimary: (0, pg_core_1.boolean)("is_primary").default(true),
    contingentBeneficiaryId: (0, pg_core_1.integer)("contingent_beneficiary_id").references(() => exports.estateBeneficiaries.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.estateTrusts = (0, pg_core_1.pgTable)("estate_trusts", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    estatePlanId: (0, pg_core_1.integer)("estate_plan_id").references(() => exports.estatePlans.id, { onDelete: 'cascade' }),
    // Trust Information
    trustType: (0, pg_core_1.text)("trust_type").notNull(), // 'revocable', 'irrevocable', 'charitable', 'special_needs', etc.
    trustName: (0, pg_core_1.text)("trust_name").notNull(),
    establishedDate: (0, pg_core_1.timestamp)("established_date"),
    // Parties
    grantor: (0, pg_core_1.text)("grantor").notNull(),
    trustee: (0, pg_core_1.text)("trustee").notNull(),
    successorTrustee: (0, pg_core_1.text)("successor_trustee"),
    beneficiaries: (0, pg_core_1.jsonb)("beneficiaries"), // Array of beneficiary IDs and details
    // Financial Details
    initialFunding: (0, pg_core_1.decimal)("initial_funding", { precision: 15, scale: 2 }),
    currentValue: (0, pg_core_1.decimal)("current_value", { precision: 15, scale: 2 }),
    assets: (0, pg_core_1.jsonb)("assets"), // Assets held in trust
    // Terms
    distributionTerms: (0, pg_core_1.text)("distribution_terms"),
    terminationConditions: (0, pg_core_1.text)("termination_conditions"),
    taxIdNumber: (0, pg_core_1.text)("tax_id_number"), // EIN
    // Tax Strategy
    taxStrategy: (0, pg_core_1.jsonb)("tax_strategy"), // GST, estate tax planning, etc.
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.estateScenarios = (0, pg_core_1.pgTable)("estate_scenarios", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    estatePlanId: (0, pg_core_1.integer)("estate_plan_id").references(() => exports.estatePlans.id, { onDelete: 'cascade' }),
    scenarioName: (0, pg_core_1.text)("scenario_name").notNull(),
    scenarioType: (0, pg_core_1.text)("scenario_type").notNull(), // 'death_order', 'tax_law_change', 'asset_value_change'
    description: (0, pg_core_1.text)("description"),
    // Assumptions
    assumptions: (0, pg_core_1.jsonb)("assumptions"), // Death order, tax rates, asset values, etc.
    // Results
    results: (0, pg_core_1.jsonb)("results"), // Tax calculations, distributions, etc.
    netToHeirs: (0, pg_core_1.decimal)("net_to_heirs", { precision: 15, scale: 2 }),
    totalTaxes: (0, pg_core_1.decimal)("total_taxes", { precision: 15, scale: 2 }),
    // Comparison
    isBaseline: (0, pg_core_1.boolean)("is_baseline").default(false),
    comparisonToBaseline: (0, pg_core_1.jsonb)("comparison_to_baseline"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Education Planning Tables
exports.educationGoals = (0, pg_core_1.pgTable)("education_goals", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    // Student Information
    studentName: (0, pg_core_1.text)("student_name").notNull(),
    relationship: (0, pg_core_1.text)("relationship"), // 'child', 'self', 'spouse', 'grandchild', etc.
    studentBirthYear: (0, pg_core_1.integer)("student_birth_year"),
    // Goal Details
    goalType: (0, pg_core_1.text)("goal_type").notNull().default('college'), // 'college', 'pre-college'
    degreeType: (0, pg_core_1.text)("degree_type"), // 'undergraduate', 'masters'
    startYear: (0, pg_core_1.integer)("start_year").notNull(),
    endYear: (0, pg_core_1.integer)("end_year").notNull(),
    years: (0, pg_core_1.integer)("years").notNull(),
    // Cost Estimation
    costOption: (0, pg_core_1.text)("cost_option").notNull(), // 'average', 'specific', 'custom'
    collegeId: (0, pg_core_1.text)("college_id"), // Reference to specific college if selected
    collegeName: (0, pg_core_1.text)("college_name"),
    costPerYear: (0, pg_core_1.decimal)("cost_per_year", { precision: 12, scale: 2 }), // For custom costs
    includeRoomBoard: (0, pg_core_1.boolean)("include_room_board").default(true), // Whether room & board is included in costPerYear
    isInState: (0, pg_core_1.boolean)("is_in_state").default(true), // For public colleges, whether student is in-state
    inflationRate: (0, pg_core_1.decimal)("inflation_rate", { precision: 5, scale: 2 }).default('5.0'),
    // Funding Details
    coverPercent: (0, pg_core_1.decimal)("cover_percent", { precision: 5, scale: 2 }).default('100'),
    scholarshipPerYear: (0, pg_core_1.decimal)("scholarship_per_year", { precision: 12, scale: 2 }).default('0'),
    loanPerYear: (0, pg_core_1.decimal)("loan_per_year", { precision: 12, scale: 2 }).default('0'),
    loanInterestRate: (0, pg_core_1.decimal)("loan_interest_rate", { precision: 5, scale: 2 }).default('10.0'), // Default 10% for Parent PLUS
    loanRepaymentTerm: (0, pg_core_1.integer)("loan_repayment_term").default(10), // Default 10 years
    loanType: (0, pg_core_1.text)("loan_type"), // 'parent_plus', 'federal_student', 'private'
    // Current Savings
    currentSavings: (0, pg_core_1.decimal)("current_savings", { precision: 12, scale: 2 }).default('0'),
    monthlyContribution: (0, pg_core_1.decimal)("monthly_contribution", { precision: 12, scale: 2 }).default('0'),
    accountType: (0, pg_core_1.text)("account_type"), // '529', 'coverdell', 'custodial', 'other'
    // Investment Assumptions
    expectedReturn: (0, pg_core_1.decimal)("expected_return", { precision: 5, scale: 2 }).default('6.0'),
    riskProfile: (0, pg_core_1.text)("risk_profile").default('moderate'), // 'conservative', 'moderate', 'aggressive', 'glide'
    // State of Residence for 529 tax benefits
    stateOfResidence: (0, pg_core_1.text)("state_of_residence"),
    // Funding sources detail
    fundingSources: (0, pg_core_1.jsonb)("funding_sources"), // Array of funding sources with type and amount
    // Projections (cached calculations)
    projectionData: (0, pg_core_1.jsonb)("projection_data"), // Contains yearly projections, funding status, etc.
    monthlyContributionNeeded: (0, pg_core_1.decimal)("monthly_contribution_needed", { precision: 12, scale: 2 }),
    fundingPercentage: (0, pg_core_1.decimal)("funding_percentage", { precision: 5, scale: 2 }),
    probabilityOfSuccess: (0, pg_core_1.decimal)("probability_of_success", { precision: 5, scale: 2 }),
    lastCalculatedAt: (0, pg_core_1.timestamp)("last_calculated_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// College Reference Data Table
exports.collegeReference = (0, pg_core_1.pgTable)("college_reference", {
    id: (0, pg_core_1.text)("id").primaryKey(), // IPEDS ID or similar
    name: (0, pg_core_1.text)("name").notNull(),
    state: (0, pg_core_1.text)("state").notNull(),
    type: (0, pg_core_1.text)("type").notNull(), // 'public', 'private', 'community'
    // Current Year Costs
    inStateTuition: (0, pg_core_1.decimal)("in_state_tuition", { precision: 12, scale: 2 }),
    outOfStateTuition: (0, pg_core_1.decimal)("out_of_state_tuition", { precision: 12, scale: 2 }),
    roomAndBoard: (0, pg_core_1.decimal)("room_and_board", { precision: 12, scale: 2 }),
    booksAndSupplies: (0, pg_core_1.decimal)("books_and_supplies", { precision: 12, scale: 2 }),
    otherExpenses: (0, pg_core_1.decimal)("other_expenses", { precision: 12, scale: 2 }),
    // Additional Info
    website: (0, pg_core_1.text)("website"),
    lastUpdated: (0, pg_core_1.timestamp)("last_updated").defaultNow(),
});
// State 529 Plan Information
exports.state529Plans = (0, pg_core_1.pgTable)("state_529_plans", {
    state: (0, pg_core_1.text)("state").primaryKey(), // Two-letter state code
    stateName: (0, pg_core_1.text)("state_name").notNull(),
    // Tax Benefits
    hasStateTaxDeduction: (0, pg_core_1.boolean)("has_state_tax_deduction").default(false),
    maxDeductionSingle: (0, pg_core_1.decimal)("max_deduction_single", { precision: 12, scale: 2 }),
    maxDeductionMarried: (0, pg_core_1.decimal)("max_deduction_married", { precision: 12, scale: 2 }),
    taxCreditAvailable: (0, pg_core_1.boolean)("tax_credit_available").default(false),
    taxCreditAmount: (0, pg_core_1.decimal)("tax_credit_amount", { precision: 12, scale: 2 }),
    // Plan Details
    planName: (0, pg_core_1.text)("plan_name"),
    planWebsite: (0, pg_core_1.text)("plan_website"),
    specialFeatures: (0, pg_core_1.jsonb)("special_features"), // Array of special features
    // Other Benefits
    otherBenefits: (0, pg_core_1.text)("other_benefits"),
    restrictions: (0, pg_core_1.text)("restrictions"),
    lastUpdated: (0, pg_core_1.timestamp)("last_updated").defaultNow(),
});
// Education Scenarios (for what-if analysis)
exports.educationScenarios = (0, pg_core_1.pgTable)("education_scenarios", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    educationGoalId: (0, pg_core_1.integer)("education_goal_id").references(() => exports.educationGoals.id, { onDelete: 'cascade' }).notNull(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    scenarioName: (0, pg_core_1.text)("scenario_name").notNull(),
    scenarioType: (0, pg_core_1.text)("scenario_type"), // 'contribution_change', 'cost_change', 'return_change', etc.
    // Scenario Parameters
    parameters: (0, pg_core_1.jsonb)("parameters"), // Contains the modified parameters
    // Results
    results: (0, pg_core_1.jsonb)("results"), // Projected outcomes under this scenario
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Achievement System Tables
exports.userAchievements = (0, pg_core_1.pgTable)("user_achievements", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    achievementId: (0, pg_core_1.text)("achievement_id").notNull(), // Reference to achievement definition
    unlockedAt: (0, pg_core_1.timestamp)("unlocked_at").defaultNow(),
    xpEarned: (0, pg_core_1.integer)("xp_earned").notNull(),
});
exports.userProgress = (0, pg_core_1.pgTable)("user_progress", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    totalXP: (0, pg_core_1.integer)("total_xp").default(0),
    currentLevel: (0, pg_core_1.integer)("current_level").default(1),
    currentStreak: (0, pg_core_1.integer)("current_streak").default(0),
    longestStreak: (0, pg_core_1.integer)("longest_streak").default(0),
    lastVisit: (0, pg_core_1.timestamp)("last_visit").defaultNow(),
    sessionStats: (0, pg_core_1.jsonb)("session_stats"), // { totalSessions, averageSessionTime, firstSessionDate }
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.sectionProgress = (0, pg_core_1.pgTable)("section_progress", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    section: (0, pg_core_1.text)("section").notNull(), // 'intake', 'dashboard', 'retirement', etc.
    visits: (0, pg_core_1.integer)("visits").default(0),
    timeSpent: (0, pg_core_1.integer)("time_spent").default(0), // in seconds
    actionsCompleted: (0, pg_core_1.integer)("actions_completed").default(0),
    lastVisit: (0, pg_core_1.timestamp)("last_visit").defaultNow(),
    completionPercentage: (0, pg_core_1.decimal)("completion_percentage", { precision: 5, scale: 2 }).default('0'),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Action Plan Task Tracking
exports.actionPlanTasks = (0, pg_core_1.pgTable)("action_plan_tasks", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id).notNull(),
    taskId: (0, pg_core_1.text)("task_id").notNull(), // Unique identifier for the task (e.g., "emergency-fund-3-months")
    recommendationTitle: (0, pg_core_1.text)("recommendation_title").notNull(), // Title of the recommendation
    isCompleted: (0, pg_core_1.boolean)("is_completed").default(false),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.achievementDefinitions = (0, pg_core_1.pgTable)("achievement_definitions", {
    id: (0, pg_core_1.text)("id").primaryKey(), // e.g., 'first-steps', 'speed-demon'
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description").notNull(),
    icon: (0, pg_core_1.text)("icon").notNull(),
    category: (0, pg_core_1.text)("category").notNull(), // 'intake', 'dashboard', 'retirement', etc.
    xp: (0, pg_core_1.integer)("xp").notNull(),
    requirementType: (0, pg_core_1.text)("requirement_type").notNull(), // 'visit', 'time', 'action', 'streak', 'completion'
    requirementValue: (0, pg_core_1.integer)("requirement_value").notNull(),
    requirementTarget: (0, pg_core_1.text)("requirement_target"), // Optional target specification
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Relations
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ one, many }) => ({
    financialProfile: one(exports.financialProfiles),
    chatMessages: many(exports.chatMessages),
    pdfReports: many(exports.pdfReports),
    investmentCache: many(exports.investmentCache),
    goals: many(exports.goals),
    goalTasks: many(exports.goalTasks),
    goalAuditLog: many(exports.goalAuditLog),
    estatePlans: many(exports.estatePlans),
    estateDocuments: many(exports.estateDocuments),
    estateBeneficiaries: many(exports.estateBeneficiaries),
    estateTrusts: many(exports.estateTrusts),
    estateScenarios: many(exports.estateScenarios),
    educationGoals: many(exports.educationGoals),
    educationScenarios: many(exports.educationScenarios),
    userAchievements: many(exports.userAchievements),
    userProgress: one(exports.userProgress),
    sectionProgress: many(exports.sectionProgress),
    actionPlanTasks: many(exports.actionPlanTasks),
}));
exports.financialProfilesRelations = (0, drizzle_orm_1.relations)(exports.financialProfiles, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.financialProfiles.userId],
        references: [exports.users.id],
    }),
}));
exports.chatMessagesRelations = (0, drizzle_orm_1.relations)(exports.chatMessages, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.chatMessages.userId],
        references: [exports.users.id],
    }),
}));
exports.pdfReportsRelations = (0, drizzle_orm_1.relations)(exports.pdfReports, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.pdfReports.userId],
        references: [exports.users.id],
    }),
}));
exports.investmentCacheRelations = (0, drizzle_orm_1.relations)(exports.investmentCache, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.investmentCache.userId],
        references: [exports.users.id],
    }),
}));
exports.goalsRelations = (0, drizzle_orm_1.relations)(exports.goals, ({ one, many }) => ({
    user: one(exports.users, {
        fields: [exports.goals.userId],
        references: [exports.users.id],
    }),
    tasks: many(exports.goalTasks),
    auditLogs: many(exports.goalAuditLog),
}));
exports.goalTasksRelations = (0, drizzle_orm_1.relations)(exports.goalTasks, ({ one, many }) => ({
    user: one(exports.users, {
        fields: [exports.goalTasks.userId],
        references: [exports.users.id],
    }),
    goal: one(exports.goals, {
        fields: [exports.goalTasks.goalId],
        references: [exports.goals.id],
    }),
    auditLogs: many(exports.goalAuditLog),
}));
exports.goalAuditLogRelations = (0, drizzle_orm_1.relations)(exports.goalAuditLog, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.goalAuditLog.userId],
        references: [exports.users.id],
    }),
    goal: one(exports.goals, {
        fields: [exports.goalAuditLog.goalId],
        references: [exports.goals.id],
    }),
    task: one(exports.goalTasks, {
        fields: [exports.goalAuditLog.taskId],
        references: [exports.goalTasks.id],
    }),
}));
// Estate Planning Relations
exports.estatePlansRelations = (0, drizzle_orm_1.relations)(exports.estatePlans, ({ one, many }) => ({
    user: one(exports.users, {
        fields: [exports.estatePlans.userId],
        references: [exports.users.id],
    }),
    documents: many(exports.estateDocuments),
    beneficiaries: many(exports.estateBeneficiaries),
    trusts: many(exports.estateTrusts),
    scenarios: many(exports.estateScenarios),
}));
exports.estateDocumentsRelations = (0, drizzle_orm_1.relations)(exports.estateDocuments, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.estateDocuments.userId],
        references: [exports.users.id],
    }),
    estatePlan: one(exports.estatePlans, {
        fields: [exports.estateDocuments.estatePlanId],
        references: [exports.estatePlans.id],
    }),
}));
exports.estateBeneficiariesRelations = (0, drizzle_orm_1.relations)(exports.estateBeneficiaries, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.estateBeneficiaries.userId],
        references: [exports.users.id],
    }),
    estatePlan: one(exports.estatePlans, {
        fields: [exports.estateBeneficiaries.estatePlanId],
        references: [exports.estatePlans.id],
    }),
    contingentBeneficiary: one(exports.estateBeneficiaries, {
        fields: [exports.estateBeneficiaries.contingentBeneficiaryId],
        references: [exports.estateBeneficiaries.id],
    }),
}));
exports.estateTrustsRelations = (0, drizzle_orm_1.relations)(exports.estateTrusts, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.estateTrusts.userId],
        references: [exports.users.id],
    }),
    estatePlan: one(exports.estatePlans, {
        fields: [exports.estateTrusts.estatePlanId],
        references: [exports.estatePlans.id],
    }),
}));
exports.estateScenariosRelations = (0, drizzle_orm_1.relations)(exports.estateScenarios, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.estateScenarios.userId],
        references: [exports.users.id],
    }),
    estatePlan: one(exports.estatePlans, {
        fields: [exports.estateScenarios.estatePlanId],
        references: [exports.estatePlans.id],
    }),
}));
// Education Goals Relations
exports.educationGoalsRelations = (0, drizzle_orm_1.relations)(exports.educationGoals, ({ one, many }) => ({
    user: one(exports.users, {
        fields: [exports.educationGoals.userId],
        references: [exports.users.id],
    }),
    scenarios: many(exports.educationScenarios),
}));
exports.educationScenariosRelations = (0, drizzle_orm_1.relations)(exports.educationScenarios, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.educationScenarios.userId],
        references: [exports.users.id],
    }),
    educationGoal: one(exports.educationGoals, {
        fields: [exports.educationScenarios.educationGoalId],
        references: [exports.educationGoals.id],
    }),
}));
// Achievement System Relations
exports.userAchievementsRelations = (0, drizzle_orm_1.relations)(exports.userAchievements, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.userAchievements.userId],
        references: [exports.users.id],
    }),
    achievementDefinition: one(exports.achievementDefinitions, {
        fields: [exports.userAchievements.achievementId],
        references: [exports.achievementDefinitions.id],
    }),
}));
exports.userProgressRelations = (0, drizzle_orm_1.relations)(exports.userProgress, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.userProgress.userId],
        references: [exports.users.id],
    }),
}));
exports.sectionProgressRelations = (0, drizzle_orm_1.relations)(exports.sectionProgress, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.sectionProgress.userId],
        references: [exports.users.id],
    }),
}));
exports.achievementDefinitionsRelations = (0, drizzle_orm_1.relations)(exports.achievementDefinitions, ({ many }) => ({
    userAchievements: many(exports.userAchievements),
}));
exports.actionPlanTasksRelations = (0, drizzle_orm_1.relations)(exports.actionPlanTasks, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.actionPlanTasks.userId],
        references: [exports.users.id],
    }),
}));
// Zod Schemas
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users).pick({
    email: true,
    password: true,
});
exports.insertFinancialProfileSchema = (0, drizzle_zod_1.createInsertSchema)(exports.financialProfiles).omit({
    id: true,
    userId: true,
    lastUpdated: true,
});
exports.insertChatMessageSchema = (0, drizzle_zod_1.createInsertSchema)(exports.chatMessages).omit({
    id: true,
    userId: true,
    timestamp: true,
});
exports.insertGoalSchema = (0, drizzle_zod_1.createInsertSchema)(exports.goals).omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
    lastCalculatedAt: true,
    probabilityOfSuccess: true,
});
exports.insertGoalTaskSchema = (0, drizzle_zod_1.createInsertSchema)(exports.goalTasks).omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
    completedAt: true,
});
// Estate Planning Schemas
exports.insertEstatePlanSchema = (0, drizzle_zod_1.createInsertSchema)(exports.estatePlans).omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertEstateDocumentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.estateDocuments).omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertEstateBeneficiarySchema = (0, drizzle_zod_1.createInsertSchema)(exports.estateBeneficiaries).omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertEstateTrustSchema = (0, drizzle_zod_1.createInsertSchema)(exports.estateTrusts).omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertEstateScenarioSchema = (0, drizzle_zod_1.createInsertSchema)(exports.estateScenarios).omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
});
// Education Planning Insert Schemas
exports.insertEducationGoalSchema = (0, drizzle_zod_1.createInsertSchema)(exports.educationGoals).omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertCollegeReferenceSchema = (0, drizzle_zod_1.createInsertSchema)(exports.collegeReference).omit({
    lastUpdated: true,
});
exports.insertState529PlanSchema = (0, drizzle_zod_1.createInsertSchema)(exports.state529Plans).omit({
    lastUpdated: true,
});
exports.insertEducationScenarioSchema = (0, drizzle_zod_1.createInsertSchema)(exports.educationScenarios).omit({
    id: true,
    userId: true,
    createdAt: true,
});
// Goal type enum for validation
exports.goalTypeEnum = zod_1.z.enum(['retirement', 'college', 'home', 'travel', 'healthcare', 'custom']);
exports.riskPreferenceEnum = zod_1.z.enum(['conservative', 'moderate', 'aggressive']);
exports.taskStatusEnum = zod_1.z.enum(['pending', 'in_progress', 'completed', 'cancelled']);
// Estate Planning enums
exports.documentTypeEnum = zod_1.z.enum(['will', 'trust', 'poa', 'healthcare_directive', 'beneficiary_form', 'other']);
exports.documentStatusEnum = zod_1.z.enum(['draft', 'executed', 'needs_update', 'expired']);
exports.beneficiaryTypeEnum = zod_1.z.enum(['individual', 'charity', 'trust']);
exports.distributionTypeEnum = zod_1.z.enum(['percentage', 'specific_amount', 'specific_assets']);
exports.trustTypeEnum = zod_1.z.enum(['revocable', 'irrevocable', 'charitable', 'special_needs', 'generation_skipping', 'qualified_personal_residence', 'grantor_retained_annuity']);
exports.scenarioTypeEnum = zod_1.z.enum(['death_order', 'tax_law_change', 'asset_value_change', 'baseline']);
