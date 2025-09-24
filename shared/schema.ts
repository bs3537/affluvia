import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, date, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  role: text("role").notNull().default('individual'), // 'individual' | 'advisor'
  createdAt: timestamp("created_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { withTimezone: true }).notNull()
});

// Advisor linking tables
export const advisorClients = pgTable("advisor_clients", {
  id: serial("id").primaryKey(),
  advisorId: integer("advisor_id").references(() => users.id).notNull(),
  clientId: integer("client_id").references(() => users.id).notNull(),
  status: text("status").notNull().default('active'), // 'invited' | 'active' | 'removed'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const advisorInvites = pgTable("advisor_invites", {
  id: serial("id").primaryKey(),
  advisorId: integer("advisor_id").references(() => users.id).notNull(),
  email: text("email").notNull(),
  inviteToken: text("invite_token").notNull(),
  tokenHash: text("token_hash").notNull(),
  status: text("status").notNull().default('sent'), // 'sent' | 'accepted' | 'expired'
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  clientId: integer("client_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const advisorAuditLogs = pgTable("advisor_audit_logs", {
  id: serial("id").primaryKey(),
  actorAdvisorId: integer("actor_advisor_id").references(() => users.id).notNull(),
  clientId: integer("client_id").references(() => users.id).notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  action: text("action").notNull(), // 'create' | 'update' | 'delete'
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const financialProfiles = pgTable("financial_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  // Personal Information
  firstName: text("first_name"),
  lastName: text("last_name"),
  dateOfBirth: text("date_of_birth"),  
  maritalStatus: text("marital_status"),
  dependents: integer("dependents"),
  spouseName: text("spouse_name"),
  spouseDateOfBirth: text("spouse_date_of_birth"),
  state: text("state"), // US state for tax calculations

  // Employment & Income
  employmentStatus: text("employment_status"),
  annualIncome: decimal("annual_income", { precision: 12, scale: 2 }),
  taxWithholdingStatus: text("tax_withholding_status"), // 'employer', 'self', 'none'
  takeHomeIncome: decimal("take_home_income", { precision: 12, scale: 2 }),
  otherIncome: decimal("other_income", { precision: 12, scale: 2 }),
  spouseEmploymentStatus: text("spouse_employment_status"),
  spouseAnnualIncome: decimal("spouse_annual_income", { precision: 12, scale: 2 }),
  spouseTaxWithholdingStatus: text("spouse_tax_withholding_status"), // 'employer', 'self', 'none'
  spouseTakeHomeIncome: decimal("spouse_take_home_income", { precision: 12, scale: 2 }),
  savingsRate: decimal("savings_rate", { precision: 12, scale: 2 }),

  // Assets & Liabilities
  assets: jsonb("assets"), // JSON array with various asset types
  liabilities: jsonb("liabilities"), // JSON array with various liability types

  // Real Estate
  primaryResidence: jsonb("primary_residence"), // JSON object with primary residence details
  additionalProperties: jsonb("additional_properties"), // JSON array of additional properties

  // Monthly Expenses
  monthlyExpenses: jsonb("monthly_expenses"), // JSON object with expense categories
  // Manual override for total monthly expenses
  totalMonthlyExpenses: decimal("total_monthly_expenses", { precision: 12, scale: 2 }),
  emergencyFundSize: decimal("emergency_fund_size", { precision: 12, scale: 2 }),

  // Insurance
  lifeInsurance: jsonb("life_insurance"), // JSON object with life insurance details
  spouseLifeInsurance: jsonb("spouse_life_insurance"), // JSON object with spouse life insurance details
  healthInsurance: jsonb("health_insurance"), // JSON object with health insurance details
  disabilityInsurance: jsonb("disability_insurance"), // JSON object with disability insurance details
  spouseDisabilityInsurance: jsonb("spouse_disability_insurance"), // JSON object with spouse disability insurance details
  autoInsurance: jsonb("auto_insurance"),
  homeownerInsurance: jsonb("homeowner_insurance"),
  umbrellaInsurance: jsonb("umbrella_insurance"),
  businessLiabilityInsurance: jsonb("business_liability_insurance"),
  insurance: jsonb("insurance"), // JSON object with all insurance details

  // Risk Profile
  riskTolerance: text("risk_tolerance"), // conservative, moderate, aggressive
  riskQuestionnaire: jsonb("risk_questionnaire"), // Answers to risk questions
  riskQuestions: jsonb("risk_questions"), // Alternative field name for risk questions
  currentAllocation: jsonb("current_allocation"), // User's current investment allocation
  // Individual allocation fields for Gemini API
  currentStockAllocation: decimal("current_stock_allocation", { precision: 5, scale: 2 }), // Stocks percentage
  currentBondAllocation: decimal("current_bond_allocation", { precision: 5, scale: 2 }), // Bonds percentage  
  currentCashAllocation: decimal("current_cash_allocation", { precision: 5, scale: 2 }), // Cash percentage
  currentAlternativesAllocation: decimal("current_alternatives_allocation", { precision: 5, scale: 2 }), // Alternatives percentage
  userRiskProfile: text("user_risk_profile"), // User's calculated risk profile
  targetAllocation: jsonb("target_allocation"), // User's target allocation based on risk profile
  
  // Spouse Risk Profile
  spouseRiskQuestions: jsonb("spouse_risk_questions"), // Spouse risk assessment answers
  spouseAllocation: jsonb("spouse_allocation"), // Spouse's current investment allocation
  spouseRiskProfile: text("spouse_risk_profile"), // Spouse's calculated risk profile
  spouseTargetAllocation: jsonb("spouse_target_allocation"), // Spouse's target allocation based on risk profile

  // Estate Planning - Individual fields for intake form
  hasWill: boolean("has_will"),
  hasTrust: boolean("has_trust"),
  hasPowerOfAttorney: boolean("has_power_of_attorney"),
  hasHealthcareProxy: boolean("has_healthcare_proxy"),
  hasBeneficiaries: boolean("has_beneficiaries"),
  estatePlanning: jsonb("estate_planning"), // Will, trust, beneficiaries etc

  // Life Goals (stored in JSONB for backward compatibility)
  goals: jsonb("goals"), // Array of goals with target dates and amounts
  lifeGoals: jsonb("life_goals"), // Array of goals with target dates and amounts
  retirementAge: integer("retirement_age"),
  retirementIncome: decimal("retirement_income", { precision: 12, scale: 2 }),
  additionalNotes: text("additional_notes"),

  // Retirement Planning - Step 11 Fields
  desiredRetirementAge: integer("desired_retirement_age"),
  spouseDesiredRetirementAge: integer("spouse_desired_retirement_age"),
  socialSecurityClaimAge: integer("social_security_claim_age"),
  spouseSocialSecurityClaimAge: integer("spouse_social_security_claim_age"),
  userHealthStatus: text("user_health_status"),
  spouseHealthStatus: text("spouse_health_status"),
  userLifeExpectancy: integer("user_life_expectancy"),
  spouseLifeExpectancy: integer("spouse_life_expectancy"),
  expectedMonthlyExpensesRetirement: decimal("expected_monthly_expenses_retirement", { precision: 12, scale: 2 }),
  retirementState: text("retirement_state"),
  partTimeIncomeRetirement: decimal("part_time_income_retirement", { precision: 12, scale: 2 }),
  spousePartTimeIncomeRetirement: decimal("spouse_part_time_income_retirement", { precision: 12, scale: 2 }),
  spousePensionBenefit: decimal("spouse_pension_benefit", { precision: 12, scale: 2 }),
  expectedInflationRate: decimal("expected_inflation_rate", { precision: 5, scale: 2 }),
  
  // IRA Contributions
  traditionalIRAContribution: decimal("traditional_ira_contribution", { precision: 12, scale: 2 }),
  rothIRAContribution: decimal("roth_ira_contribution", { precision: 12, scale: 2 }),
  spouseTraditionalIRAContribution: decimal("spouse_traditional_ira_contribution", { precision: 12, scale: 2 }),
  spouseRothIRAContribution: decimal("spouse_roth_ira_contribution", { precision: 12, scale: 2 }),
  
  // ARRS (Affluvia Retirement Readiness Score) Fields - Legacy
  lifeExpectancy: integer("life_expectancy"), // Legacy field, use userLifeExpectancy instead
  retirementExpenseBudget: jsonb("retirement_expense_budget"), // {essential: number, discretionary: number}
  socialSecurityBenefit: decimal("social_security_benefit", { precision: 12, scale: 2 }),
  spouseSocialSecurityBenefit: decimal("spouse_social_security_benefit", { precision: 12, scale: 2 }),
  pensionBenefit: decimal("pension_benefit", { precision: 12, scale: 2 }),
  retirementContributions: jsonb("retirement_contributions"), // {employee: number, employer: number}
  spouseRetirementContributions: jsonb("spouse_retirement_contributions"), // {employee: number, employer: number}
  expectedRealReturn: decimal("expected_real_return", { precision: 5, scale: 2 }),
  investmentStrategy: text("investment_strategy"),
  withdrawalRate: decimal("withdrawal_rate", { precision: 5, scale: 2 }),
  hasLongTermCareInsurance: boolean("has_long_term_care_insurance"),
  legacyGoal: decimal("legacy_goal", { precision: 12, scale: 2 }),

  // Tax Information
  lastYearAGI: decimal("last_year_agi", { precision: 12, scale: 2 }),
  deductionAmount: decimal("deduction_amount", { precision: 12, scale: 2 }),
  taxFilingStatus: text("tax_filing_status"),
  taxReturns: jsonb("tax_returns"), // Processed tax return data
  taxRecommendations: jsonb("tax_recommendations"), // Hyperpersonalized tax strategies from Gemini API

  // Calculated Scores
  financialHealthScore: integer("financial_health_score"),
  emergencyReadinessScore: integer("emergency_readiness_score"),
  retirementReadinessScore: integer("retirement_readiness_score"),
  riskManagementScore: integer("risk_management_score"),
  cashFlowScore: integer("cash_flow_score"),
  
  // Core Financial Metrics (for quick dashboard access)
  netWorth: decimal("net_worth", { precision: 15, scale: 2 }),
  monthlyCashFlow: decimal("monthly_cash_flow", { precision: 12, scale: 2 }),
  monthlyCashFlowAfterContributions: decimal("monthly_cash_flow_after_contributions", { precision: 12, scale: 2 }),
  
  // Comprehensive calculations object
  calculations: jsonb("calculations"),
  
  // Comprehensive retirement planning data
  retirementPlanningData: jsonb("retirement_planning_data"),

  // Cached Central Insights (for fast loads in Insights view)
  centralInsights: jsonb("central_insights"),

  // Cached Retirement Insights (for Retirement Planning → Insights tab)
  retirementInsights: jsonb("retirement_insights"),
  
  // Monte Carlo simulation results and state
  monteCarloSimulation: jsonb("monte_carlo_simulation"),
  
  // Net Worth Projection results and state
  netWorthProjections: jsonb("net_worth_projections"),
  
  // Optimization variables from retirement planning
  optimizationVariables: jsonb("optimization_variables"),
  
  // UI preferences for retirement planning
  retirementPlanningUIPreferences: jsonb("retirement_planning_ui_preferences"),
  
  // Cached stress test results
  lastStressTestResults: jsonb("last_stress_test_results"),
  lastStressTestDate: varchar("last_stress_test_date", { length: 50 }),
  
  // Pre-calculated optimal Social Security ages
  optimalSocialSecurityAge: integer("optimal_social_security_age"),
  optimalSpouseSocialSecurityAge: integer("optimal_spouse_social_security_age"),
  socialSecurityOptimization: jsonb("social_security_optimization"),

  // Self-Employment Data
  isSelfEmployed: boolean("is_self_employed").default(false),
  selfEmploymentIncome: decimal("self_employment_income", { precision: 12, scale: 2 }),
  businessType: text("business_type"), // sole proprietor, LLC, S-corp, etc.
  hasRetirementPlan: boolean("has_retirement_plan").default(false),
  quarterlyTaxPayments: jsonb("quarterly_tax_payments"), // Array of quarterly payments
  selfEmployedData: jsonb("self_employed_data"), // Comprehensive self-employed data

  // Metadata
  isComplete: boolean("is_complete").default(false),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  response: text("response"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Chat Documents Table for uploaded files in chat
export const chatDocuments = pgTable("chat_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  messageId: integer("message_id").references(() => chatMessages.id, { onDelete: 'cascade' }),
  
  // File Information
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(), // in bytes
  
  // File Storage
  filePath: text("file_path").notNull(), // Path to stored file
  
  // Processing Status
  processingStatus: text("processing_status").default('pending').notNull(), // 'pending', 'processing', 'completed', 'failed'
  
  // Extracted Content
  extractedText: text("extracted_text"), // Text content extracted from document
  extractedData: jsonb("extracted_data"), // Structured data extracted (e.g., from financial statements)
  
  // AI Analysis
  aiSummary: text("ai_summary"), // AI-generated summary of the document
  aiInsights: jsonb("ai_insights"), // AI-generated insights and analysis
  
  // Document Classification
  documentType: text("document_type"), // 'tax_return', 'financial_statement', 'insurance', 'investment', 'other'
  documentCategory: text("document_category"), // 'personal_finance', 'tax', 'investment', 'insurance', 'estate', 'other'
  
  // Metadata
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pdfReports = pgTable("pdf_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  reportData: jsonb("report_data"),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export const investmentCache = pgTable("investment_cache", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  category: text("category").notNull(), // 'market', 'ai_infra', 'ai_software', 'cloud_saas', 'cybersec'
  data: jsonb("data").notNull(), // Cached API response data
  lastUpdated: timestamp("last_updated").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // When the cache expires
});

// Widget Cache Table for expensive calculation results
export const widgetCache = pgTable("widget_cache", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  widgetType: text("widget_type").notNull(), // 'monte_carlo_retirement', 'stress_test', 'portfolio_impact', etc.
  inputHash: text("input_hash").notNull(), // Hash of calculation dependencies
  widgetData: jsonb("widget_data").notNull(), // Cached calculation results
  calculatedAt: timestamp("calculated_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional expiration
  version: integer("version").default(1), // For cache versioning
});

// Life Goals Table (separate from financial profile's life_goals column)
export const lifeGoalsTable = pgTable("life_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  goalType: text("goal_type").notNull(), // 'home-purchase', 'investment-property', 'debt-free', 'business', 'custom'
  goalName: text("goal_name").notNull(),
  description: text("description"),
  targetDate: text("target_date"),
  targetAmount: decimal("target_amount", { precision: 12, scale: 2 }),
  currentAmount: decimal("current_amount", { precision: 12, scale: 2 }).default('0'),
  monthlyContribution: decimal("monthly_contribution", { precision: 12, scale: 2 }).default('0'),
  fundingSources: jsonb("funding_sources").default([]), // Array of funding sources
  fundingPercentage: decimal("funding_percentage", { precision: 5, scale: 2 }).default('0'),
  priority: text("priority").default('medium'), // 'high', 'medium', 'low'
  status: text("status").default('pending'), // 'on-track', 'at-risk', 'behind', 'completed'
  linkedEntityId: text("linked_entity_id"), // For linking to education goals, etc.
  linkedEntityType: text("linked_entity_type"), // 'education_goals', etc.
  metadata: jsonb("metadata"), // Additional data specific to goal type
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Goals-Based Planning Tables
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull().default('custom'), // 'retirement', 'college', 'home', 'travel', 'healthcare', 'custom'
  description: text("description").notNull(),
  targetAmountToday: decimal("target_amount_today", { precision: 12, scale: 2 }).notNull(),
  targetDate: timestamp("target_date").notNull(),
  inflationAssumptionPct: decimal("inflation_assumption_pct", { precision: 5, scale: 2 }).default('2.5'),
  priority: integer("priority").notNull().default(1), // 1 = highest priority
  fundingSourceAccountIds: jsonb("funding_source_account_ids"), // Array of account IDs
  currentSavings: decimal("current_savings", { precision: 12, scale: 2 }).default('0'),
  riskPreference: text("risk_preference").default('moderate'), // 'conservative', 'moderate', 'aggressive'
  successThresholdPct: decimal("success_threshold_pct", { precision: 5, scale: 2 }).default('70'),
  notes: text("notes"), // Markdown supported
  probabilityOfSuccess: decimal("probability_of_success", { precision: 5, scale: 2 }), // Cached value from Monte Carlo
  lastCalculatedAt: timestamp("last_calculated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const goalTasks = pgTable("goal_tasks", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").references(() => goals.id, { onDelete: 'cascade' }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  assignee: text("assignee"), // Could be 'user', 'spouse', 'advisor'
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'cancelled'
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit log for compliance
export const goalAuditLog = pgTable("goal_audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  goalId: integer("goal_id").references(() => goals.id, { onDelete: 'cascade' }),
  taskId: integer("task_id").references(() => goalTasks.id, { onDelete: 'cascade' }),
  action: text("action").notNull(), // 'create', 'update', 'delete'
  entityType: text("entity_type").notNull(), // 'goal', 'task'
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Estate Planning Tables
export const estatePlans = pgTable("estate_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Core Estate Information
  totalEstateValue: decimal("total_estate_value", { precision: 15, scale: 2 }),
  liquidAssets: decimal("liquid_assets", { precision: 15, scale: 2 }),
  illiquidAssets: decimal("illiquid_assets", { precision: 15, scale: 2 }),
  
  // Tax Planning
  federalExemptionUsed: decimal("federal_exemption_used", { precision: 15, scale: 2 }).default('0'),
  stateExemptionUsed: decimal("state_exemption_used", { precision: 15, scale: 2 }).default('0'),
  estimatedFederalEstateTax: decimal("estimated_federal_estate_tax", { precision: 15, scale: 2 }),
  estimatedStateEstateTax: decimal("estimated_state_estate_tax", { precision: 15, scale: 2 }),
  
  // Trust Strategies
  trustStrategies: jsonb("trust_strategies"), // Array of trust configurations
  
  // Distribution Plan
  distributionPlan: jsonb("distribution_plan"), // Beneficiary allocations
  
  // Charitable Planning
  charitableGifts: jsonb("charitable_gifts"), // Planned charitable donations
  
  // Business Succession
  businessSuccessionPlan: jsonb("business_succession_plan"),
  
  // Analysis Results
  analysisResults: jsonb("analysis_results"), // Scenarios, projections, etc.
  
  // Metadata
  lastReviewDate: timestamp("last_review_date"),
  nextReviewDate: timestamp("next_review_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const estateDocuments = pgTable("estate_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  estatePlanId: integer("estate_plan_id").references(() => estatePlans.id, { onDelete: 'cascade' }),
  
  documentType: text("document_type").notNull(), // 'will', 'trust', 'poa', 'healthcare_directive', 'beneficiary_form', 'other'
  documentName: text("document_name").notNull(),
  description: text("description"),
  
  // Document Status
  status: text("status").notNull().default('draft'), // 'draft', 'executed', 'needs_update', 'expired'
  executionDate: timestamp("execution_date"),
  expirationDate: timestamp("expiration_date"),
  lastReviewDate: timestamp("last_review_date"),
  
  // Related Parties
  preparedBy: text("prepared_by"), // Attorney/Professional name
  witnesses: jsonb("witnesses"), // Array of witness names
  notarized: boolean("notarized").default(false),
  forSpouse: boolean("for_spouse").default(false), // true if document belongs to spouse
  
  // Storage
  storageLocation: text("storage_location"), // Physical or digital location
  documentUrl: text("document_url"), // If stored digitally
  
  // Parsed Document Data
  parsedInsights: jsonb("parsed_insights"), // Gemini-parsed document insights
  
  // Reminders
  reviewReminderDays: integer("review_reminder_days").default(365),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const estateBeneficiaries: any = pgTable("estate_beneficiaries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  estatePlanId: integer("estate_plan_id").references(() => estatePlans.id, { onDelete: 'cascade' }),
  
  // Beneficiary Information
  beneficiaryType: text("beneficiary_type").notNull(), // 'individual', 'charity', 'trust'
  name: text("name").notNull(),
  relationship: text("relationship"), // 'spouse', 'child', 'parent', 'sibling', 'friend', 'charity', etc.
  dateOfBirth: timestamp("date_of_birth"),
  taxId: text("tax_id"), // SSN or EIN (encrypted)
  
  // Contact Information
  contactInfo: jsonb("contact_info"), // Address, phone, email
  
  // Distribution Details
  distributionType: text("distribution_type").notNull(), // 'percentage', 'specific_amount', 'specific_assets'
  distributionPercentage: decimal("distribution_percentage", { precision: 5, scale: 2 }),
  distributionAmount: decimal("distribution_amount", { precision: 15, scale: 2 }),
  specificAssets: jsonb("specific_assets"), // List of specific assets
  
  // Conditions
  conditions: text("conditions"), // Any conditions on the distribution
  trustee: text("trustee"), // If distribution is through trust
  ageRestriction: integer("age_restriction"), // Minimum age for distribution
  
  // Contingency
  isPrimary: boolean("is_primary").default(true),
  contingentBeneficiaryId: integer("contingent_beneficiary_id").references(() => estateBeneficiaries.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const estateTrusts = pgTable("estate_trusts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  estatePlanId: integer("estate_plan_id").references(() => estatePlans.id, { onDelete: 'cascade' }),
  
  // Trust Information
  trustType: text("trust_type").notNull(), // 'revocable', 'irrevocable', 'charitable', 'special_needs', etc.
  trustName: text("trust_name").notNull(),
  establishedDate: timestamp("established_date"),
  
  // Parties
  grantor: text("grantor").notNull(),
  trustee: text("trustee").notNull(),
  successorTrustee: text("successor_trustee"),
  beneficiaries: jsonb("beneficiaries"), // Array of beneficiary IDs and details
  
  // Financial Details
  initialFunding: decimal("initial_funding", { precision: 15, scale: 2 }),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  assets: jsonb("assets"), // Assets held in trust
  
  // Terms
  distributionTerms: text("distribution_terms"),
  terminationConditions: text("termination_conditions"),
  taxIdNumber: text("tax_id_number"), // EIN
  
  // Tax Strategy
  taxStrategy: jsonb("tax_strategy"), // GST, estate tax planning, etc.
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const estateScenarios = pgTable("estate_scenarios", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  estatePlanId: integer("estate_plan_id").references(() => estatePlans.id, { onDelete: 'cascade' }),
  
  scenarioName: text("scenario_name").notNull(),
  scenarioType: text("scenario_type").notNull(), // 'death_order', 'tax_law_change', 'asset_value_change'
  description: text("description"),
  
  // Assumptions
  assumptions: jsonb("assumptions"), // Death order, tax rates, asset values, etc.
  
  // Results
  results: jsonb("results"), // Tax calculations, distributions, etc.
  netToHeirs: decimal("net_to_heirs", { precision: 15, scale: 2 }),
  totalTaxes: decimal("total_taxes", { precision: 15, scale: 2 }),
  
  // Comparison
  isBaseline: boolean("is_baseline").default(false),
  comparisonToBaseline: jsonb("comparison_to_baseline"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Education Planning Tables
export const educationGoals = pgTable("education_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Student Information
  studentName: text("student_name").notNull(),
  relationship: text("relationship"), // 'child', 'self', 'spouse', 'grandchild', etc.
  studentBirthYear: integer("student_birth_year"),
  
  // Goal Details
  goalType: text("goal_type").notNull().default('college'), // 'college', 'pre-college'
  degreeType: text("degree_type"), // 'undergraduate', 'masters'
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year").notNull(),
  years: integer("years").notNull(),
  
  // Cost Estimation
  costOption: text("cost_option").notNull(), // 'average', 'specific', 'custom'
  collegeId: text("college_id"), // Reference to specific college if selected
  collegeName: text("college_name"),
  costPerYear: decimal("cost_per_year", { precision: 12, scale: 2 }), // For custom costs
  includeRoomBoard: boolean("include_room_board").default(true), // Whether room & board is included in costPerYear
  isInState: boolean("is_in_state").default(true), // For public colleges, whether student is in-state
  inflationRate: decimal("inflation_rate", { precision: 5, scale: 2 }).default('5.0'),
  
  // Funding Details
  coverPercent: decimal("cover_percent", { precision: 5, scale: 2 }).default('100'),
  scholarshipPerYear: decimal("scholarship_per_year", { precision: 12, scale: 2 }).default('0'),
  loanPerYear: decimal("loan_per_year", { precision: 12, scale: 2 }).default('0'),
  loanInterestRate: decimal("loan_interest_rate", { precision: 5, scale: 2 }).default('10.0'), // Default 10% for Parent PLUS
  loanRepaymentTerm: integer("loan_repayment_term").default(10), // Default 10 years
  loanType: text("loan_type"), // 'parent_plus', 'federal_student', 'private'
  
  // Current Savings
  currentSavings: decimal("current_savings", { precision: 12, scale: 2 }).default('0'),
  monthlyContribution: decimal("monthly_contribution", { precision: 12, scale: 2 }).default('0'),
  accountType: text("account_type"), // '529', 'coverdell', 'custodial', 'other'
  
  // Investment Assumptions
  expectedReturn: decimal("expected_return", { precision: 5, scale: 2 }).default('6.0'),
  riskProfile: text("risk_profile").default('moderate'), // 'conservative', 'moderate', 'aggressive', 'glide'
  
  // State of Residence for 529 tax benefits
  stateOfResidence: text("state_of_residence"),
  
  // Funding sources detail
  fundingSources: jsonb("funding_sources"), // Array of funding sources with type and amount
  
  // Projections (cached calculations)
  projectionData: jsonb("projection_data"), // Contains yearly projections, funding status, etc.
  monthlyContributionNeeded: decimal("monthly_contribution_needed", { precision: 12, scale: 2 }),
  fundingPercentage: decimal("funding_percentage", { precision: 5, scale: 2 }),
  probabilityOfSuccess: decimal("probability_of_success", { precision: 5, scale: 2 }),
  lastCalculatedAt: timestamp("last_calculated_at"),

  // AI Insights persistence
  aiInsights: jsonb("ai_insights"), // { recommendations: Recommendation[] }
  aiInsightsGeneratedAt: timestamp("ai_insights_generated_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// College Reference Data Table
export const collegeReference = pgTable("college_reference", {
  id: text("id").primaryKey(), // IPEDS ID or similar
  name: text("name").notNull(),
  state: text("state").notNull(),
  type: text("type").notNull(), // 'public', 'private', 'community'
  
  // Current Year Costs
  inStateTuition: decimal("in_state_tuition", { precision: 12, scale: 2 }),
  outOfStateTuition: decimal("out_of_state_tuition", { precision: 12, scale: 2 }),
  roomAndBoard: decimal("room_and_board", { precision: 12, scale: 2 }),
  booksAndSupplies: decimal("books_and_supplies", { precision: 12, scale: 2 }),
  otherExpenses: decimal("other_expenses", { precision: 12, scale: 2 }),
  
  // Additional Info
  website: text("website"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// State 529 Plan Information
export const state529Plans = pgTable("state_529_plans", {
  state: text("state").primaryKey(), // Two-letter state code
  stateName: text("state_name").notNull(),
  
  // Tax Benefits
  hasStateTaxDeduction: boolean("has_state_tax_deduction").default(false),
  maxDeductionSingle: decimal("max_deduction_single", { precision: 12, scale: 2 }),
  maxDeductionMarried: decimal("max_deduction_married", { precision: 12, scale: 2 }),
  taxCreditAvailable: boolean("tax_credit_available").default(false),
  taxCreditAmount: decimal("tax_credit_amount", { precision: 12, scale: 2 }),
  
  // Plan Details
  planName: text("plan_name"),
  planWebsite: text("plan_website"),
  specialFeatures: jsonb("special_features"), // Array of special features
  
  // Other Benefits
  otherBenefits: text("other_benefits"),
  restrictions: text("restrictions"),
  
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Education Scenarios (for what-if analysis)

export const educationScenarios = pgTable("education_scenarios", {
  id: serial("id").primaryKey(),
  educationGoalId: integer("education_goal_id").references(() => educationGoals.id, { onDelete: 'cascade' }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  scenarioName: text("scenario_name").notNull(),
  scenarioType: text("scenario_type"), // 'contribution_change', 'cost_change', 'return_change', etc.
  
  // Scenario Parameters
  parameters: jsonb("parameters"), // Contains the modified parameters
  
  // Results
  results: jsonb("results"), // Projected outcomes under this scenario
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Achievement System Tables
export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  achievementId: text("achievement_id").notNull(), // Reference to achievement definition
  unlockedAt: timestamp("unlocked_at").defaultNow(),
  xpEarned: integer("xp_earned").notNull(),
});

export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  totalXP: integer("total_xp").default(0),
  currentLevel: integer("current_level").default(1),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastVisit: timestamp("last_visit").defaultNow(),
  sessionStats: jsonb("session_stats"), // { totalSessions, averageSessionTime, firstSessionDate }
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sectionProgress = pgTable("section_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  section: text("section").notNull(), // 'intake', 'dashboard', 'retirement', etc.
  visits: integer("visits").default(0),
  timeSpent: integer("time_spent").default(0), // in seconds
  actionsCompleted: integer("actions_completed").default(0),
  lastVisit: timestamp("last_visit").defaultNow(),
  completionPercentage: decimal("completion_percentage", { precision: 5, scale: 2 }).default('0'),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Action Plan Task Tracking
export const actionPlanTasks = pgTable("action_plan_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  taskId: text("task_id").notNull(), // Unique identifier for the task (e.g., "emergency-fund-3-months")
  recommendationTitle: text("recommendation_title").notNull(), // Title of the recommendation
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// Debt Management Tables
// ============================================

// User Debts Table
export const debts = pgTable("debts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Debt Details
  debtName: text("debt_name").notNull(),
  debtType: text("debt_type").notNull(), // 'credit_card', 'federal_student_loan', 'private_student_loan', 'auto_loan', 'personal_loan', 'mortgage', 'other'
  owner: text("owner").default('user'), // 'user', 'spouse', 'joint'
  lender: text("lender"),
  accountNumber: text("account_number"), // Last 4 digits only for security
  
  // Financial Details
  originalBalance: decimal("original_balance", { precision: 12, scale: 2 }).notNull(),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).notNull(),
  annualInterestRate: decimal("annual_interest_rate", { precision: 5, scale: 2 }).notNull(), // APR
  minimumPayment: decimal("minimum_payment", { precision: 12, scale: 2 }).notNull(),
  
  // Loan Term Details (optional)
  loanTermMonths: integer("loan_term_months"), // For installment loans
  paymentDueDate: integer("payment_due_date"), // Day of month (1-31)
  origination_date: date("origination_date"),
  maturity_date: date("maturity_date"),
  
  // Status and Tracking
  status: text("status").default('active'), // 'active', 'paid_off', 'consolidated', 'settled'
  isIncludedInPayoff: boolean("is_included_in_payoff").default(true),
  paidOffDate: date("paid_off_date"),
  
  // Additional Details
  notes: text("notes"),
  isSecured: boolean("is_secured").default(false), // Whether the debt is secured (mortgage, auto) or unsecured
  collateral: text("collateral"), // Description of collateral if secured
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }), // For credit cards
  utilization: decimal("utilization", { precision: 5, scale: 2 }), // Credit utilization percentage
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Debt Payoff Plans Table (stores calculated strategies)
export const debtPayoffPlans = pgTable("debt_payoff_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Plan Details
  planName: text("plan_name").notNull(),
  strategy: text("strategy").notNull(), // 'snowball', 'avalanche', 'hybrid', 'custom', 'highest_payment'
  isActive: boolean("is_active").default(false),
  
  // Plan Parameters
  extraMonthlyPayment: decimal("extra_monthly_payment", { precision: 12, scale: 2 }).default('0'),
  startDate: date("start_date").notNull(),
  
  // Calculated Results
  payoffDate: date("payoff_date").notNull(),
  totalInterestPaid: decimal("total_interest_paid", { precision: 12, scale: 2 }).notNull(),
  totalAmountPaid: decimal("total_amount_paid", { precision: 12, scale: 2 }).notNull(),
  monthsToPayoff: integer("months_to_payoff").notNull(),
  interestSaved: decimal("interest_saved", { precision: 12, scale: 2 }), // Compared to minimum payments only
  
  // Debt Order and Schedule
  debtOrder: jsonb("debt_order"), // Array of debt IDs in payoff order
  payoffSchedule: jsonb("payoff_schedule"), // Detailed month-by-month schedule
  
  // Comparison Metrics
  comparisonMetrics: jsonb("comparison_metrics"), // Metrics vs other strategies
  
  // Hybrid Strategy Configuration
  strategyConfig: jsonb("strategy_config"), // Stores quickWinCount, switchTrigger, excludeTypes, etc
  autoPayEnabled: boolean("auto_pay_enabled").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Debt Scenarios Table (what-if analysis)
export const debtScenarios = pgTable("debt_scenarios", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  planId: integer("plan_id").references(() => debtPayoffPlans.id, { onDelete: 'cascade' }),
  
  // Scenario Details
  scenarioName: text("scenario_name").notNull(),
  scenarioType: text("scenario_type").notNull(), // 'extra_payment', 'lump_sum', 'rate_change', 'consolidation', 'new_debt'
  
  // Scenario Parameters
  parameters: jsonb("parameters").notNull(), // Flexible JSON for various scenario types
  
  // Results
  results: jsonb("results").notNull(), // Calculated outcomes
  payoffDate: date("payoff_date"),
  totalInterestPaid: decimal("total_interest_paid", { precision: 12, scale: 2 }),
  monthsToPayoff: integer("months_to_payoff"),
  
  // Comparison with base plan
  monthsSaved: integer("months_saved"),
  interestSaved: decimal("interest_saved", { precision: 12, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Debt Payments Table (tracking actual payments)
export const debtPayments = pgTable("debt_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  debtId: integer("debt_id").references(() => debts.id, { onDelete: 'cascade' }).notNull(),
  
  // Payment Details
  paymentDate: date("payment_date").notNull(),
  paymentAmount: decimal("payment_amount", { precision: 12, scale: 2 }).notNull(),
  principalPaid: decimal("principal_paid", { precision: 12, scale: 2 }).notNull(),
  interestPaid: decimal("interest_paid", { precision: 12, scale: 2 }).notNull(),
  
  // Payment Type
  paymentType: text("payment_type").default('regular'), // 'regular', 'extra', 'lump_sum', 'snowflake'
  
  // Balance After Payment
  balanceAfterPayment: decimal("balance_after_payment", { precision: 12, scale: 2 }).notNull(),
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Debt Milestones Table (for gamification)
export const debtMilestones = pgTable("debt_milestones", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Milestone Details
  milestoneType: text("milestone_type").notNull(), // 'debt_paid_off', 'percentage_paid', 'streak', 'first_extra_payment'
  milestoneValue: text("milestone_value"), // Flexible value based on type
  debtId: integer("debt_id").references(() => debts.id, { onDelete: 'cascade' }),
  
  // Achievement Details
  achievedAt: timestamp("achieved_at").defaultNow(),
  xpEarned: integer("xp_earned").default(0),
  badgeEarned: text("badge_earned"),
  
  // Celebration
  celebrated: boolean("celebrated").default(false),
  celebrationMessage: text("celebration_message"),
});

// Debt AI Insights Table (cache for Gemini recommendations)
export const debtAIInsights = pgTable("debt_ai_insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Insight Details
  insightType: text("insight_type").notNull(), // 'strategy_recommendation', 'progress_update', 'optimization_tip', 'warning'
  insightTitle: text("insight_title").notNull(),
  insightContent: text("insight_content").notNull(),
  
  // Related Data
  relatedDebtId: integer("related_debt_id").references(() => debts.id, { onDelete: 'cascade' }),
  relatedPlanId: integer("related_plan_id").references(() => debtPayoffPlans.id, { onDelete: 'cascade' }),
  
  // Metadata
  priority: integer("priority").default(0), // Higher number = higher priority
  isActionable: boolean("is_actionable").default(false),
  actionTaken: boolean("action_taken").default(false),
  
  // Validity
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// AI-Generated Dashboard Insights
export const dashboardInsights = pgTable("dashboard_insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Insight Content
  insights: jsonb("insights").notNull(), // Array of insight objects with title, description, priority, etc.
  
  // AI Generation Metadata
  generatedByModel: text("generated_by_model").default("gemini-2.5-flash-lite"),
  generationPrompt: text("generation_prompt"), // Store the prompt used for reproducibility
  generationVersion: text("generation_version").default("1.0"), // Track different versions of prompts
  
  // Financial Context at Time of Generation
  financialSnapshot: jsonb("financial_snapshot"), // Snapshot of key financial metrics when generated
  profileDataHash: text("profile_data_hash"), // Hash of profile data to detect changes
  
  // Validity and Status
  isActive: boolean("is_active").default(true),
  validUntil: timestamp("valid_until"), // Auto-expire insights after certain period
  regenerationTriggered: boolean("regeneration_triggered").default(false),
  
  // Usage Analytics
  viewCount: integer("view_count").default(0),
  lastViewed: timestamp("last_viewed"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Advisor White-Label Profile (branding for report headers)
export const whiteLabelProfiles = pgTable("white_label_profiles", {
  id: serial("id").primaryKey(),
  advisorId: integer("advisor_id").references(() => users.id).notNull(),
  firmName: text("firm_name"),
  logoUrl: text("logo_url"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  // Optional default disclaimer text set by advisor (can be overridden per report)
  defaultDisclaimer: text("default_disclaimer"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Persist preferred widget order and insights title per user
export const reportLayouts = pgTable("report_layouts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  layout: jsonb("layout").notNull().default([
    // Default 3x3 order of widget keys
    "financial_health_score",
    "monthly_cash_flow",
    "net_worth",
    "retirement_confidence_gauge",
    "optimization_impact_on_balance",
    "retirement_stress_test",
    "net_worth_projection_optimized",
    "insurance_adequacy_score",
    "emergency_readiness_score",
  ] as any),
  insightsSectionTitle: text("insights_section_title").default("Insights"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Snapshot persisted at generation time for stable PDFs and caching
export const reportSnapshots = pgTable("report_snapshots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  advisorId: integer("advisor_id").references(() => users.id), // if generated by advisor
  layout: jsonb("layout").notNull(),
  widgets: jsonb("widgets").notNull(), // [{key, inputHash, data, computedAt}]
  insights: jsonb("insights").notNull(), // [{id?, text, order, isCustom}]
  insightsTitle: text("insights_title").default("Insights"),
  disclaimerText: text("disclaimer_text"),
  disclaimerVersion: text("disclaimer_version").default("1.0"),
  themeVersion: text("theme_version").default("report-light-1"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const achievementDefinitions = pgTable("achievement_definitions", {
  id: text("id").primaryKey(), // e.g., 'first-steps', 'speed-demon'
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  category: text("category").notNull(), // 'intake', 'dashboard', 'retirement', etc.
  xp: integer("xp").notNull(),
  requirementType: text("requirement_type").notNull(), // 'visit', 'time', 'action', 'streak', 'completion'
  requirementValue: integer("requirement_value").notNull(),
  requirementTarget: text("requirement_target"), // Optional target specification
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  financialProfile: one(financialProfiles),
  chatMessages: many(chatMessages),
  chatDocuments: many(chatDocuments),
  pdfReports: many(pdfReports),
  investmentCache: many(investmentCache),
  widgetCache: many(widgetCache),
  whiteLabelProfiles: many(whiteLabelProfiles),
  reportLayouts: many(reportLayouts),
  reportSnapshots: many(reportSnapshots),
  goals: many(goals),
  goalTasks: many(goalTasks),
  goalAuditLog: many(goalAuditLog),
  estatePlans: many(estatePlans),
  estateDocuments: many(estateDocuments),
  estateBeneficiaries: many(estateBeneficiaries),
  estateTrusts: many(estateTrusts),
  estateScenarios: many(estateScenarios),
  educationGoals: many(educationGoals),
  lifeGoals: many(lifeGoalsTable),
  educationScenarios: many(educationScenarios),
  userAchievements: many(userAchievements),
  userProgress: one(userProgress),
  sectionProgress: many(sectionProgress),
  actionPlanTasks: many(actionPlanTasks),
  // Debt Management Relations
  debts: many(debts),
  debtPayoffPlans: many(debtPayoffPlans),
  debtScenarios: many(debtScenarios),
  debtPayments: many(debtPayments),
  debtMilestones: many(debtMilestones),
  debtAIInsights: many(debtAIInsights),
  // Dashboard Insights
  dashboardInsights: many(dashboardInsights),
}));

export const financialProfilesRelations = relations(financialProfiles, ({ one }) => ({
  user: one(users, {
    fields: [financialProfiles.userId],
    references: [users.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one, many }) => ({
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
  documents: many(chatDocuments),
}));

export const chatDocumentsRelations = relations(chatDocuments, ({ one }) => ({
  user: one(users, {
    fields: [chatDocuments.userId],
    references: [users.id],
  }),
  message: one(chatMessages, {
    fields: [chatDocuments.messageId],
    references: [chatMessages.id],
  }),
}));

export const pdfReportsRelations = relations(pdfReports, ({ one }) => ({
  user: one(users, {
    fields: [pdfReports.userId],
    references: [users.id],
  }),
}));

export const investmentCacheRelations = relations(investmentCache, ({ one }) => ({
  user: one(users, {
    fields: [investmentCache.userId],
    references: [users.id],
  }),
}));

export const widgetCacheRelations = relations(widgetCache, ({ one }) => ({
  user: one(users, {
    fields: [widgetCache.userId],
    references: [users.id],
  }),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id],
  }),
  tasks: many(goalTasks),
  auditLogs: many(goalAuditLog),
}));

export const goalTasksRelations = relations(goalTasks, ({ one, many }) => ({
  user: one(users, {
    fields: [goalTasks.userId],
    references: [users.id],
  }),
  goal: one(goals, {
    fields: [goalTasks.goalId],
    references: [goals.id],
  }),
  auditLogs: many(goalAuditLog),
}));

export const goalAuditLogRelations = relations(goalAuditLog, ({ one }) => ({
  user: one(users, {
    fields: [goalAuditLog.userId],
    references: [users.id],
  }),
  goal: one(goals, {
    fields: [goalAuditLog.goalId],
    references: [goals.id],
  }),
  task: one(goalTasks, {
    fields: [goalAuditLog.taskId],
    references: [goalTasks.id],
  }),
}));

// Estate Planning Relations
export const estatePlansRelations = relations(estatePlans, ({ one, many }) => ({
  user: one(users, {
    fields: [estatePlans.userId],
    references: [users.id],
  }),
  documents: many(estateDocuments),
  beneficiaries: many(estateBeneficiaries),
  trusts: many(estateTrusts),
  scenarios: many(estateScenarios),
}));

export const estateDocumentsRelations = relations(estateDocuments, ({ one }) => ({
  user: one(users, {
    fields: [estateDocuments.userId],
    references: [users.id],
  }),
  estatePlan: one(estatePlans, {
    fields: [estateDocuments.estatePlanId],
    references: [estatePlans.id],
  }),
}));

export const estateBeneficiariesRelations = relations(estateBeneficiaries, ({ one }) => ({
  user: one(users, {
    fields: [estateBeneficiaries.userId],
    references: [users.id],
  }),
  estatePlan: one(estatePlans, {
    fields: [estateBeneficiaries.estatePlanId],
    references: [estatePlans.id],
  }),
  contingentBeneficiary: one(estateBeneficiaries, {
    fields: [estateBeneficiaries.contingentBeneficiaryId],
    references: [estateBeneficiaries.id],
  }),
}));

export const estateTrustsRelations = relations(estateTrusts, ({ one }) => ({
  user: one(users, {
    fields: [estateTrusts.userId],
    references: [users.id],
  }),
  estatePlan: one(estatePlans, {
    fields: [estateTrusts.estatePlanId],
    references: [estatePlans.id],
  }),
}));

export const estateScenariosRelations = relations(estateScenarios, ({ one }) => ({
  user: one(users, {
    fields: [estateScenarios.userId],
    references: [users.id],
  }),
  estatePlan: one(estatePlans, {
    fields: [estateScenarios.estatePlanId],
    references: [estatePlans.id],
  }),
}));

// Education Goals Relations
export const educationGoalsRelations = relations(educationGoals, ({ one, many }) => ({
  user: one(users, {
    fields: [educationGoals.userId],
    references: [users.id],
  }),
  scenarios: many(educationScenarios),
}));

export const lifeGoalsRelations = relations(lifeGoalsTable, ({ one }) => ({
  user: one(users, {
    fields: [lifeGoalsTable.userId],
    references: [users.id],
  }),
}));

export const educationScenariosRelations = relations(educationScenarios, ({ one }) => ({
  user: one(users, {
    fields: [educationScenarios.userId],
    references: [users.id],
  }),
  educationGoal: one(educationGoals, {
    fields: [educationScenarios.educationGoalId],
    references: [educationGoals.id],
  }),
}));

// Achievement System Relations
export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievementDefinition: one(achievementDefinitions, {
    fields: [userAchievements.achievementId],
    references: [achievementDefinitions.id],
  }),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, {
    fields: [userProgress.userId],
    references: [users.id],
  }),
}));

export const sectionProgressRelations = relations(sectionProgress, ({ one }) => ({
  user: one(users, {
    fields: [sectionProgress.userId],
    references: [users.id],
  }),
}));

export const achievementDefinitionsRelations = relations(achievementDefinitions, ({ many }) => ({
  userAchievements: many(userAchievements),
}));

export const actionPlanTasksRelations = relations(actionPlanTasks, ({ one }) => ({
  user: one(users, {
    fields: [actionPlanTasks.userId],
    references: [users.id],
  }),
}));

// Zod Schemas
// Debt Management Relations
export const debtsRelations = relations(debts, ({ one, many }) => ({
  user: one(users, {
    fields: [debts.userId],
    references: [users.id],
  }),
  payments: many(debtPayments),
  milestones: many(debtMilestones),
  aiInsights: many(debtAIInsights),
}));

export const debtPayoffPlansRelations = relations(debtPayoffPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [debtPayoffPlans.userId],
    references: [users.id],
  }),
  scenarios: many(debtScenarios),
  aiInsights: many(debtAIInsights),
}));

export const debtScenariosRelations = relations(debtScenarios, ({ one }) => ({
  user: one(users, {
    fields: [debtScenarios.userId],
    references: [users.id],
  }),
  plan: one(debtPayoffPlans, {
    fields: [debtScenarios.planId],
    references: [debtPayoffPlans.id],
  }),
}));

export const debtPaymentsRelations = relations(debtPayments, ({ one }) => ({
  user: one(users, {
    fields: [debtPayments.userId],
    references: [users.id],
  }),
  debt: one(debts, {
    fields: [debtPayments.debtId],
    references: [debts.id],
  }),
}));

export const debtMilestonesRelations = relations(debtMilestones, ({ one }) => ({
  user: one(users, {
    fields: [debtMilestones.userId],
    references: [users.id],
  }),
  debt: one(debts, {
    fields: [debtMilestones.debtId],
    references: [debts.id],
  }),
}));

export const debtAIInsightsRelations = relations(debtAIInsights, ({ one }) => ({
  user: one(users, {
    fields: [debtAIInsights.userId],
    references: [users.id],
  }),
  debt: one(debts, {
    fields: [debtAIInsights.relatedDebtId],
    references: [debts.id],
  }),
  plan: one(debtPayoffPlans, {
    fields: [debtAIInsights.relatedPlanId],
    references: [debtPayoffPlans.id],
  }),
}));

export const dashboardInsightsRelations = relations(dashboardInsights, ({ one }) => ({
  user: one(users, {
    fields: [dashboardInsights.userId],
    references: [users.id],
  }),
}));

export const whiteLabelProfilesRelations = relations(whiteLabelProfiles, ({ one }) => ({
  advisor: one(users, {
    fields: [whiteLabelProfiles.advisorId],
    references: [users.id],
  }),
}));

export const reportLayoutsRelations = relations(reportLayouts, ({ one }) => ({
  user: one(users, {
    fields: [reportLayouts.userId],
    references: [users.id],
  }),
}));

export const reportSnapshotsRelations = relations(reportSnapshots, ({ one }) => ({
  user: one(users, {
    fields: [reportSnapshots.userId],
    references: [users.id],
  }),
  advisor: one(users, {
    fields: [reportSnapshots.advisorId],
    references: [users.id],
  })
}));

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  role: true,
  fullName: true,
});

export const insertFinancialProfileSchema = createInsertSchema(financialProfiles).omit({
  id: true,
  userId: true,
  lastUpdated: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  userId: true,
  timestamp: true,
});

export const insertChatDocumentSchema = createInsertSchema(chatDocuments).omit({
  id: true,
  userId: true,
  uploadedAt: true,
  processedAt: true,
  updatedAt: true,
});

export const insertGoalSchema = createInsertSchema(goals).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  lastCalculatedAt: true,
  probabilityOfSuccess: true,
});

export const insertGoalTaskSchema = createInsertSchema(goalTasks).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

// Estate Planning Schemas
export const insertEstatePlanSchema = createInsertSchema(estatePlans).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEstateDocumentSchema = createInsertSchema(estateDocuments).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEstateBeneficiarySchema = createInsertSchema(estateBeneficiaries).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEstateTrustSchema = createInsertSchema(estateTrusts).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEstateScenarioSchema = createInsertSchema(estateScenarios).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Education Planning Insert Schemas
export const insertLifeGoalSchema = createInsertSchema(lifeGoalsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEducationGoalSchema = createInsertSchema(educationGoals).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCollegeReferenceSchema = createInsertSchema(collegeReference).omit({
  lastUpdated: true,
});

export const insertState529PlanSchema = createInsertSchema(state529Plans).omit({
  lastUpdated: true,
});

export const insertEducationScenarioSchema = createInsertSchema(educationScenarios).omit({
  id: true,
  userId: true,
  createdAt: true,
});

// Dashboard Insights Insert Schema
export const insertDashboardInsightsSchema = createInsertSchema(dashboardInsights).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Report-related insert schemas
export const insertWhiteLabelProfileSchema = createInsertSchema(whiteLabelProfiles).omit({
  id: true,
  advisorId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReportLayoutSchema = createInsertSchema(reportLayouts).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReportSnapshotSchema = createInsertSchema(reportSnapshots).omit({
  id: true,
  userId: true,
  advisorId: true,
  createdAt: true,
});

// Goal type enum for validation
export const goalTypeEnum = z.enum(['retirement', 'college', 'home', 'travel', 'healthcare', 'custom']);
export const riskPreferenceEnum = z.enum(['conservative', 'moderate', 'aggressive']);
export const taskStatusEnum = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);

// Estate Planning enums
export const documentTypeEnum = z.enum(['will', 'trust', 'poa', 'healthcare_directive', 'beneficiary_form', 'other']);
export const documentStatusEnum = z.enum(['draft', 'executed', 'needs_update', 'expired']);
export const beneficiaryTypeEnum = z.enum(['individual', 'charity', 'trust']);
export const distributionTypeEnum = z.enum(['percentage', 'specific_amount', 'specific_assets']);
export const trustTypeEnum = z.enum(['revocable', 'irrevocable', 'charitable', 'special_needs', 'generation_skipping', 'qualified_personal_residence', 'grantor_retained_annuity']);
export const scenarioTypeEnum = z.enum(['death_order', 'tax_law_change', 'asset_value_change', 'baseline']);

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type AdvisorClient = typeof advisorClients.$inferSelect;
export type AdvisorInvite = typeof advisorInvites.$inferSelect;
export type AdvisorAuditLog = typeof advisorAuditLogs.$inferSelect;
export type FinancialProfile = typeof financialProfiles.$inferSelect;
export type InsertFinancialProfile = z.infer<typeof insertFinancialProfileSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatDocument = typeof chatDocuments.$inferSelect;
export type InsertChatDocument = z.infer<typeof insertChatDocumentSchema>;
export type PdfReport = typeof pdfReports.$inferSelect;
export type InvestmentCache = typeof investmentCache.$inferSelect;
export type WidgetCache = typeof widgetCache.$inferSelect;
export type InsertWidgetCache = typeof widgetCache.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type GoalTask = typeof goalTasks.$inferSelect;
export type InsertGoalTask = z.infer<typeof insertGoalTaskSchema>;
export type GoalAuditLog = typeof goalAuditLog.$inferSelect;

// Estate Planning Types
export type EstatePlan = typeof estatePlans.$inferSelect;
export type InsertEstatePlan = z.infer<typeof insertEstatePlanSchema>;
export type EstateDocument = typeof estateDocuments.$inferSelect;
export type InsertEstateDocument = z.infer<typeof insertEstateDocumentSchema>;
export type EstateBeneficiary = typeof estateBeneficiaries.$inferSelect;
export type InsertEstateBeneficiary = z.infer<typeof insertEstateBeneficiarySchema>;
export type EstateTrust = typeof estateTrusts.$inferSelect;
export type InsertEstateTrust = z.infer<typeof insertEstateTrustSchema>;
export type EstateScenario = typeof estateScenarios.$inferSelect;
export type InsertEstateScenario = z.infer<typeof insertEstateScenarioSchema>;

// Education Planning Types
export type EducationGoal = typeof educationGoals.$inferSelect;
export type LifeGoal = typeof lifeGoalsTable.$inferSelect;
export type InsertLifeGoal = typeof lifeGoalsTable.$inferInsert;
export type InsertEducationGoal = z.infer<typeof insertEducationGoalSchema>;
export type CollegeReference = typeof collegeReference.$inferSelect;
export type InsertCollegeReference = z.infer<typeof insertCollegeReferenceSchema>;
export type State529Plan = typeof state529Plans.$inferSelect;
export type InsertState529Plan = z.infer<typeof insertState529PlanSchema>;
export type EducationScenario = typeof educationScenarios.$inferSelect;
export type InsertEducationScenario = z.infer<typeof insertEducationScenarioSchema>;

// Achievement System Types
export type UserAchievement = typeof userAchievements.$inferSelect;
export type UserProgress = typeof userProgress.$inferSelect;
export type SectionProgress = typeof sectionProgress.$inferSelect;
export type AchievementDefinition = typeof achievementDefinitions.$inferSelect;

// Action Plan Task Types
export type ActionPlanTask = typeof actionPlanTasks.$inferSelect;

// Dashboard Insights Types
export type DashboardInsight = typeof dashboardInsights.$inferSelect;
export type InsertDashboardInsight = z.infer<typeof insertDashboardInsightsSchema>;

// Report-related types
export type WhiteLabelProfile = typeof whiteLabelProfiles.$inferSelect;
export type InsertWhiteLabelProfile = z.infer<typeof insertWhiteLabelProfileSchema>;
export type ReportLayout = typeof reportLayouts.$inferSelect;
export type InsertReportLayout = z.infer<typeof insertReportLayoutSchema>;
export type ReportSnapshot = typeof reportSnapshots.$inferSelect;
export type InsertReportSnapshot = z.infer<typeof insertReportSnapshotSchema>;

// ============================================
// Plaid Integration Tables
// ============================================

// Plaid Items - stores access tokens and item metadata
export const plaidItems = pgTable("plaid_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accessToken: text("access_token").notNull(),
  itemId: text("item_id").notNull().unique(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  status: text("status").default('active'), // 'active', 'requires_reauth', 'error', 'removed'
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  consentExpirationTime: timestamp("consent_expiration_time"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Plaid Accounts - individual accounts from each item
export const plaidAccounts = pgTable("plaid_accounts", {
  id: serial("id").primaryKey(),
  plaidItemId: integer("plaid_item_id").references(() => plaidItems.id, { onDelete: 'cascade' }),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountId: text("account_id").notNull().unique(),
  accountName: text("account_name"),
  officialName: text("official_name"),
  accountType: text("account_type"), // 'depository', 'investment', 'loan', 'credit'
  accountSubtype: text("account_subtype"), // 'checking', 'savings', 'credit_card', 'mortgage', etc.
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }),
  availableBalance: decimal("available_balance", { precision: 12, scale: 2 }),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
  currency: text("currency").default('USD'),
  mask: text("mask"), // Last 4 digits
  isActive: boolean("is_active").default(true),
  lastSynced: timestamp("last_synced"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Plaid Transactions
export const plaidTransactions = pgTable("plaid_transactions", {
  id: serial("id").primaryKey(),
  plaidAccountId: integer("plaid_account_id").references(() => plaidAccounts.id, { onDelete: 'cascade' }),
  userId: integer("user_id").references(() => users.id).notNull(),
  transactionId: text("transaction_id").notNull().unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  authorizedDate: date("authorized_date"),
  name: text("name"),
  merchantName: text("merchant_name"),
  category: jsonb("category"), // Array of category hierarchy
  primaryCategory: text("primary_category"),
  detailedCategory: text("detailed_category"),
  pending: boolean("pending").default(false),
  paymentChannel: text("payment_channel"), // 'online', 'in_store', 'other'
  location: jsonb("location"),
  accountOwner: text("account_owner"),
  isoCurrencyCode: text("iso_currency_code").default('USD'),
  unofficialCurrencyCode: text("unofficial_currency_code"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Plaid Investment Holdings
export const plaidInvestmentHoldings = pgTable("plaid_investment_holdings", {
  id: serial("id").primaryKey(),
  plaidAccountId: integer("plaid_account_id").references(() => plaidAccounts.id, { onDelete: 'cascade' }),
  userId: integer("user_id").references(() => users.id).notNull(),
  holdingId: text("holding_id").notNull(),
  securityId: text("security_id"),
  costBasis: decimal("cost_basis", { precision: 12, scale: 2 }),
  quantity: decimal("quantity", { precision: 15, scale: 6 }),
  price: decimal("price", { precision: 12, scale: 4 }),
  priceAsOf: date("price_as_of"),
  value: decimal("value", { precision: 12, scale: 2 }),
  symbol: text("symbol"),
  name: text("name"),
  type: text("type"), // 'equity', 'mutual_fund', 'etf', 'bond', etc.
  isoCurrencyCode: text("iso_currency_code").default('USD'),
  unofficialCurrencyCode: text("unofficial_currency_code"),
  lastSynced: timestamp("last_synced"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Plaid Liabilities
export const plaidLiabilities = pgTable("plaid_liabilities", {
  id: serial("id").primaryKey(),
  plaidAccountId: integer("plaid_account_id").references(() => plaidAccounts.id, { onDelete: 'cascade' }),
  userId: integer("user_id").references(() => users.id).notNull(),
  liabilityType: text("liability_type"), // 'mortgage', 'student_loan', 'credit_card'
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }),
  originalBalance: decimal("original_balance", { precision: 12, scale: 2 }),
  minimumPayment: decimal("minimum_payment", { precision: 12, scale: 2 }),
  nextPaymentDueDate: date("next_payment_due_date"),
  interestRate: decimal("interest_rate", { precision: 5, scale: 3 }),
  apr: decimal("apr", { precision: 5, scale: 3 }),
  loanTermMonths: integer("loan_term_months"),
  originationDate: date("origination_date"),
  principalBalance: decimal("principal_balance", { precision: 12, scale: 2 }),
  interestBalance: decimal("interest_balance", { precision: 12, scale: 2 }),
  escrowBalance: decimal("escrow_balance", { precision: 12, scale: 2 }),
  lastPaymentAmount: decimal("last_payment_amount", { precision: 12, scale: 2 }),
  lastPaymentDate: date("last_payment_date"),
  ytdInterestPaid: decimal("ytd_interest_paid", { precision: 12, scale: 2 }),
  ytdPrincipalPaid: decimal("ytd_principal_paid", { precision: 12, scale: 2 }),
  metadata: jsonb("metadata"),
  lastSynced: timestamp("last_synced"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Plaid Webhook Events
export const plaidWebhookEvents = pgTable("plaid_webhook_events", {
  id: serial("id").primaryKey(),
  webhookType: text("webhook_type").notNull(),
  webhookCode: text("webhook_code").notNull(),
  itemId: text("item_id"),
  plaidItemId: integer("plaid_item_id").references(() => plaidItems.id),
  error: jsonb("error"),
  newTransactions: integer("new_transactions"),
  removedTransactions: jsonb("removed_transactions"),
  requestId: text("request_id"),
  payload: jsonb("payload"),
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Plaid Sync Status
export const plaidSyncStatus = pgTable("plaid_sync_status", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  lastAccountsSync: timestamp("last_accounts_sync"),
  lastTransactionsSync: timestamp("last_transactions_sync"),
  lastHoldingsSync: timestamp("last_holdings_sync"),
  lastLiabilitiesSync: timestamp("last_liabilities_sync"),
  transactionsCursor: text("transactions_cursor"),
  syncInProgress: boolean("sync_in_progress").default(false),
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Plaid Account Mappings - for categorizing and managing Plaid accounts
export const plaidAccountMappings = pgTable("plaid_account_mappings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  plaidAccountId: integer("plaid_account_id").references(() => plaidAccounts.id, { onDelete: 'cascade' }),
  
  // Categorization
  category: text("category").notNull(), // 'asset' or 'liability'
  subcategory: text("subcategory"), // 'retirement', 'investment', 'banking', 'emergency', 'debt', 'education'
  assetType: text("asset_type"), // For investments: 'stocks', 'bonds', 'cash', 'alternatives'
  
  // Ownership and allocation
  owner: text("owner").default('user'), // 'user', 'spouse', 'joint'
  allocationPercentage: decimal("allocation_percentage", { precision: 5, scale: 2 }).default('100'),
  
  // User preferences
  includeInCalculations: boolean("include_in_calculations").default(true),
  isEmergencyFund: boolean("is_emergency_fund").default(false),
  isRetirementAccount: boolean("is_retirement_account").default(false),
  isEducationAccount: boolean("is_education_account").default(false),
  customName: text("custom_name"),
  
  // Tags and notes
  tags: jsonb("tags"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Plaid Sync Schedule - manages automatic syncing
export const plaidSyncSchedule = pgTable("plaid_sync_schedule", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  
  // Schedule settings
  syncFrequency: text("sync_frequency").default('monthly'), // 'daily', 'weekly', 'monthly', 'manual'
  nextSyncDate: timestamp("next_sync_date"),
  lastFullSync: timestamp("last_full_sync"),
  lastPartialSync: timestamp("last_partial_sync"),
  
  // Sync preferences
  autoSyncEnabled: boolean("auto_sync_enabled").default(true),
  syncTransactions: boolean("sync_transactions").default(true),
  syncInvestments: boolean("sync_investments").default(true),
  syncLiabilities: boolean("sync_liabilities").default(true),
  transactionDaysToSync: integer("transaction_days_to_sync").default(30),
  
  // Rate limiting
  manualSyncsToday: integer("manual_syncs_today").default(0),
  manualSyncResetDate: date("manual_sync_reset_date"),
  
  // Notifications
  notifyOnSync: boolean("notify_on_sync").default(true),
  notifyOnLargeChanges: boolean("notify_on_large_changes").default(true),
  largeChangeThreshold: decimal("large_change_threshold", { precision: 12, scale: 2 }).default('10000'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Plaid Aggregated Snapshot - cached calculations
export const plaidAggregatedSnapshot = pgTable("plaid_aggregated_snapshot", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Aggregated balances
  totalAssets: decimal("total_assets", { precision: 15, scale: 2 }),
  totalLiabilities: decimal("total_liabilities", { precision: 15, scale: 2 }),
  netWorth: decimal("net_worth", { precision: 15, scale: 2 }),
  
  // Asset breakdown
  bankingAssets: decimal("banking_assets", { precision: 15, scale: 2 }),
  investmentAssets: decimal("investment_assets", { precision: 15, scale: 2 }),
  retirementAssets: decimal("retirement_assets", { precision: 15, scale: 2 }),
  emergencyFunds: decimal("emergency_funds", { precision: 15, scale: 2 }),
  educationFunds: decimal("education_funds", { precision: 15, scale: 2 }),
  
  // Liability breakdown
  creditCardDebt: decimal("credit_card_debt", { precision: 15, scale: 2 }),
  studentLoans: decimal("student_loans", { precision: 15, scale: 2 }),
  personalLoans: decimal("personal_loans", { precision: 15, scale: 2 }),
  mortgageDebt: decimal("mortgage_debt", { precision: 15, scale: 2 }),
  otherDebt: decimal("other_debt", { precision: 15, scale: 2 }),
  
  // Cash flow
  monthlyIncome: decimal("monthly_income", { precision: 12, scale: 2 }),
  monthlyExpenses: decimal("monthly_expenses", { precision: 12, scale: 2 }),
  monthlyNetCashFlow: decimal("monthly_net_cash_flow", { precision: 12, scale: 2 }),
  
  // Investment allocation (percentages)
  stocksPercentage: decimal("stocks_percentage", { precision: 5, scale: 2 }),
  bondsPercentage: decimal("bonds_percentage", { precision: 5, scale: 2 }),
  cashPercentage: decimal("cash_percentage", { precision: 5, scale: 2 }),
  alternativesPercentage: decimal("alternatives_percentage", { precision: 5, scale: 2 }),
  
  // Ownership split
  userAssets: decimal("user_assets", { precision: 15, scale: 2 }),
  spouseAssets: decimal("spouse_assets", { precision: 15, scale: 2 }),
  jointAssets: decimal("joint_assets", { precision: 15, scale: 2 }),
  
  // Metadata
  snapshotDate: timestamp("snapshot_date").defaultNow(),
  dataSources: jsonb("data_sources"), // {'plaid': true, 'manual': true}
  accountCount: integer("account_count"),
  linkedAccountCount: integer("linked_account_count"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Plaid Types
export type PlaidItem = typeof plaidItems.$inferSelect;
export type InsertPlaidItem = typeof plaidItems.$inferInsert;
export type PlaidAccount = typeof plaidAccounts.$inferSelect;
export type InsertPlaidAccount = typeof plaidAccounts.$inferInsert;
export type PlaidTransaction = typeof plaidTransactions.$inferSelect;
export type InsertPlaidTransaction = typeof plaidTransactions.$inferInsert;
export type PlaidInvestmentHolding = typeof plaidInvestmentHoldings.$inferSelect;
export type InsertPlaidInvestmentHolding = typeof plaidInvestmentHoldings.$inferInsert;
export type PlaidLiability = typeof plaidLiabilities.$inferSelect;
export type InsertPlaidLiability = typeof plaidLiabilities.$inferInsert;
export type PlaidWebhookEvent = typeof plaidWebhookEvents.$inferSelect;
export type InsertPlaidWebhookEvent = typeof plaidWebhookEvents.$inferInsert;
export type PlaidSyncStatus = typeof plaidSyncStatus.$inferSelect;
export type InsertPlaidSyncStatus = typeof plaidSyncStatus.$inferInsert;
export type PlaidAccountMapping = typeof plaidAccountMappings.$inferSelect;
export type InsertPlaidAccountMapping = typeof plaidAccountMappings.$inferInsert;
export type PlaidSyncSchedule = typeof plaidSyncSchedule.$inferSelect;
export type InsertPlaidSyncSchedule = typeof plaidSyncSchedule.$inferInsert;
export type PlaidAggregatedSnapshot = typeof plaidAggregatedSnapshot.$inferSelect;
export type InsertPlaidAggregatedSnapshot = typeof plaidAggregatedSnapshot.$inferInsert;

// Security & Compliance Tables
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }).notNull(),
  resourceId: varchar("resource_id", { length: 255 }),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const userConsents = pgTable("user_consents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  consentType: varchar("consent_type", { length: 50 }).notNull(),
  granted: boolean("granted").notNull().default(false),
  grantedAt: timestamp("granted_at"),
  revokedAt: timestamp("revoked_at"),
  ipAddress: text("ip_address"),
  consentVersion: varchar("consent_version", { length: 20 }),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const securityEvents = pgTable("security_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  description: text("description"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  resolved: boolean("resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const tokenRotations = pgTable("token_rotations", {
  id: serial("id").primaryKey(),
  plaidItemId: integer("plaid_item_id").references(() => plaidItems.id).notNull(),
  oldTokenHash: varchar("old_token_hash", { length: 64 }),
  newTokenHash: varchar("new_token_hash", { length: 64 }),
  rotationReason: varchar("rotation_reason", { length: 50 }),
  rotatedAt: timestamp("rotated_at").defaultNow().notNull(),
  rotatedBy: integer("rotated_by").references(() => users.id),
  success: boolean("success").default(true),
  errorMessage: text("error_message")
});

export const dataAccessLogs = pgTable("data_access_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  accessedBy: integer("accessed_by").references(() => users.id),
  dataType: varchar("data_type", { length: 50 }).notNull(),
  purpose: varchar("purpose", { length: 100 }).notNull(),
  fieldsAccessed: text("fields_accessed").array(),
  exportFormat: varchar("export_format", { length: 20 }),
  ipAddress: text("ip_address"),
  accessedAt: timestamp("accessed_at").defaultNow().notNull()
});

// Plaid Sync Recovery - for managing failed sync retries
export const plaidSyncRecovery = pgTable("plaid_sync_recovery", {
  id: serial("id").primaryKey(),
  plaidItemId: integer("plaid_item_id").references(() => plaidItems.id, { onDelete: 'cascade' }),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }),
  syncType: text("sync_type").notNull(), // 'accounts', 'transactions', 'investments', 'liabilities'
  status: text("status").default('pending'), // 'pending', 'failed', 'recovered'
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  lastError: text("last_error"),
  lastAttemptAt: timestamp("last_attempt_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Security table types
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type UserConsent = typeof userConsents.$inferSelect;
export type InsertUserConsent = typeof userConsents.$inferInsert;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type InsertSecurityEvent = typeof securityEvents.$inferInsert;
export type TokenRotation = typeof tokenRotations.$inferSelect;
export type InsertTokenRotation = typeof tokenRotations.$inferInsert;
export type DataAccessLog = typeof dataAccessLogs.$inferSelect;
export type InsertDataAccessLog = typeof dataAccessLogs.$inferInsert;
