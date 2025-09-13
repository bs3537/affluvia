import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { createOpenAIClient, respondJsonHighReasoning } from "./services/openai-client";
import { z } from "zod";

const openaiClient = createOpenAIClient();

// Schema for education tips request
const educationTipsSchema = z.object({
  category: z.enum(["general", "budgeting", "investing", "retirement", "tax", "insurance", "emergency", "debt"]).optional(),
  userLevel: z.enum(["beginner", "intermediate", "advanced"]).optional().default("beginner")
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Financial profile routes
  app.get("/api/financial-profile", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const profile = await storage.getFinancialProfile(req.user!.id);

      if (profile) {
        console.log('Retrieved profile from database:', {
          hasCalculations: !!profile.calculations,
          healthScore: profile.calculations?.healthScore,
          breakdown: profile.calculations?.breakdown
        });

        // Always use stored calculations if they exist
        if (profile.calculations && typeof profile.calculations === 'object') {
          console.log('Using stored calculations from database');
          res.json(profile);
        } else {
          // Calculate fresh metrics only if no stored calculations exist
          console.log('No stored calculations found, calculating fresh');
          const calculations = calculateFinancialMetrics(profile);
          const profileWithCalculations = {
            ...profile,
            calculations
          };
          res.json(profileWithCalculations);
        }
      } else {
        res.json(null);
      }
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/financial-profile", async (req, res, next) => {
    try {
      console.log('Authentication check for financial profile update:', {
        isAuthenticated: req.isAuthenticated(),
        hasUser: !!req.user,
        userId: req.user?.id,
        sessionId: req.sessionID,
        hasSession: !!req.session
      });

      if (!req.isAuthenticated()) {
        console.log('Authentication failed - returning 401');
        return res.sendStatus(401);
      }

      console.log('Recalculating financial metrics for updated profile...');
      console.log('Request body keys:', Object.keys(req.body));

      // Validate required fields
      if (!req.body.firstName || !req.body.lastName) {
        return res.status(400).json({
          error: 'Validation Error',
          details: 'First name and last name are required'
        });
      }

      if (!req.body.annualIncome || req.body.annualIncome <= 0) {
        return res.status(400).json({
          error: 'Validation Error', 
          details: 'Valid annual income is required'
        });
      }

      // Always calculate fresh metrics when profile is updated
      console.log('Input data for calculations:', {
        hasRiskQuestions: !!req.body.riskQuestions,
        riskQuestionsArray: req.body.riskQuestions,
        riskQuestionsLength: req.body.riskQuestions?.length,
        hasGoals: !!req.body.goals,
        goalsLength: req.body.goals?.length,
        annualIncome: req.body.annualIncome
      });

      const calculations = calculateFinancialMetrics(req.body);

      console.log('Calculated financial metrics:', {
        healthScore: calculations.healthScore,
        riskProfile: calculations.riskProfile,
        riskScore: calculations.riskScore,
        breakdown: calculations.breakdown,
        hasRecommendations: !!calculations.recommendations,
        recommendationsCount: calculations.recommendations?.length || 0
      });

      // Store the profile data with fresh calculations
      const profileData = {
        ...req.body,
        calculations,
        lastUpdated: new Date()
      };

      const profile = await storage.updateFinancialProfile(
        req.user!.id,
        profileData,
      );

      console.log('Saved profile with fresh calculations:', {
        hasCalculations: !!profile.calculations,
        healthScore: profile.calculations?.healthScore,
        breakdown: profile.calculations?.breakdown,
        recommendationsCount: profile.calculations?.recommendations?.length || 0
      });

      res.json(profile);
    } catch (error) {
      console.error('Error in PUT /api/financial-profile:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        requestBodyKeys: Object.keys(req.body || {})
      });

      // Send a more specific error response
      res.status(500).json({ 
        error: 'Failed to save financial profile', 
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Chat routes
  app.get("/api/chat-messages", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const messages = await storage.getChatMessages(req.user!.id);
      res.json(messages);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/chat-messages", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      // Generate AI response using Gemini API
      const aiResponse = await generateAIResponse(
        req.body.message,
        req.user!.id,
      );

      const message = await storage.createChatMessage(req.user!.id, {
        message: req.body.message,
        response: aiResponse,
      });

      res.json(message);
    } catch (error) {
      next(error);
    }
  });

  // PDF report generation
  app.post("/api/generate-report", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      // Here we would generate a PDF report
      // For now, we'll return a success message
      res.json({ message: "PDF report generated successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Data deletion route
  app.delete("/api/delete-data", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      // Here we would delete all user data
      // For now, we'll return a success message
      res.json({ message: "Data deletion requested" });
    } catch (error) {
      next(error);
    }
  });

  // Reset financial data route
  app.delete("/api/reset-financial-data", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      // Delete the user's financial profile from the database
      await storage.deleteFinancialProfile(req.user!.id);

      // Also delete chat messages
      await storage.deleteChatMessages(req.user!.id);

      res.json({ message: "Financial data reset successfully" });
    } catch (error) {
      console.error("Error resetting financial data:", error);
      next(error);
    }
  });

  // Financial Education Tips API endpoint
  app.get("/api/education-tips", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const { category, userLevel } = educationTipsSchema.parse({
        category: req.query.category,
        userLevel: req.query.userLevel
      });

      const tips = await generateFinancialEducationTips(category, userLevel);
      res.json({ tips });
    } catch (error) {
      console.error("Education tips API error:", error);
      next(error);
    }
  });

  // Excel export route
  app.get("/api/export-excel", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const profile = await storage.getFinancialProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ error: "No financial profile found" });
      }

      const XLSX = await import('xlsx');

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Personal Information Sheet
      const personalData = [
        ['Personal Information', ''],
        ['First Name', profile.firstName || ''],
        ['Last Name', profile.lastName || ''],
        ['Date of Birth', profile.dateOfBirth || ''],
        ['Marital Status', profile.maritalStatus || ''],
        ['Number of Dependents', profile.dependents || 0],
        ['Spouse Name', profile.spouseName || ''],
        ['Spouse Date of Birth', profile.spouseDateOfBirth || ''],
        ['', ''],
        ['Employment & Income', ''],
        ['Employment Status', profile.employmentStatus || ''],
        ['Annual Income', profile.annualIncome || 0],
        ['Other Income', profile.otherIncome || 0],
        ['Spouse Employment Status', profile.spouseEmploymentStatus || ''],
        ['Spouse Annual Income', profile.spouseAnnualIncome || 0],
        ['Savings Rate (%)', profile.savingsRate || 0],
      ];
      const personalSheet = XLSX.utils.aoa_to_sheet(personalData);
      XLSX.utils.book_append_sheet(workbook, personalSheet, 'Personal Info');

      // Assets Sheet
      if (profile.assets && profile.assets.length > 0) {
        const assetsData = [
          ['Asset Type', 'Description', 'Value', 'Owner']
        ];
        profile.assets.forEach(asset => {
          assetsData.push([
            asset.type || '',
            asset.description || '',
            asset.value || 0,
            asset.owner || ''
          ]);
        });
        const assetsSheet = XLSX.utils.aoa_to_sheet(assetsData);
        XLSX.utils.book_append_sheet(workbook, assetsSheet, 'Assets');
      }

      // Liabilities Sheet
      if (profile.liabilities && profile.liabilities.length > 0) {
        const liabilitiesData = [
          ['Debt Type', 'Description', 'Balance', 'Monthly Payment', 'Owner']
        ];
        profile.liabilities.forEach(liability => {
          liabilitiesData.push([
            liability.type || '',
            liability.description || '',
            liability.balance || 0,
            liability.monthlyPayment || 0,
            liability.owner || ''
          ]);
        });
        const liabilitiesSheet = XLSX.utils.aoa_to_sheet(liabilitiesData);
        XLSX.utils.book_append_sheet(workbook, liabilitiesSheet, 'Liabilities');
      }

      // Real Estate Sheet
      const realEstateData = [
        ['Primary Residence', ''],
        ['Market Value', profile.primaryResidence?.marketValue || 0],
        ['Mortgage Balance', profile.primaryResidence?.mortgageBalance || 0],
        ['Monthly Payment', profile.primaryResidence?.monthlyPayment || 0],
        ['Interest Rate (%)', profile.primaryResidence?.interestRate || 0],
      ];
      if (profile.additionalProperties && profile.additionalProperties.length > 0) {
        realEstateData.push(['', '']);
        realEstateData.push(['Additional Properties', '']);
        realEstateData.push(['Type', 'Market Value', 'Mortgage Balance', 'Monthly Payment', 'Rental Income']);
        profile.additionalProperties.forEach(property => {
          realEstateData.push([
            property.type || '',
            property.marketValue || 0,
            property.mortgageBalance || 0,
            property.monthlyPayment || 0,
            property.rentalIncome || 0
          ]);
        });
      }
      const realEstateSheet = XLSX.utils.aoa_to_sheet(realEstateData);
      XLSX.utils.book_append_sheet(workbook, realEstateSheet, 'Real Estate');

      // Monthly Expenses Sheet
      const monthlyTaxes = (profile.monthlyExpenses?.expectedAnnualTaxes || 0) / 12;
      const expensesData = [
        ['Expense Category', 'Amount'],
        ['Housing', profile.monthlyExpenses?.housing || 0],
        ['Transportation', profile.monthlyExpenses?.transportation || 0],
        ['Food', profile.monthlyExpenses?.food || 0],
        ['Utilities', profile.monthlyExpenses?.utilities || 0],
        ['Healthcare', profile.monthlyExpenses?.healthcare || 0],
        ['Credit Card Payments', profile.monthlyExpenses?.creditCardPayments || 0],
        ['Student Loan Payments', profile.monthlyExpenses?.studentLoanPayments || 0],
        ['Other Debt Payments', profile.monthlyExpenses?.otherDebtPayments || 0],
        ['Clothing & Personal Care', profile.monthlyExpenses?.clothing || 0],
        ['Expected Annual Taxes', profile.monthlyExpenses?.expectedAnnualTaxes || 0],
        ['Monthly Tax Equivalent', monthlyTaxes],
        ['Entertainment', profile.monthlyExpenses?.entertainment || 0],
        ['Other', profile.monthlyExpenses?.other || 0],
      ];
      const expensesSheet = XLSX.utils.aoa_to_sheet(expensesData);
      XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Monthly Expenses');

      // Insurance Sheet
      const insuranceData = [
        ['Insurance Type', 'Has Policy', 'Coverage Amount', 'Monthly Premium', 'Deductible'],
        ['Life Insurance', 
         profile.lifeInsurance?.hasPolicy || false,
         profile.lifeInsurance?.coverageAmount || 0,
         profile.lifeInsurance?.monthlyPremium || 0,
         ''],
        ['Health Insurance',
         profile.healthInsurance?.hasPolicy || false,
         '',
         profile.healthInsurance?.monthlyPremium || 0,
         profile.healthInsurance?.deductible || 0],
        ['Disability Insurance',
         profile.disabilityInsurance?.hasPolicy || false,
         profile.disabilityInsurance?.coverageAmount || 0,
         profile.disabilityInsurance?.monthlyPremium || 0,
         ''],
      ];
      const insuranceSheet = XLSX.utils.aoa_to_sheet(insuranceData);
      XLSX.utils.book_append_sheet(workbook, insuranceSheet, 'Insurance');

      // Goals Sheet
      if (profile.goals && profile.goals.length > 0) {
        const goalsData = [
          ['Goal Name', 'Target Amount', 'Target Date', 'Priority', 'Notes']
        ];
        profile.goals.forEach(goal => {
          goalsData.push([
            goal.name || '',
            goal.targetAmount || 0,
            goal.targetDate || '',
            goal.priority || '',
            goal.notes || ''
          ]);
        });
        const goalsSheet = XLSX.utils.aoa_to_sheet(goalsData);
        XLSX.utils.book_append_sheet(workbook, goalsSheet, 'Goals');
      }

      // Financial Calculations Summary
      if (profile.calculations) {
        const calc = profile.calculations;
        const summaryData = [
          ['Financial Summary', ''],
          ['Net Worth', calc.netWorth || 0],
          ['Monthly Cash Flow', calc.monthlyCashFlow || 0],
          ['Financial Health Score', calc.healthScore || 0],
          ['Emergency Score', calc.emergencyScore || 0],
          ['Emergency Months', calc.emergencyMonths || 0],
          ['Retirement Score', calc.retirementScore || 0],
          ['Risk Management Score', calc.riskManagementScore || 0],
          ['', ''],
          ['Health Score Breakdown', ''],
          ['Net Worth Score', calc.breakdown?.netWorthScore || 0],
          ['Emergency Fund Score', calc.breakdown?.emergencyFundScore || 0],
          ['Debt-to-Income Score', calc.breakdown?.dtiScore || 0],
          ['Savings Rate Score', calc.breakdown?.savingsRateScore || 0],
          ['Insurance Score', calc.breakdown?.insuranceScore || 0],
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Financial Summary');
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for file download
      const fileName = `Affluvia_Financial_Data_${profile.firstName}_${profile.lastName}_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      res.send(excelBuffer);
    } catch (error) {
      console.error('Excel export error:', error);
      next(error);
    }
  });

  // Test Gemini API endpoint
  app.get("/api/test-gemini", async (req, res, next) => {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          success: false, 
          error: "Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables." 
        });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
      });

      const testPrompt = "Say 'Hello from Gemini 2.5 Flash Lite!' and confirm you are working correctly.";

      const result = await model.generateContent(testPrompt);
      const response = await result.response;
      const text = response.text();

      res.json({ 
        success: true, 
        message: "Gemini API is working correctly!",
        model: "gemini-2.5-flash-lite",
        response: text
      });
    } catch (error) {
      console.error("Gemini API test error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to connect to Gemini API"
      });
    }
  });

  // Test endpoint with mock financial data
  app.post("/api/test-gemini-with-mock", async (req, res, next) => {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          success: false, 
          error: "Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables." 
        });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
      });

      // Mock financial profile data
      const mockProfile = {
        annualIncome: 75000,
        monthlyExpenses: {
          housing: 1800,
          food: 600,
          transportation: 400,
          utilities: 200,
          entertainment: 300,
          other: 300
        },
        assets: [
          { type: "Checking Account", value: 5000 },
          { type: "Savings Account", value: 15000 },
          { type: "401k", value: 45000 },
          { type: "Emergency Fund", value: 8000 }
        ],
        liabilities: [
          { type: "Credit Card", balance: 3500 },
          { type: "Student Loan", balance: 25000 }
        ],
        primaryResidence: {
          marketValue: 250000,
          mortgageBalance: 180000
        }
      };

      // Calculate mock metrics
      const calculations = calculateFinancialMetrics(mockProfile);

      const contextPrompt = `You are AFFLUVIA AI, a CFP certified professional financial planner. Analyze the user's financial data and provide personalized advice.

The user's current financial situation:
- Net Worth: $${calculations.netWorth.toLocaleString()}
- Monthly Cash Flow: $${calculations.monthlyCashFlow.toLocaleString()}
- Financial Health Score: ${calculations.healthScore}/100
- Annual Income: $${mockProfile.annualIncome.toLocaleString()}
- Total Assets: $${calculations.totalAssets.toLocaleString()}
- Total Liabilities: $${calculations.totalLiabilities.toLocaleString()}

User question: "${req.body.message || 'What is my overall financial health and what should I focus on improving?'}"

Please provide a helpful, professional response about their financial situation. Keep it concise but informative. Reference their specific data when relevant.`;

      const result = await model.generateContent(contextPrompt);
      const response = await result.response;
      const text = response.text();

      res.json({ 
        success: true, 
        message: "Gemini API working with mock data!",
        model: "gemini-2.5-flash-lite",
        mockData: {
          profile: mockProfile,
          calculations: calculations
        },
        aiResponse: text
      });
    } catch (error) {
      console.error("Gemini API test with mock data error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to connect to Gemini API with mock data"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Emergency Readiness Score (ERS) - CFP Board aligned calculation
function calculateERS(inputs: {
  EF_bal: number;
  M_exp: number;
  Job_var: string;
  HH_type: string;
  N_dep: number;
  Ins_health: boolean;
  Ins_disab: boolean;
  Ins_home: boolean;
  Avail_credit: number;
  Util_rate: number;
  Plan_doc: boolean;
}) {
  const { EF_bal, M_exp, Job_var, HH_type, N_dep, Ins_health, Ins_disab, Ins_home, Avail_credit, Util_rate, Plan_doc } = inputs;

  // Step 1: Determine Target-Month Buffer (TMB)
  let TMB = 3; // Base for dual income & stable job
  if (HH_type === 'single') TMB += 1;
  if (Job_var === 'variable') TMB += 1;
  if (N_dep >= 3) TMB += 1;
  TMB = Math.min(TMB, 12); // Cap at 12

  // Step 2: Compute Emergency-Fund Adequacy Ratio (EFAR)
  const monthsOfExpenses = M_exp > 0 ? EF_bal / M_exp : 0;
  const EFAR = Math.min(monthsOfExpenses / TMB, 1.0);

  // Step 3: Convert EFAR to 0-70 sub-score
  let score = Math.round(EFAR * 70);

  // Step 4: Add complementary risk-buffers (30 pts total)

  // Insurance adequacy (max 15 points)
  let insurancePoints = 0;
  if (Ins_health) insurancePoints += 5;
  if (Ins_disab) insurancePoints += 5;
  if (Ins_home) insurancePoints += 5;

  // Credit access (max 10 points)
  let creditPoints = 0;
  if (Avail_credit >= M_exp && Util_rate < 0.30) {
    creditPoints = 10;
  }

  // Documented emergency plan (max 5 points)
  let planPoints = Plan_doc ? 5 : 0;

  // Step 5: Total score
  const totalScore = score + insurancePoints + creditPoints + planPoints;

  return Math.min(100, Math.max(0, totalScore));
}

// Helper function to calculate available credit
function calculateAvailableCredit(liabilities: any[]): number {
  return liabilities
    .filter(liability => liability.type && liability.type.toLowerCase().includes('credit'))
    .reduce((total, creditCard) => {
      const creditLimit = creditCard.creditLimit || (creditCard.balance * 3); // Estimate if not provided
      const availableCredit = creditLimit - (creditCard.balance || 0);
      return total + Math.max(0, availableCredit);
    }, 0);
}

// Helper function to calculate credit utilization rate
function calculateCreditUtilization(liabilities: any[]): number {
  const creditCards = liabilities.filter(liability => 
    liability.type && liability.type.toLowerCase().includes('credit')
  );

  if (creditCards.length === 0) return 0;

  const totalBalance = creditCards.reduce((sum, card) => sum + (card.balance || 0), 0);
  const totalLimit = creditCards.reduce((sum, card) => {
    const limit = card.creditLimit || (card.balance * 3); // Estimate if not provided
    return sum + limit;
  }, 0);

  return totalLimit > 0 ? totalBalance / totalLimit : 0;
}

// Calculate Enhanced Emergency Readiness Score based on essential expenses
function calculateEnhancedEmergencyScore(profileData: any) {
  const monthlyExpenses = profileData.monthlyExpenses || {};
  const emergencyFundSize = Number(profileData.emergencyFundSize) || 0;

  // Calculate essential expenses (excluding entertainment)
  // Calculate monthly taxes from expected annual taxes
  const monthlyTaxes = (Number(monthlyExpenses.expectedAnnualTaxes) || 0) / 12;

  const essentialExpenses = 
    (Number(monthlyExpenses.housing) || 0) +
    (Number(monthlyExpenses.transportation) || 0) +
    (Number(monthlyExpenses.food) || 0) +
    (Number(monthlyExpenses.utilities) || 0) +
    (Number(monthlyExpenses.healthcare) || 0) +
    (Number(monthlyExpenses.creditCardPayments) || 0) +
    (Number(monthlyExpenses.studentLoanPayments) || 0) +
    (Number(monthlyExpenses.otherDebtPayments) || 0) +
    (Number(monthlyExpenses.clothing) || 0) +
    monthlyTaxes +
    (Number(monthlyExpenses.other) || 0);

  if (essentialExpenses === 0) return 0;

  // Calculate months of essential expenses covered
  const monthsCovered = emergencyFundSize / essentialExpenses;

  // Create scale from 0 to 100 based on adequacy
  // 6 months = 100, 3 months = 50, 0 months = 0
  let score = Math.min(100, (monthsCovered / 6) * 100);

  // Apply additional factors for a more comprehensive score
  if (monthsCovered >= 6) {
    score = 100; // Excellent
  } else if (monthsCovered >= 3) {
    score = 50 + ((monthsCovered - 3) / 3) * 50; // Good to Excellent
  } else if (monthsCovered >= 1) {
    score = 25 + ((monthsCovered - 1) / 2) * 25; // Fair to Good
  } else {
    score = Math.max(0, monthsCovered * 25); // Poor to Fair
  }

  return Math.round(score);
}

// Financial calculations
// 2024 Tax Brackets (Single filer)
function calculate2024TaxOwed(taxableIncome: number): number {
  const brackets = [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 }
  ];

  let totalTax = 0;
  let remainingIncome = taxableIncome;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const taxableAtThisBracket = Math.min(remainingIncome, bracket.max - bracket.min);
    totalTax += taxableAtThisBracket * bracket.rate;
    remainingIncome -= taxableAtThisBracket;
  }

  return totalTax;
}

function calculateAfterTaxIncome(profileData: any): { userAfterTax: number, spouseAfterTax: number } {
  let userAfterTax = 0;
  let spouseAfterTax = 0;

  try {
    // Calculate user's after-tax income
    const userGrossIncome = Number(profileData.annualIncome) || 0;
    const userTakeHome = Number(profileData.takeHomeIncome) || 0;

    if (profileData.taxWithholdingStatus === 'employer' && userTakeHome > 0) {
      // Validate that take-home income is reasonable (at least 40% of gross, max 90%)
      const minTakeHome = userGrossIncome * 0.4;
      const maxTakeHome = userGrossIncome * 0.9;
      if (userTakeHome >= minTakeHome && userTakeHome <= maxTakeHome) {
        userAfterTax = userTakeHome;
      } else {
        console.warn('User take-home income seems unrealistic, falling back to tax calculation');
        const estimatedTax = calculate2024TaxOwed(userGrossIncome);
        userAfterTax = Math.max(0, userGrossIncome - estimatedTax);
      }
    } else if (profileData.taxWithholdingStatus === 'none') {
      userAfterTax = userGrossIncome;
    } else {
      // Self-employed or no withholding - calculate using 2024 tax brackets
      const estimatedTax = calculate2024TaxOwed(userGrossIncome);
      userAfterTax = Math.max(0, userGrossIncome - estimatedTax);
    }

    // Calculate spouse's after-tax income if married
    if (profileData.maritalStatus === 'married') {
      const spouseGrossIncome = Number(profileData.spouseAnnualIncome) || 0;
      const spouseTakeHome = Number(profileData.spouseTakeHomeIncome) || 0;

      if (profileData.spouseTaxWithholdingStatus === 'employer' && spouseTakeHome > 0) {
        // Validate that take-home income is reasonable (at least 40% of gross, max 90%)
        const minTakeHome = spouseGrossIncome * 0.4;
        const maxTakeHome = spouseGrossIncome * 0.9;
        if (spouseTakeHome >= minTakeHome && spouseTakeHome <= maxTakeHome) {
          spouseAfterTax = spouseTakeHome;
        } else {
          console.warn('Spouse take-home income seems unrealistic, falling back to tax calculation');
          const spouseEstimatedTax = calculate2024TaxOwed(spouseGrossIncome);
          spouseAfterTax = Math.max(0, spouseGrossIncome - spouseEstimatedTax);
        }
      } else if (profileData.spouseTaxWithholdingStatus === 'none') {
        spouseAfterTax = spouseGrossIncome;
      } else {
        // Self-employed or no withholding - calculate using 2024 tax brackets
        const spouseEstimatedTax = calculate2024TaxOwed(spouseGrossIncome);
        spouseAfterTax = Math.max(0, spouseGrossIncome - spouseEstimatedTax);
      }
    }

    console.log('After-tax income calculation:', {
      userGross: userGrossIncome,
      userTakeHome: userTakeHome,
      userAfterTax,
      spouseGross: profileData.spouseAnnualIncome,
      spouseTakeHome: profileData.spouseTakeHomeIncome,
      spouseAfterTax
    });

  } catch (error) {
    console.error('Error calculating after-tax income:', error);
    // Return safe defaults using tax calculation
    const userEstimatedTax = calculate2024TaxOwed(Number(profileData.annualIncome) || 0);
    userAfterTax = Math.max(0, (Number(profileData.annualIncome) || 0) - userEstimatedTax);

    const spouseEstimatedTax = calculate2024TaxOwed(Number(profileData.spouseAnnualIncome) || 0);
    spouseAfterTax = Math.max(0, (Number(profileData.spouseAnnualIncome) || 0) - spouseEstimatedTax);
  }

  return { 
    userAfterTax: Math.max(0, userAfterTax), 
    spouseAfterTax: Math.max(0, spouseAfterTax) 
  };
}

function calculateFinancialMetrics(profileData: any) {
  try {
    console.log('Starting financial metrics calculation with data:', {
      hasAssets: !!profileData.assets,
      hasLiabilities: !!profileData.liabilities,
      hasExpenses: !!profileData.monthlyExpenses,
      hasRiskQuestions: !!profileData.riskQuestions,
      income: profileData.annualIncome
    });

    const assets = Array.isArray(profileData.assets) ? profileData.assets : [];
    const liabilities = Array.isArray(profileData.liabilities) ? profileData.liabilities : [];
    const monthlyExpenses = profileData.monthlyExpenses || {};
    const primaryResidence = profileData.primaryResidence || {};

  const totalAssets = assets.reduce(
    (sum: number, asset: any) => sum + (asset.value || 0),
    0,
  );
  const totalLiabilities = liabilities.reduce(
    (sum: number, liability: any) => sum + (liability.balance || 0),
    0,
  );
  const homeEquity = primaryResidence
    ? (primaryResidence.marketValue || 0) - (primaryResidence.mortgageBalance || 0)
    : 0;

  const netWorth = totalAssets + homeEquity - totalLiabilities;

  // Calculate after-tax income for accurate monthly cash flow
  const { userAfterTax, spouseAfterTax } = calculateAfterTaxIncome(profileData);
  const annualAfterTaxIncome = userAfterTax + spouseAfterTax;
  const monthlyIncome = annualAfterTaxIncome / 12;
  // Calculate only living expenses from the expenses screen (exclude debt payments to avoid double counting)
  const totalExpenses = 
    (Number(monthlyExpenses.housing) || 0) +
    (Number(monthlyExpenses.transportation) || 0) +
    (Number(monthlyExpenses.food) || 0) +
    (Number(monthlyExpenses.utilities) || 0) +
    (Number(monthlyExpenses.healthcare) || 0) +
    (Number(monthlyExpenses.clothing) || 0) +
    (Number(monthlyExpenses.entertainment) || 0) +
    (Number(monthlyExpenses.other) || 0);
    // Note: Excluding creditCardPayments, studentLoanPayments, otherDebtPayments 
    // as these are calculated separately in monthlyDebtPayments to avoid double counting

  // Calculate monthly debt payments separately (these are actual debt obligations)
  const monthlyDebtPayments = liabilities.reduce(
    (sum: number, liability: any) => sum + (Number(liability.monthlyPayment) || 0),
    0,
  ) + (Number(primaryResidence.monthlyPayment) || 0);

  // Monthly cash flow = Income - Living Expenses - Debt Payments
  const monthlyCashFlow = monthlyIncome - totalExpenses - monthlyDebtPayments;

  // Calculate DTI ratio
  const dtiRatio = monthlyIncome > 0 ? (monthlyDebtPayments / monthlyIncome) * 100 : 0;

  // Calculate savings rate based on after-tax income
  const annualSavings = Math.max(0, annualAfterTaxIncome - (totalExpenses * 12) - (monthlyDebtPayments * 12));
  const savingsRate = annualAfterTaxIncome > 0 ? (annualSavings / annualAfterTaxIncome) * 100 : 0;

  // Calculate emergency fund using the dedicated emergencyFundSize field
  const emergencyFund = Number(profileData.emergencyFundSize) || 0;

  const emergencyMonths = totalExpenses > 0 ? emergencyFund / totalExpenses : 0;

  // Calculate risk profile from questionnaire - with better error handling
  let riskQuestions = [];

  // Try to get risk questions from either field
  if (Array.isArray(profileData.riskQuestions)) {
    riskQuestions = profileData.riskQuestions;
  } else if (Array.isArray(profileData.riskQuestionnaire)) {
    riskQuestions = profileData.riskQuestionnaire;
  } else {
    // Initialize with default values if no risk questions found
    riskQuestions = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  }

  // Ensure all values are valid numbers between 1 and 5
  riskQuestions = riskQuestions.map(score => {
    const numScore = Number(score);
    return (numScore >= 1 && numScore <= 5) ? numScore : 1;
  });

  // Ensure we have at least 5 questions for meaningful calculation
  while (riskQuestions.length < 10) {
    riskQuestions.push(1);
  }

  const riskScore = riskQuestions.reduce((sum: number, score: number) => sum + score, 0);
  
  // Calculate spouse risk profile if married and has spouse risk questions
  let spouseRiskScore = 0;
  let spouseRiskProfile = 'Not Assessed';
  let spouseTargetAllocation = null;
  
  console.log('=== SPOUSE RISK PROFILE DEBUG ===');
  console.log('Marital Status:', profileData.maritalStatus);
  console.log('Spouse Risk Questions Field:', profileData.spouseRiskQuestions);
  console.log('Is spouseRiskQuestions array?', Array.isArray(profileData.spouseRiskQuestions));
  console.log('=== END SPOUSE DEBUG ===');
  
  if (profileData.maritalStatus === 'married' && Array.isArray(profileData.spouseRiskQuestions) && profileData.spouseRiskQuestions.length > 0) {
    console.log('=== SPOUSE DATA VALIDATION ===');
    console.log('Has spouseRiskQuestions:', Array.isArray(profileData.spouseRiskQuestions));
    console.log('Has spouseAllocation:', !!profileData.spouseAllocation);
    console.log('Spouse Risk Questions:', profileData.spouseRiskQuestions);
    console.log('Spouse Allocation:', profileData.spouseAllocation);
    console.log('=== END SPOUSE DATA VALIDATION ===');
    
    let spouseRiskQuestions = profileData.spouseRiskQuestions.map((score: any) => {
      const numScore = Number(score);
      return (numScore >= 1 && numScore <= 5) ? numScore : 1;
    });
    
    // Ensure we have at least 10 questions for meaningful calculation
    while (spouseRiskQuestions.length < 10) {
      spouseRiskQuestions.push(1);
    }
    
    spouseRiskScore = spouseRiskQuestions.reduce((sum: number, score: number) => sum + score, 0);
    
    console.log('=== SPOUSE RISK PROFILE CALCULATION ===');
    console.log('Spouse Risk Questions:', spouseRiskQuestions);
    console.log('Spouse Risk Score:', spouseRiskScore);
    
    // Determine spouse risk profile based on CFP Board methodology
    if (spouseRiskScore >= 10 && spouseRiskScore <= 19) {
      spouseRiskProfile = 'Conservative';
      spouseTargetAllocation = { usStocks: 20, intlStocks: 10, bonds: 60, alternatives: 5, cash: 5 };
    } else if (spouseRiskScore >= 20 && spouseRiskScore <= 27) {
      spouseRiskProfile = 'Moderately Conservative';
      spouseTargetAllocation = { usStocks: 30, intlStocks: 15, bonds: 45, alternatives: 5, cash: 5 };
    } else if (spouseRiskScore >= 28 && spouseRiskScore <= 35) {
      spouseRiskProfile = 'Moderate';
      spouseTargetAllocation = { usStocks: 40, intlStocks: 20, bonds: 30, alternatives: 7, cash: 3 };
    } else if (spouseRiskScore >= 36 && spouseRiskScore <= 43) {
      spouseRiskProfile = 'Moderately Aggressive';
      spouseTargetAllocation = { usStocks: 50, intlStocks: 25, bonds: 15, alternatives: 8, cash: 2 };
    } else if (spouseRiskScore >= 44 && spouseRiskScore <= 50) {
      spouseRiskProfile = 'Aggressive';
      spouseTargetAllocation = { usStocks: 56, intlStocks: 31, bonds: 2, alternatives: 10, cash: 1 };
    }
    
    console.log('Determined Spouse Risk Profile:', spouseRiskProfile);
    console.log('Spouse Target Allocation:', spouseTargetAllocation);
    console.log('=== END SPOUSE RISK PROFILE RESULT ===');
  }

  console.log('=== RISK PROFILE CALCULATION DEBUG ===');
  console.log('Raw profile data keys:', Object.keys(profileData));
  console.log('Risk Questions field:', profileData.riskQuestions);
  console.log('Risk Questionnaire field:', profileData.riskQuestionnaire);
  console.log('Extracted riskQuestions array:', riskQuestions);
  console.log('Calculated riskScore:', riskScore);
  console.log('Questions length:', riskQuestions.length);
  console.log('Individual question scores:', riskQuestions.map((q, i) => `Q${i+1}: ${q}`).join(', '));
  console.log('=== END RISK DEBUG ===');

  // CFP Board Risk Profile Scoring (10 questions, each 1-5 points, total 10-50)
  let riskProfile = 'Not Assessed';
  let targetAllocation = { usStocks: 39, intlStocks: 21, bonds: 34, alternatives: 5, cash: 1 };
  let validRiskScore = 0;

  // Calculate risk profile using CFP Board framework
  if (riskQuestions.length >= 5 && riskScore >= 5) {
    // Scale score to 50 if less than 10 questions answered
    const scaledScore = riskQuestions.length === 10 
      ? riskScore 
      : Math.round((riskScore / riskQuestions.length) * 10);

    validRiskScore = Math.max(10, Math.min(50, scaledScore));

    // CFP Board aligned scoring ranges and TIAA Asset Allocation Guide percentages
    if (validRiskScore >= 10 && validRiskScore <= 19) {
      riskProfile = 'Conservative';
      targetAllocation = { usStocks: 20, intlStocks: 10, bonds: 64, alternatives: 5, cash: 1 };
    } else if (validRiskScore >= 20 && validRiskScore <= 27) {
      riskProfile = 'Moderately Conservative';
      targetAllocation = { usStocks: 30, intlStocks: 15, bonds: 49, alternatives: 5, cash: 1 };
    } else if (validRiskScore >= 28 && validRiskScore <= 35) {
      riskProfile = 'Moderate';
      targetAllocation = { usStocks: 39, intlStocks: 21, bonds: 34, alternatives: 5, cash: 1 };
    } else if (validRiskScore >= 36 && validRiskScore <= 43) {
      riskProfile = 'Moderately Aggressive';
      targetAllocation = { usStocks: 48, intlStocks: 25, bonds: 19, alternatives: 7, cash: 1 };
    } else if (validRiskScore >= 44 && validRiskScore <= 50) {
      riskProfile = 'Aggressive';
      targetAllocation = { usStocks: 56, intlStocks: 31, bonds: 2, alternatives: 10, cash: 1 };
    }
  }

  console.log('=== FINAL RISK PROFILE RESULT ===');
  console.log('Raw Risk Score:', riskScore);
  console.log('Scaled/Valid Risk Score:', validRiskScore);
  console.log('Determined Risk Profile:', riskProfile);
  console.log('Target Allocation:', targetAllocation);
  console.log('CFP Board Score Range Analysis:');
  console.log('  - 10-19: Conservative');
  console.log('  - 20-27: Moderately Conservative');
  console.log('  - 28-35: Moderate');
  console.log('  - 36-43: Moderately Aggressive');
  console.log('  - 44-50: Aggressive');
  console.log('=== END RISK PROFILE RESULT ===');

  // COMPREHENSIVE FINANCIAL HEALTH SCORE CALCULATION
  // Based on AFFLUVIA specification with 5 weighted components

  // 1. Net Worth vs Income Score (25% weight)
  const grossAnnualIncome = Number(profileData.annualIncome || 0) + Number(profileData.spouseAnnualIncome || 0);
  const netWorthRatio = grossAnnualIncome > 0 ? netWorth / grossAnnualIncome : 0;
  let netWorthScore = 0;
  if (netWorthRatio >= 5) {
    netWorthScore = 100;
  } else if (netWorthRatio >= 0) {
    netWorthScore = 30 + (netWorthRatio / 5) * 70;
  } else if (netWorthRatio >= -0.5) {
    netWorthScore = Math.max(0, 30 + (netWorthRatio + 0.5) / 0.5 * 30);
  } else {
    netWorthScore = 0;
  }

  // 2. Emergency Fund Score (20% weight)
  let emergencyScore = Math.min(100, (emergencyMonths / 6) * 100);

  // Apply reductions for risk factors
  if (dtiRatio > 50) emergencyScore = Math.max(0, emergencyScore - 20);
  else if (dtiRatio > 40) emergencyScore = Math.max(0, emergencyScore - 10);

  const hasHealthInsurance = profileData.healthInsurance?.hasPolicy === true;
  if (!hasHealthInsurance) emergencyScore = Math.max(0, emergencyScore - 20);

  const hasDisabilityInsurance = profileData.disabilityInsurance?.hasPolicy === true;
  if (!hasDisabilityInsurance && profileData.employmentStatus !== 'retired') {
    emergencyScore = Math.max(0, emergencyScore - 10);
  }

  // 3. Debt-to-Income Score (20% weight)
  let dtiScore = 0;
  if (dtiRatio <= 20) {
    dtiScore = 100;
  } else if (dtiRatio <= 35) {
    dtiScore = 100 - (dtiRatio - 20) * (20 / 15);
  } else if (dtiRatio < 50) {
    dtiScore = 80 - (dtiRatio - 35) * (80 / 15);
  } else {
    dtiScore = 0;
  }

  // 4. Savings Rate Score (20% weight)
  let savingsRateScore = 0;
  if (savingsRate >= 20) {
    savingsRateScore = 100;
  } else if (savingsRate >= 15) {
    savingsRateScore = 80 + (Math.min(savingsRate, 25) - 15) * 2;
  } else if (savingsRate >= 0) {
    savingsRateScore = (savingsRate / 15) * 80;
  } else {
    savingsRateScore = 0;
  }

  // 5. Insurance Coverage Score (15% weight)
  let insuranceScore = 100;

  const age = profileData.dateOfBirth 
    ? new Date().getFullYear() - new Date(profileData.dateOfBirth).getFullYear()
    : 35;
  const hasDependents = (profileData.dependents || 0) > 0 || profileData.maritalStatus === 'married';

  console.log('=== INSURANCE SCORE CALCULATION DEBUG ===');
  console.log('Life Insurance Data:', profileData.lifeInsurance);
  console.log('Spouse Life Insurance Data:', profileData.spouseLifeInsurance);
  console.log('Health Insurance Data:', profileData.healthInsurance);
  console.log('Disability Insurance Data:', profileData.disabilityInsurance);
  console.log('Spouse Disability Insurance Data:', profileData.spouseDisabilityInsurance);
  console.log('Has Dependents:', hasDependents);
  console.log('Age:', age);
  console.log('Employment Status:', profileData.employmentStatus);
  console.log('Spouse Employment Status:', profileData.spouseEmploymentStatus);
  console.log('Marital Status:', profileData.maritalStatus);

  // Life Insurance Assessment (Household)
  const hasUserLifePolicy = profileData.lifeInsurance?.hasPolicy === true;
  const hasSpouseLifePolicy = profileData.spouseLifeInsurance?.hasPolicy === true;
  const userLifeCoverage = hasUserLifePolicy ? (profileData.lifeInsurance?.coverageAmount || 0) : 0;
  const spouseLifeCoverage = hasSpouseLifePolicy ? (profileData.spouseLifeInsurance?.coverageAmount || 0) : 0;
  const totalLifeCoverage = userLifeCoverage + spouseLifeCoverage;

  // Calculate recommended coverage based on household income
  const spouseIncome = Number(profileData.spouseAnnualIncome) || 0;
  const totalHouseholdIncome = grossAnnualIncome + spouseIncome;
  const recommendedLifeCoverage = totalHouseholdIncome * 10; // 10x household income rule

  console.log('User Life Insurance Coverage:', userLifeCoverage);
  console.log('Spouse Life Insurance Coverage:', spouseLifeCoverage);
  console.log('Total Life Insurance Coverage:', totalLifeCoverage);
  console.log('Total Household Income:', totalHouseholdIncome);
  console.log('Recommended Life Coverage:', recommendedLifeCoverage);

  if (hasDependents || profileData.maritalStatus === 'married') {
    if (totalLifeCoverage === 0) {
      console.log('Life Insurance: No household coverage - deducting 30 points');
      insuranceScore -= 30;
    } else if (totalLifeCoverage < recommendedLifeCoverage * 0.8) {
      console.log('Life Insurance: Insufficient household coverage - deducting 15 points');
      insuranceScore -= 15;
    } else {
      console.log('Life Insurance: Adequate household coverage - no deduction');
    }
  } else {
    console.log('Life Insurance: Single with no dependents - no deduction needed');
  }

  // Disability Insurance Assessment (Household)
  const hasUserDisabilityPolicy = profileData.disabilityInsurance?.hasPolicy === true;
  const hasSpouseDisabilityPolicy = profileData.spouseDisabilityInsurance?.hasPolicy === true;

  console.log('User Has Disability Insurance:', hasUserDisabilityPolicy);
  console.log('Spouse Has Disability Insurance:', hasSpouseDisabilityPolicy);

  // Check user disability insurance
  const isUserWorking = profileData.employmentStatus === 'full-time' || 
                       profileData.employmentStatus === 'part-time' || 
                       profileData.employmentStatus === 'self-employed';

  if (isUserWorking && age < 60) {
    if (!hasUserDisabilityPolicy) {
      console.log('User Disability Insurance: No coverage for working person - deducting 15 points');
      insuranceScore -= 15;
    } else {
      console.log('User Disability Insurance: Has coverage - no deduction');
    }
  } else {
    console.log('User Disability Insurance: Not working or retired - no deduction needed');
  }

  // Check spouse disability insurance if married and working
  const isSpouseWorking = profileData.spouseEmploymentStatus === 'full-time' || 
                         profileData.spouseEmploymentStatus === 'part-time' || 
                         profileData.spouseEmploymentStatus === 'self-employed';

  if (profileData.maritalStatus === 'married' && isSpouseWorking && age < 60) {
    if (!hasSpouseDisabilityPolicy) {
      console.log('Spouse Disability Insurance: No coverage for working spouse - deducting 10 points');
      insuranceScore -= 10;
    } else {
      console.log('Spouse Disability Insurance: Has coverage - no deduction');
    }
  } else if (profileData.maritalStatus === 'married') {
    console.log('Spouse Disability Insurance: Spouse not working or retired - no deduction needed');
  }

  // Health insurance - using correct field structure
  const hasHealthPolicy = profileData.healthInsurance?.hasPolicy === true;
  console.log('Has Health Insurance Policy:', hasHealthPolicy);

  if (!hasHealthPolicy) {
    console.log('Health Insurance: No coverage - deducting 20 points');
    insuranceScore -= 20;
  } else {
    console.log('Health Insurance: Has coverage - no deduction');
  }

  // Property insurance (not collected in intake form currently)
  if (profileData.primaryResidence && profileData.primaryResidence.marketValue > 0) {
    // We don't collect homeowner's insurance in the form, so we'll assume they have it
    // to avoid unfair penalty. In future, we could add this to the form.
    console.log('Property Insurance: Assuming homeowner has property insurance');
  }

  // Long-term care (for older users) - not collected in intake form
  if (age > 55) {
    // We don't collect LTC insurance in the form, so we'll give a minor deduction
    console.log('Long-term Care Insurance: Over 55, minor deduction of 5 points for missing LTC planning');
    insuranceScore -= 5;
  }

  console.log('Final Insurance Score before capping:', insuranceScore);
  console.log('=== END INSURANCE DEBUG ===');

  insuranceScore = Math.max(0, insuranceScore);

  // Calculate composite Financial Health Score
  const healthScore = Math.round(
    0.25 * netWorthScore +
    0.20 * emergencyScore +
    0.20 * dtiScore +
    0.20 * savingsRateScore +
    0.15 * insuranceScore
  );

  // Calculate retirement score
  console.log('=== RETIREMENT SCORE CALCULATION DEBUG ===');
  console.log('All Assets:', profileData.assets);
  console.log('Age:', age);
  console.log('Gross Annual Income:', grossAnnualIncome);

  const retirementAssets = (profileData.assets || []).filter(
    (asset: any) => {
      const isRetirement = asset.type && 
        (asset.type.toLowerCase().includes('401k') || 
         asset.type.toLowerCase().includes('ira') ||
         asset.type.toLowerCase().includes('retirement') ||
         asset.type.toLowerCase().includes('401(k)') ||
         asset.type.toLowerCase().includes('roth') ||
         asset.type.toLowerCase().includes('pension'));

      console.log(`Asset ${asset.description || asset.type}: ${asset.value} - Is Retirement: ${isRetirement}`);
      return isRetirement;
    }
  ).reduce((sum: number, asset: any) => sum + asset.value, 0);

  console.log('Total Retirement Assets:', retirementAssets);

  const yearsToRetirement = Math.max(0, 65 - age);
  console.log('Years to Retirement:', yearsToRetirement);

  // Age-based retirement target calculation
  let recommendedRetirement;
  if (age < 30) {
    // Young people: 1x annual income by 30
    recommendedRetirement = grossAnnualIncome;
  } else if (age < 40) {
    // 30s: 3x annual income by 40
    recommendedRetirement = grossAnnualIncome * 3;
  } else if (age < 50) {
    // 40s: 6x annual income by 50
    recommendedRetirement = grossAnnualIncome * 6;
  } else if (age < 60) {
    // 50s: 8x annual income by 60
    recommendedRetirement = grossAnnualIncome * 8;
  } else {
    // 60+: 10x annual income by retirement
    recommendedRetirement = grossAnnualIncome * 10;
  }

  console.log('Age-Based Recommended Retirement Assets:', recommendedRetirement);

  let retirementScore = 0;
  if (recommendedRetirement > 0) {
    retirementScore = Math.min(100, (retirementAssets / recommendedRetirement) * 100);
  }

  console.log('Retirement Score Calculation:', retirementAssets, '/', recommendedRetirement, '=', retirementScore);
  console.log('=== END RETIREMENT DEBUG ===');

  // Calculate risk management score (based on insurance adequacy)
  let riskManagementScore = insuranceScore; // Reuse insurance score for risk management

  // EMERGENCY READINESS SCORE (ERS) - Enhanced calculation using essential expenses
  const emergencyReadinessScore = calculateEnhancedEmergencyScore(profileData);

  // Generate comprehensive personalized recommendations (3-5 recommendations ranked by priority)
  const recommendations = getFallbackRecommendations({
    healthScore,
    netWorth,
    monthlyCashFlow,
    emergencyScore,
    emergencyMonths,
    retirementScore,
    riskManagementScore,
    riskProfile,
    validRiskScore,
    targetAllocation,
    breakdown: {
      netWorthScore: Math.round(netWorthScore),
      emergencyFundScore: Math.round(emergencyScore),
      dtiScore: Math.round(dtiScore),
      savingsRateScore: Math.round(savingsRateScore),
      insuranceScore: Math.round(insuranceScore)
    },
    dtiRatio,
    savingsRate
  }, profileData);

  const result = {
      netWorth: Number(netWorth) || 0,
      monthlyCashFlow: Number(monthlyCashFlow) || 0,
      healthScore: Math.min(100, Math.max(0, Number(healthScore) || 0)),
      totalAssets: Number(totalAssets) || 0,
      totalLiabilities: Number(totalLiabilities) || 0,
      homeEquity: Number(homeEquity) || 0,
      emergencyScore: Math.round(Number(emergencyScore) || 0),
      emergencyMonths: Math.round((Number(emergencyMonths) || 0) * 10) / 10,
      retirementScore: Math.round(Number(retirementScore) || 0),
      riskManagementScore: Math.round(Number(riskManagementScore) || 0),
      dtiRatio: Math.round((Number(dtiRatio) || 0) * 10) / 10,
      savingsRate: Math.round((Number(savingsRate) || 0) * 10) / 10,
      riskProfile: riskProfile || 'Not Assessed',
      riskScore: Number(validRiskScore) || 0,
      targetAllocation: targetAllocation || { usStocks: 39, intlStocks: 21, bonds: 34, alternatives: 5, cash: 1 },
      // Spouse risk profile data
      spouseRiskProfile: spouseRiskProfile || 'Not Assessed',
      spouseTargetAllocation: spouseTargetAllocation || null,
      emergencyReadinessScoreCFP: Number(emergencyReadinessScore) || 0,
      recommendations: Array.isArray(recommendations) ? recommendations : [],
      // Breakdown scores for display
      breakdown: {
        netWorthScore: Math.round(Number(netWorthScore) || 0),
        emergencyFundScore: Math.round(Number(emergencyScore) || 0),
        dtiScore: Math.round(Number(dtiScore) || 0),
        savingsRateScore: Math.round(Number(savingsRateScore) || 0),
        insuranceScore: Math.round(Number(insuranceScore) || 0)
      }
    };

    console.log('Financial metrics calculation completed successfully:', {
      healthScore: result.healthScore,
      riskProfile: result.riskProfile,
      hasRecommendations: result.recommendations.length > 0
    });

    return result;
  } catch (error) {
    console.error('Error in calculateFinancialMetrics:', error);
    console.error('Error stack:', error.stack);

    // Return safe default values
    return {
      netWorth: 0,
      monthlyCashFlow: 0,
      healthScore: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      homeEquity: 0,
      emergencyScore: 0,
      emergencyMonths: 0,
      retirementScore: 0,
      riskManagementScore: 0,
      dtiRatio: 0,
      savingsRate: 0,
      riskProfile: 'Not Assessed',
      riskScore: 0,
      targetAllocation: { usStocks: 39, intlStocks: 21, bonds: 34, alternatives: 5, cash: 1 },
      spouseRiskProfile: 'Not Assessed',
      spouseTargetAllocation: null,
      emergencyReadinessScoreCFP: 0,
      recommendations: [],
      breakdown: {
        netWorthScore: 0,
        emergencyFundScore: 0,
        dtiScore: 0,
        savingsRateScore: 0,
        insuranceScore: 0
      }
    };
  }
}

// Generate AI-powered recommendations based on financial profile
async function generateRecommendations(
  profileData: any,
  calculations: any
): Promise<Array<{ title: string; description: string; priority: number; category: string }>> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Return fallback recommendations if API is not available
      return getFallbackRecommendations(calculations);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    const contextPrompt = `You are AFFLUVIA AI, a CFP certified financial planner. Analyze this user's financial profile and provide exactly 5 personalized recommendations to improve their financial health score (currently ${calculations.healthScore}/100).

User Financial Profile:
- Annual Income: $${profileData.annualIncome || 0}
- Monthly Income: $${((profileData.annualIncome || 0) / 12).toFixed(0)}
- Emergency Fund: ${calculations.emergencyMonths || 0} months of expenses
- Debt-to-Income Ratio: ${calculations.dtiRatio || 0}%
- Savings Rate: ${calculations.savingsRate || 0}%
- Retirement Score: ${calculations.retirementScore || 0}/100
- Insurance Score: ${calculations.riskManagementScore || 0}/100

Score Breakdown:
- Net Worth Score: ${calculations.breakdown.netWorthScore}/100 (25% weight)
- Emergency Fund Score: ${calculations.breakdown.emergencyFundScore}/100 (20% weight)
- Debt-to-Income Score: ${calculations.breakdown.dtiScore}/100 (20% weight)
- Savings Rate Score: ${calculations.breakdown.savingsRateScore}/100 (20% weight)
- Insurance Score: ${calculations.breakdown.insuranceScore}/100 (15% weight)

Provide exactly 5 recommendations in this JSON format:
[
  {
    "title": "Brief actionable title",
    "description": "Detailed explanation with specific numbers/percentages",
    "priority": 1-5,
    "category": "emergency|debt|savings|insurance|investment"
  }
]

Prioritize recommendations by their potential impact on the overall financial health score. Focus on the lowest-scoring components first. Be specific with dollar amounts and percentages where possible.`;

    const result = await model.generateContent(contextPrompt);
    const response = await result.response;
    const text = response.text();

    try {
      // Extract JSON from the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const recommendations = JSON.parse(jsonMatch[0]);
        if (Array.isArray(recommendations) && recommendations.length === 5) {
          return recommendations;
        }
      }
    } catch (parseError) {
      console.error("Error parsing AI recommendations:", parseError);
    }

    // If AI response is malformed, return fallback
    return getFallbackRecommendations(calculations, profileData);
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return getFallbackRecommendations(calculations, profileData);
  }
}

// Fallback recommendations based on lowest scores
function generatePersonalizedRecommendations(profileData: any, metrics: any): Array<{ title: string; description: string; impact: string; category: string; priority: number; potentialImprovement: number; actionSteps: string[] }> {
  const recommendations: Array<{ title: string; description: string; impact: string; category: string; priority: number; potentialImprovement: number; actionSteps: string[] }> = [];

  // Emergency Fund Recommendations (High Priority)
  if (metrics.emergencyMonths < 3) {
    recommendations.push({
      title: "Build Emergency Fund",
      description: `Increase emergency fund to cover 3-6 months of expenses. Currently at ${metrics.emergencyMonths.toFixed(1)} months.`,
      impact: `Improving emergency fund could increase Emergency Fund Score by ${Math.min(100 - metrics.breakdown.emergencyFundScore, 40)} points`,
      category: "Emergency Preparedness",
      priority: 1,
      potentialImprovement: Math.min(100 - metrics.breakdown.emergencyFundScore, 40),
      actionSteps: [
        "Set up automatic transfers to high-yield savings account",
        "Target saving $500-1000 per month until goal is reached",
        "Keep emergency fund in separate, easily accessible account"
      ]
    });
  }

  // Debt Management Recommendations
  if (metrics.dtiRatio > 36) {
    recommendations.push({
      title: "Reduce Debt-to-Income Ratio",
      description: `Your DTI ratio of ${metrics.dtiRatio.toFixed(1)}% exceeds the recommended 36%. Focus on debt reduction.`,
      impact: "Reducing DTI below 36% could improve your overall financial health score",
      category: "Debt Management",
      priority: 2,
      potentialImprovement: Math.min(100 - metrics.breakdown.dtiScore, 30),
      actionSteps: [
        "List all debts by interest rate (highest first)",
        "Consider debt consolidation for high-interest debt",
        "Allocate extra payments to highest interest debt",
        "Avoid taking on new debt"
      ]
    });
  }

  // Investment/Risk Profile Recommendations
  if (metrics.riskProfile && metrics.riskProfile !== 'Not Assessed') {
    const currentAllocation = profileData.currentAllocation;
    const targetAllocation = metrics.targetAllocation;

    if (currentAllocation && targetAllocation) {
      const stocksDiff = Math.abs((currentAllocation.usStocks + currentAllocation.intlStocks) - (targetAllocation.usStocks + targetAllocation.intlStocks));

      if (stocksDiff > 10) {
        recommendations.push({
          title: "Rebalance Investment Portfolio",
          description: `Your current allocation doesn't match your ${metrics.riskProfile} risk profile. Consider rebalancing.`,
          impact: "Proper asset allocation can optimize returns for your risk tolerance",
          category: "Investment Strategy",
          priority: 3,
          potentialImprovement: 15,
          actionSteps: [
            `Target allocation: ${targetAllocation.usStocks}% US stocks, ${targetAllocation.intlStocks}% international stocks`,
            `${targetAllocation.bonds}% bonds, ${targetAllocation.alternatives}% alternatives, ${targetAllocation.cash}% cash`,
            "Rebalance quarterly or when allocations drift >5%",
            "Consider low-cost index funds for diversification"
          ]
        });
      }
    }
  }

  // Retirement Savings Recommendations
  if (metrics.retirementScore < 60) {
    recommendations.push({
      title: "Increase Retirement Savings",
      description: `Your retirement readiness score of ${metrics.retirementScore} suggests you may need to save more for retirement.`,
      impact: "Increasing retirement contributions can significantly improve long-term financial security",
      category: "Retirement Planning",
      priority: 4,
      potentialImprovement: Math.min(100 - metrics.retirementScore, 25),
      actionSteps: [
        "Maximize employer 401(k) match if available",
        "Consider increasing contribution rate by 1-2% annually",
        "Open IRA if not already contributing to retirement accounts",
        "Review investment options within retirement accounts"
      ]
    });
  }

  // Insurance Recommendations
  if (metrics.breakdown.insuranceScore < 70) {
    recommendations.push({
      title: "Review Insurance Coverage",
      description: `Insurance score of ${metrics.breakdown.insuranceScore} indicates potential gaps in coverage.`,
      impact: "Adequate insurance protects against financial catastrophe",
      category: "Risk Management",
      priority: 5,
      potentialImprovement: Math.min(100 - metrics.breakdown.insuranceScore, 20),
      actionSteps: [
        "Review life insurance needs (10-12x annual income)",
        "Ensure disability insurance covers 60-70% of income",
        "Confirm adequate health insurance coverage",
        "Consider umbrella policy if high net worth"
      ]
    });
  }

  // Return top 3-5 recommendations sorted by priority
  return recommendations.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

function getFallbackRecommendations(calculations: any, profileData?: any): Array<{ title: string; description: string; priority: number; category: string }> {
  const scores = [
    { name: 'Emergency Fund', score: calculations.breakdown.emergencyFundScore, category: 'emergency' },
    { name: 'Insurance Coverage', score: calculations.breakdown.insuranceScore, category: 'insurance' },
    { name: 'Debt Management', score: calculations.breakdown.dtiScore, category: 'debt' },
    { name: 'Savings Rate', score: calculations.breakdown.savingsRateScore, category: 'savings' },
    { name: 'Net Worth', score: calculations.breakdown.netWorthScore, category: 'investment' }
  ].sort((a, b) => a.score - b.score);

  // Generate specific insurance gap description
  let insuranceGaps = [];
  if (profileData) {
    if (!profileData.healthInsurance?.hasPolicy) insuranceGaps.push("health insurance");
    if (!profileData.disabilityInsurance?.hasPolicy && profileData.employmentStatus !== 'retired') {
      insuranceGaps.push(" disability insurance");
    }
    if (!profileData.lifeInsurance?.hasPolicy && ((profileData.dependents || 0) > 0 || profileData.maritalStatus === 'married')) {
      insuranceGaps.push(" life insurance");
    }
  }

  const insuranceDescription = insuranceGaps.length > 0 
    ? `Address insurance gaps: missing ${insuranceGaps.join(", ")}. These protect against financial catastrophe.`
    : "Ensure adequate life, disability, and health insurance coverage to protect against financial risks.";

  const recommendations = [
    {
      title: "Build Emergency Fund",
      description: "Aim to save 3-6 months of expenses in a high-yield savings account for financial security.",
      priority: 1,
      category: "emergency"
    },
    {
      title: "Address Insurance Gaps", 
      description: insuranceDescription,
      priority: 2,
      category: "insurance"
    },
    {
      title: "Reduce High-Interest Debt",
      description: "Focus on paying down credit cards and high-interest loans to improve debt-to-income ratio.",
      priority: 3,
      category: "debt"
    },
    {
      title: "Increase Savings Rate",
      description: "Try to save at least 20% of your income through automated transfers and budget optimization.",
      priority: 4,
      category: "savings"
    },
    {
      title: "Diversify Investments",
      description: "Consider a balanced portfolio approach aligned with your risk tolerance to build long-term wealth.",
      priority: 5,
      category: "investment"
    }
  ];

  // Reorder based on actual scores
  return recommendations.slice(0, 5);
}

// Gemini AI integration
async function generateAIResponse(
  message: string,
  userId: number,
): Promise<string> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    // Get user's financial profile for context
    const profile = await storage.getFinancialProfile(userId);

    let contextPrompt = `You are AFFLUVIA AI, a CFP certified professional financial planner. Analyze the user's financial data from the intake form and his financial situation and provide personalized advice based on their data. `;

    if (profile) {
      const calculations = calculateFinancialMetrics(profile);
      contextPrompt += `The user's current financial situation:
- Net Worth: $${calculations.netWorth.toLocaleString()}
- Monthly Cash Flow: $${calculations.monthlyCashFlow.toLocaleString()}
- Financial Health Score: ${calculations.healthScore}/100
- Annual Income: $${(profile.annualIncome || 0).toLocaleString()}
- Total Assets: $${calculations.totalAssets.toLocaleString()}
- Total Liabilities: $${calculations.totalLiabilities.toLocaleString()}

`;
    }

    contextPrompt += `User question: "${message}"

Please provide a helpful, professional response about their financial situation. Keep it concise but informative. Reference their specific data when relevant.`;

    const result = await model.generateContent(contextPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini API error:", error);

    // Fallback responses
    const fallbackResponses = [
      "I'm having trouble accessing the AI service right now. Based on general financial principles, I recommend reviewing your budget and ensuring you have an emergency fund covering 3-6 months of expenses.",
      "The AI service is temporarily unavailable. However, I can suggest focusing on debt reduction and increasing your savings rate as key steps for financial health.",
      "I'm experiencing technical difficulties. In the meantime, consider diversifying your investments and regularly reviewing your financial goals.",
      "The AI service is down. Generally, maintaining a balanced portfolio and consistent saving habits are fundamental to financial success.",
    ];

    return fallbackResponses[
      Math.floor(Math.random() * fallbackResponses.length)
    ];
  }
}

// Generate CFP Board-aligned financial education tips using OpenAI (Responses API with high reasoning)
async function generateFinancialEducationTips(
  category: string = "general",
  userLevel: string = "beginner"
): Promise<Array<{ 
  title: string; 
  description: string; 
  category: string; 
  cfpPrinciple: string;
  actionTips: string[];
  difficulty: string;
}>> {
  try {
    const system = `You are a CFP Board-certified financial planning expert. Generate educational financial tips based on CFP Board standards and best practices. Focus on the six key planning areas: financial planning fundamentals, insurance planning, investment planning, tax planning, retirement planning, and estate planning.

Always provide practical, actionable advice that follows CFP Board's Code of Ethics and Standards of Conduct. Ensure content is appropriate for the specified difficulty level and category.

Respond with JSON in this exact format:
{
  "tips": [
    {
      "title": "Clear, engaging title",
      "description": "2-3 sentence explanation of the concept",
      "category": "The financial planning category",
      "cfpPrinciple": "The underlying CFP Board principle or standard",
      "actionTips": ["Specific action step 1", "Specific action step 2", "Specific action step 3"],
      "difficulty": "beginner/intermediate/advanced"
    }
  ]
}`;

    const user = `Generate 5 financial education tips for the ${category} category at ${userLevel} level. Focus on CFP Board principles and provide actionable advice that follows professional standards.`;

    const result = await respondJsonHighReasoning(openaiClient, { system, user, maxTokens: 1500 });
    return result.tips || [];
  } catch (error) {
    console.error("OpenAI API error for education tips:", error);

    // Return CFP Board-aligned fallback tips
    return getCFPBoardFallbackTips(category, userLevel);
  }
}

// Fallback CFP Board-aligned tips when API is unavailable
function getCFPBoardFallbackTips(category: string, userLevel: string) {
  const fallbackTips = {
    general: [
      {
        title: "Emergency Fund Planning",
        description: "Establish an emergency fund covering 3-6 months of living expenses to protect against unexpected financial hardships.",
        category: "Financial Planning Fundamentals",
        cfpPrinciple: "CFP Board Standard A.1 - Understanding the Client",
        actionTips: [
          "Calculate your monthly essential expenses",
          "Start with a goal of $1,000 in emergency savings",
          "Gradually build to 3-6 months of expenses",
          "Keep emergency funds in a high-yield savings account"
        ],
        difficulty: userLevel
      },
      {
        title: "The 50/30/20 Budgeting Rule",
        description: "Allocate 50% of after-tax income to needs, 30% to wants, and 20% to savings and debt repayment for balanced financial health.",
        category: "Financial Planning Fundamentals",
        cfpPrinciple: "CFP Board Practice Standard 300 - Developing Recommendations",
        actionTips: [
          "Track your income and expenses for one month",
          "Categorize expenses into needs, wants, and savings",
          "Adjust spending to align with the 50/30/20 framework",
          "Review and adjust monthly"
        ],
        difficulty: userLevel
      }
    ],
    budgeting: [
      {
        title: "Zero-Based Budgeting Method",
        description: "Assign every dollar of income a specific purpose, ensuring income minus expenses equals zero for maximum financial control.",
        category: "Financial Planning Fundamentals",
        cfpPrinciple: "CFP Board Practice Standard 200 - Gathering Information",
        actionTips: [
          "List all sources of monthly income",
          "List all monthly expenses and financial goals",
          "Assign every dollar to a category",
          "Track spending throughout the month"
        ],
        difficulty: userLevel
      }
    ],
    investing: [
      {
        title: "Asset Allocation Fundamentals",
        description: "Diversify investments across asset classes based on your risk tolerance, time horizon, and financial goals.",
        category: "Investment Planning",
        cfpPrinciple: "CFP Board Practice Standard 400 - Developing Recommendations",
        actionTips: [
          "Determine your risk tolerance through assessment",
          "Consider your investment time horizon",
          "Diversify across stocks, bonds, and other assets",
          "Rebalance portfolio annually or when allocations drift >5%"
        ],
        difficulty: userLevel
      }
    ]
  };

  return fallbackTips[category as keyof typeof fallbackTips] || fallbackTips.general;
}
