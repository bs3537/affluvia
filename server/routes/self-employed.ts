import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { financialProfiles } from "../../shared/schema";
import { eq } from "drizzle-orm";
import SelfEmployedTaxCalculator from "../self-employed-tax-calculator";

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Get self-employed recommendations
router.get("/recommendations", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId));

    if (!profile) {
      return res.status(404).json({ error: "Financial profile not found" });
    }

    const recommendations = [];
    
    // Determine who is self-employed and get their income
    const userIsSelfEmployed = profile.employmentStatus === 'self-employed' || 
                               profile.employmentStatus === 'business-owner';
    const spouseIsSelfEmployed = profile.spouseEmploymentStatus === 'self-employed' || 
                                 profile.spouseEmploymentStatus === 'business-owner';
    
    let selfEmploymentIncome = 0;
    let age = 0;
    
    if (userIsSelfEmployed) {
      // User is self-employed - use their income
      selfEmploymentIncome = Number(profile.selfEmploymentIncome) || Number(profile.annualIncome) || 0;
      age = calculateAge(profile.dateOfBirth);
    } else if (spouseIsSelfEmployed) {
      // Spouse is self-employed - use their income
      selfEmploymentIncome = Number(profile.spouseAnnualIncome) || 0;
      age = calculateAge(profile.spouseDateOfBirth);
    } else {
      // Fallback to user's data if neither is marked as self-employed but isSelfEmployed flag is set
      selfEmploymentIncome = Number(profile.selfEmploymentIncome) || Number(profile.annualIncome) || 0;
      age = calculateAge(profile.dateOfBirth);
    }

    // Always calculate retirement plan options for self-employed individuals
    const limits = SelfEmployedTaxCalculator.calculateRetirementPlanLimits({
      selfEmploymentIncome,
      age,
      filingStatus: profile.taxFilingStatus as any || 'single'
    });

    // Determine the best retirement plan based on income and tax savings
    let bestPlan = null;
    let bestPlanSavings = 0;

    // Calculate tax savings for each plan - using same method as analyze-retirement-options
    const solo401kSavings = SelfEmployedTaxCalculator.calculateTaxSavings('solo401k', {
      selfEmploymentIncome,
      age,
      filingStatus: profile.taxFilingStatus as any || 'single'
    }, limits.solo401k.yourMaxContribution);
    
    const sepIraSavings = SelfEmployedTaxCalculator.calculateTaxSavings('sepIRA', {
      selfEmploymentIncome,
      age,
      filingStatus: profile.taxFilingStatus as any || 'single'
    }, limits.sepIRA.yourMaxContribution);
    
    const simpleIraSavings = SelfEmployedTaxCalculator.calculateTaxSavings('simpleIRA', {
      selfEmploymentIncome,
      age,
      filingStatus: profile.taxFilingStatus as any || 'single'
    }, limits.simpleIRA.yourMaxContribution);

    // Store plan details for consistent display
    const retirementPlanDetails = {
      solo401k: {
        maxContribution: limits.solo401k.yourMaxContribution,
        taxSavings: solo401kSavings
      },
      sepIRA: {
        maxContribution: limits.sepIRA.yourMaxContribution,
        taxSavings: sepIraSavings
      },
      simpleIRA: {
        maxContribution: limits.simpleIRA.yourMaxContribution,
        taxSavings: simpleIraSavings
      }
    };

    // Choose the plan with highest tax savings potential
    if (solo401kSavings >= sepIraSavings && solo401kSavings >= simpleIraSavings && limits.solo401k.yourMaxContribution > 0) {
      bestPlan = {
        type: "Solo 401(k)",
        contribution: limits.solo401k.yourMaxContribution,
        savings: solo401kSavings,
        planKey: 'solo401k'
      };
    } else if (sepIraSavings >= simpleIraSavings && limits.sepIRA.yourMaxContribution > 0) {
      bestPlan = {
        type: "SEP IRA",
        contribution: limits.sepIRA.yourMaxContribution,
        savings: sepIraSavings,
        planKey: 'sepIRA'
      };
    } else if (limits.simpleIRA.yourMaxContribution > 0) {
      bestPlan = {
        type: "SIMPLE IRA",
        contribution: limits.simpleIRA.yourMaxContribution,
        savings: simpleIraSavings,
        planKey: 'simpleIRA'
      };
    }

    // Add the best retirement plan recommendation using the EXACT same values
    if (bestPlan && bestPlan.savings > 0) {
      recommendations.push({
        title: `Open a ${bestPlan.type}`,
        description: `Maximize retirement savings with up to $${Math.floor(bestPlan.contribution).toLocaleString()} in annual contributions`,
        estimatedSavings: Math.floor(bestPlan.savings),
        planKey: bestPlan.planKey,
        urgency: 'high',
        category: 'retirement',
        actionItems: [
          "Choose a provider (Vanguard, Fidelity, Schwab)",
          "Complete plan adoption agreement",
          "Set up contribution schedule",
          "Make 2025 contributions by tax deadline"
        ],
        deadline: bestPlan.type === "Solo 401(k)" ? "December 31, 2025" : "April 15, 2026"
      });
    }

    // S-Corp election recommendation
    if (selfEmploymentIncome > 100000) {
      const sCorpAnalysis = SelfEmployedTaxCalculator.analyzeSCorpElection({
        selfEmploymentIncome,
        age,
        filingStatus: profile.taxFilingStatus as any || 'single'
      });

      if (sCorpAnalysis.recommended) {
        recommendations.push({
          title: "Consider S-Corp Election",
          description: `Save approximately $${sCorpAnalysis.netSavings.toLocaleString()} annually in self-employment taxes`,
          estimatedSavings: sCorpAnalysis.netSavings,
          urgency: 'medium',
          category: 'tax_structure',
          actionItems: [
            "File Form 2553 with IRS",
            "Set up payroll system",
            "Determine reasonable salary",
            "Maintain corporate formalities"
          ],
          deadline: "March 15, 2025"
        });
      }
    }

    // Quarterly tax payments recommendation
    if (!profile.quarterlyTaxPayments || profile.quarterlyTaxPayments.length === 0) {
      recommendations.push({
        title: "Set Up Quarterly Tax Payments",
        description: "Avoid underpayment penalties by making estimated tax payments",
        estimatedSavings: Math.floor(selfEmploymentIncome * 0.03), // Approximate penalty savings
        urgency: 'high',
        category: 'tax_compliance',
        actionItems: [
          "Calculate quarterly payment amounts",
          "Set up EFTPS account",
          "Schedule automatic payments",
          "Keep payment records"
        ],
        deadline: "April 15, 2025"
      });
    }

    // HSA recommendation
    recommendations.push({
      title: "Maximize HSA Contributions",
      description: "Triple tax advantage: deductible, tax-free growth, tax-free withdrawals for medical",
      estimatedSavings: Math.floor(4300 * 0.24), // Self-only limit * tax rate
      urgency: 'medium',
      category: 'health_savings',
      actionItems: [
        "Enroll in HDHP health plan",
        "Open HSA account",
        "Set up automatic contributions",
        "Invest HSA funds for growth"
      ]
    });

    // Home office deduction
    recommendations.push({
      title: "Claim Home Office Deduction",
      description: "Deduct $5 per square foot (up to 300 sq ft) or actual expenses",
      estimatedSavings: Math.floor(1500 * 0.24), // $1,500 deduction * tax rate
      urgency: 'low',
      category: 'deductions',
      actionItems: [
        "Measure dedicated office space",
        "Document exclusive business use",
        "Keep utility and maintenance records",
        "Choose simplified or actual method"
      ]
    });

    const totalEstimatedSavings = recommendations.reduce(
      (sum, rec) => sum + (rec.estimatedSavings || 0),
      0
    );

    return res.json({
      recommendations,
      totalEstimatedSavings,
      retirementPlanDetails,
      limits
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return res.status(500).json({ error: "Failed to generate recommendations" });
  }
});

// Analyze retirement plan options
router.post("/analyze-retirement-options", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      selfEmploymentIncome: z.number(),
      age: z.number(),
      spouseAge: z.number().optional(),
      filingStatus: z.enum(['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household']),
      businessExpenses: z.number().optional()
    });

    const data = schema.parse(req.body);
    
    const limits = SelfEmployedTaxCalculator.calculateRetirementPlanLimits({
      selfEmploymentIncome: data.selfEmploymentIncome,
      businessExpenses: data.businessExpenses,
      age: data.age,
      spouseAge: data.spouseAge,
      filingStatus: data.filingStatus
    });

    const comparisons = [
      {
        planType: "Solo 401(k)",
        contributionLimit2025: "$69,000",
        yourMaxContribution: limits.solo401k.yourMaxContribution,
        taxSavings: SelfEmployedTaxCalculator.calculateTaxSavings('solo401k', data, limits.solo401k.yourMaxContribution),
        rothOption: true,
        setupCost: "$500-$1,500",
        ongoingCost: "$100-$500/year",
        complexity: 'Medium' as const,
        bestFor: "High earners wanting maximum contributions",
        pros: [
          "Highest contribution limits",
          "Both employee and employer contributions",
          "Roth option available",
          "Loan provisions available"
        ],
        cons: [
          "More complex administration",
          "Higher setup and maintenance costs",
          "Required annual filing (Form 5500-EZ)"
        ]
      },
      {
        planType: "SEP IRA",
        contributionLimit2025: "$69,000",
        yourMaxContribution: limits.sepIRA.yourMaxContribution,
        taxSavings: SelfEmployedTaxCalculator.calculateTaxSavings('sepIRA', data, limits.sepIRA.yourMaxContribution),
        rothOption: false,
        setupCost: "$0-$250",
        ongoingCost: "$0-$100/year",
        complexity: 'Low' as const,
        bestFor: "Simple setup with flexible contributions",
        pros: [
          "Easy to set up and maintain",
          "Flexible annual contributions",
          "Low cost",
          "No annual filing requirements"
        ],
        cons: [
          "No Roth option",
          "Only employer contributions",
          "Must contribute equally for all employees"
        ]
      },
      {
        planType: "SIMPLE IRA",
        contributionLimit2025: "$16,000",
        yourMaxContribution: limits.simpleIRA.yourMaxContribution,
        taxSavings: SelfEmployedTaxCalculator.calculateTaxSavings('simpleIRA', data, limits.simpleIRA.yourMaxContribution),
        rothOption: false,
        setupCost: "$0-$150",
        ongoingCost: "$0-$100/year",
        complexity: 'Low' as const,
        bestFor: "Lower income or part-time self-employed",
        pros: [
          "Easy to set up",
          "Lower contribution requirements",
          "Employee deferrals allowed",
          "Catch-up contributions available"
        ],
        cons: [
          "Lower contribution limits",
          "No Roth option",
          "2-year withdrawal restrictions",
          "Must offer to all eligible employees"
        ]
      }
    ];

    return res.json({ comparisons, limits });
  } catch (error) {
    console.error("Error analyzing retirement options:", error);
    return res.status(500).json({ error: "Failed to analyze retirement options" });
  }
});

// Calculate quarterly taxes
router.post("/calculate-quarterly-taxes", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      selfEmploymentIncome: z.number(),
      previousYearAGI: z.number(),
      previousYearTax: z.number(),
      calculationMethod: z.enum(['safeHarbor', 'currentYear']),
      filingStatus: z.enum(['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household'])
    });

    const data = schema.parse(req.body);
    
    const quarters = SelfEmployedTaxCalculator.calculateQuarterlyTaxes({
      selfEmploymentIncome: data.selfEmploymentIncome,
      previousYearAGI: data.previousYearAGI,
      previousYearTax: data.previousYearTax,
      filingStatus: data.filingStatus,
      age: 40 // Default age for calculation
    });

    // Determine which payments to use based on method
    const payments = quarters.map(q => ({
      ...q,
      amount: data.calculationMethod === 'safeHarbor' ? q.safeHarborAmount : q.currentYearAmount,
      status: new Date(q.dueDate) < new Date() ? 'paid' : 'upcoming'
    }));

    return res.json({ payments });
  } catch (error) {
    console.error("Error calculating quarterly taxes:", error);
    return res.status(500).json({ error: "Failed to calculate quarterly taxes" });
  }
});

// Analyze S-Corp election
router.post("/s-corp-analysis", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      selfEmploymentIncome: z.number(),
      businessExpenses: z.number().optional(),
      reasonableSalaryOverride: z.number().optional().nullable(),
      filingStatus: z.enum(['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household']),
      state: z.string().optional()
    });

    const data = schema.parse(req.body);
    
    const analysis = SelfEmployedTaxCalculator.analyzeSCorpElection({
      selfEmploymentIncome: data.selfEmploymentIncome,
      businessExpenses: data.businessExpenses,
      filingStatus: data.filingStatus,
      age: 40 // Default age
    });

    const netIncome = data.selfEmploymentIncome - (data.businessExpenses || 0);
    const currentSETax = SelfEmployedTaxCalculator.calculateSelfEmploymentTax(netIncome);
    
    // Override reasonable salary if provided
    const reasonableSalary = data.reasonableSalaryOverride || analysis.reasonableSalary;
    const distributions = netIncome - reasonableSalary;
    const sCorpPayrollTax = reasonableSalary * 0.153;
    
    const result = {
      currentStructure: {
        selfEmploymentTax: currentSETax,
        incomeTax: netIncome * 0.22, // Simplified
        totalTax: currentSETax + (netIncome * 0.22)
      },
      sCorpStructure: {
        reasonableSalary,
        distributions,
        payrollTax: sCorpPayrollTax,
        incomeTax: netIncome * 0.22, // Simplified
        totalTax: sCorpPayrollTax + (netIncome * 0.22) + analysis.additionalCosts,
        additionalCosts: analysis.additionalCosts
      },
      savings: {
        payrollTaxSavings: currentSETax - sCorpPayrollTax,
        additionalCosts: analysis.additionalCosts,
        netSavings: (currentSETax - sCorpPayrollTax) - analysis.additionalCosts,
        percentageSavings: ((currentSETax - sCorpPayrollTax - analysis.additionalCosts) / currentSETax) * 100
      },
      recommendation: {
        shouldElect: analysis.recommended,
        reason: analysis.recommended ? 
          `With net income of $${netIncome.toLocaleString()}, S-Corp election would save approximately $${analysis.netSavings.toLocaleString()} annually after costs.` :
          `S-Corp election is typically beneficial when net income exceeds $${analysis.breakEvenPoint.toLocaleString()}. Your current income may not justify the additional complexity and costs.`,
        breakEvenPoint: analysis.breakEvenPoint
      }
    };

    return res.json(result);
  } catch (error) {
    console.error("Error analyzing S-Corp election:", error);
    return res.status(500).json({ error: "Failed to analyze S-Corp election" });
  }
});

// Optimize deductions
router.post("/deduction-optimizer", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      selfEmploymentIncome: z.number(),
      inputs: z.object({
        homeOfficeSquareFeet: z.number(),
        totalHomeSquareFeet: z.number(),
        businessMiles: z.number(),
        healthInsurancePremiums: z.number(),
        hasHDHP: z.boolean(),
        familyCoverage: z.boolean(),
        businessMeals: z.number(),
        businessTravel: z.number(),
        professionalDevelopment: z.number(),
        businessInsurance: z.number(),
        equipmentPurchases: z.number(),
        softwareSubscriptions: z.number(),
        internetPhone: z.number(),
        professionalFees: z.number()
      })
    });

    const data = schema.parse(req.body);
    
    const deductions = SelfEmployedTaxCalculator.calculateTaxDeductions(
      {
        selfEmploymentIncome: data.selfEmploymentIncome,
        age: 40, // Default age
        filingStatus: 'single'
      },
      {
        homeOfficeSquareFeet: data.inputs.homeOfficeSquareFeet,
        totalHomeSquareFeet: data.inputs.totalHomeSquareFeet,
        businessMiles: data.inputs.businessMiles,
        healthInsurancePremiums: data.inputs.healthInsurancePremiums,
        hasHDHP: data.inputs.hasHDHP,
        familyCoverage: data.inputs.familyCoverage
      }
    );

    // Add additional business expenses
    const additionalExpenses = 
      data.inputs.businessMeals * 0.5 + // 50% deductible
      data.inputs.businessTravel +
      data.inputs.professionalDevelopment +
      data.inputs.businessInsurance +
      data.inputs.softwareSubscriptions +
      data.inputs.internetPhone * 0.5 + // 50% business use assumed
      data.inputs.professionalFees;

    const totalDeductions = deductions.totalDeductions + additionalExpenses;
    const taxSavings = totalDeductions * 0.24; // Assuming 24% marginal rate
    const effectiveRate = ((data.selfEmploymentIncome - totalDeductions) / data.selfEmploymentIncome) * 0.24;

    // Persist calculation results alongside inputs snapshot
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, req.user.id));

    if (profile) {
      const current = (profile?.selfEmployedData as any) || {};
      const updated = {
        ...current,
        // Save the latest inputs used for calculation
        deductionInputs: data.inputs,
        deductionInputsLastUpdated: new Date().toISOString(),
        // Save the calculated results
        deductionResults: {
          ...deductions,
          businessExpenses: deductions.businessExpenses + additionalExpenses,
          totalDeductions,
          taxSavings,
          effectiveRate
        },
        deductionResultsLastUpdated: new Date().toISOString(),
        // Keep calculation metadata for reference
        lastCalculationData: {
          inputsUsed: data.inputs,
          selfEmploymentIncome: data.selfEmploymentIncome,
          calculatedAt: new Date().toISOString()
        }
      };

      await db
        .update(financialProfiles)
        .set({ selfEmployedData: updated, lastUpdated: new Date() })
        .where(eq(financialProfiles.userId, req.user.id));
    }

    return res.json({
      ...deductions,
      businessExpenses: deductions.businessExpenses + additionalExpenses,
      totalDeductions,
      taxSavings,
      effectiveRate
    });
  } catch (error) {
    console.error("Error optimizing deductions:", error);
    return res.status(500).json({ error: "Failed to optimize deductions" });
  }
});

// Save deduction inputs
router.post("/save-deductions", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      deductionInputs: z.object({
        homeOfficeSquareFeet: z.number(),
        totalHomeSquareFeet: z.number(),
        businessMiles: z.number(),
        healthInsurancePremiums: z.number(),
        hasHDHP: z.boolean(),
        familyCoverage: z.boolean(),
        businessMeals: z.number(),
        businessTravel: z.number(),
        professionalDevelopment: z.number(),
        businessInsurance: z.number(),
        equipmentPurchases: z.number(),
        softwareSubscriptions: z.number(),
        internetPhone: z.number(),
        professionalFees: z.number()
      })
    });

    const data = schema.parse(req.body);
    
    // Get existing profile
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, req.user.id));

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Merge deduction inputs with existing self-employed data
    const selfEmployedData = profile.selfEmployedData || {};
    const updatedSelfEmployedData = {
      ...selfEmployedData,
      deductionInputs: data.deductionInputs,
      deductionInputsLastUpdated: new Date().toISOString()
    };

    // Update profile
    await db
      .update(financialProfiles)
      .set({ 
        selfEmployedData: updatedSelfEmployedData,
        lastUpdated: new Date()
      })
      .where(eq(financialProfiles.userId, req.user.id));

    return res.json({ 
      success: true, 
      message: "Deductions saved successfully",
      deductionInputs: data.deductionInputs
    });
  } catch (error) {
    console.error("Error saving deductions:", error);
    return res.status(500).json({ error: "Failed to save deductions" });
  }
});

// Save estimated tax data
router.post("/save-estimated-taxes", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      thisYearEstimatedIncome: z.number(),
      estimatedTaxes: z.object({
        selfEmploymentTax: z.number(),
        incomeTax: z.number(),
        totalTax: z.number(),
        quarterlyAmount: z.number()
      }).optional()
    });

    const data = schema.parse(req.body);
    
    // Get existing profile
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, req.user.id));

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Merge estimated tax data with existing self-employed data
    const selfEmployedData = profile.selfEmployedData || {};
    const existingEstimatedTaxData = selfEmployedData.estimatedTaxData || {};
    
    const updatedEstimatedTaxData = {
      ...existingEstimatedTaxData,
      thisYearEstimatedIncome: data.thisYearEstimatedIncome,
      lastUpdated: new Date().toISOString()
    };
    
    // Only update estimated taxes if provided
    if (data.estimatedTaxes) {
      updatedEstimatedTaxData.estimatedTaxes = data.estimatedTaxes;
      updatedEstimatedTaxData.calculatedAt = new Date().toISOString();
    }
    
    const updatedSelfEmployedData = {
      ...selfEmployedData,
      estimatedTaxData: updatedEstimatedTaxData
    };

    // Update profile
    await db
      .update(financialProfiles)
      .set({ 
        selfEmployedData: updatedSelfEmployedData,
        lastUpdated: new Date()
      })
      .where(eq(financialProfiles.userId, req.user.id));

    return res.json({ 
      success: true, 
      message: "Estimated tax data saved successfully",
      estimatedTaxData: updatedSelfEmployedData.estimatedTaxData
    });
  } catch (error) {
    console.error("Error saving estimated tax data:", error);
    return res.status(500).json({ error: "Failed to save estimated tax data" });
  }
});

// Get saved deduction inputs
router.get("/deductions", requireAuth, async (req: any, res) => {
  try {
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, req.user.id));

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const selfEmployedData = profile.selfEmployedData as any || {};
    const deductionInputs = selfEmployedData.deductionInputs || null;
    const deductionResults = selfEmployedData.deductionResults || null;

    return res.json({ 
      deductionInputs,
      deductionResults,
      lastUpdated: selfEmployedData.deductionInputsLastUpdated || null,
      resultsLastUpdated: selfEmployedData.deductionResultsLastUpdated || null,
      lastCalculationData: selfEmployedData.lastCalculationData || null
    });
  } catch (error) {
    console.error("Error retrieving deductions:", error);
    return res.status(500).json({ error: "Failed to retrieve deductions" });
  }
});

// Business structure recommendation endpoint
router.post("/business-structure-recommendation", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      businessStructure: z.string(),
      businessGoals: z.object({
        limitLiability: z.boolean(),
        multipleOwners: z.boolean(),
        raiseFunding: z.boolean(),
        taxFlexibility: z.boolean(),
        simplicity: z.boolean()
      }),
      selfEmploymentIncome: z.number()
    });

    const data = schema.parse(req.body);
    
    // Get existing profile
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, req.user.id));

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Business structure recommendation logic
    const generateRecommendation = (income: number, goals: any) => {
      let recommendedStructure = 'sole_proprietor';
      let reasons = [];
      let actionItems = [];
      let estimatedSavings = 0;

      // Liability protection consideration
      if (goals.limitLiability) {
        if (goals.multipleOwners) {
          recommendedStructure = 'multi_llc';
          reasons.push('Multi-member LLC provides liability protection for all partners');
        } else {
          recommendedStructure = 'single_llc';
          reasons.push('Single-member LLC provides personal asset protection');
        }
      }

      // Income-based recommendations
      if (income > 100000 && !goals.multipleOwners) {
        if (recommendedStructure === 'single_llc' || recommendedStructure === 'sole_proprietor') {
          recommendedStructure = 'single_llc';
          reasons.push('Consider S-Corp election for self-employment tax savings');
          // Estimate SE tax savings
          const netEarnings = income * 0.9235;
          const reasonableSalary = Math.min(income * 0.6, 160000); // 60% as reasonable salary, capped at FICA wage base
          const seTaxSavings = (netEarnings - reasonableSalary) * 0.153;
          estimatedSavings = Math.max(0, seTaxSavings - 2500); // Subtract additional costs
          actionItems.push('File Form 2553 for S-Corp election');
          actionItems.push('Set up payroll system');
        }
      }

      // Funding considerations
      if (goals.raiseFunding) {
        recommendedStructure = 'c_corp';
        reasons.push('C-Corporation is preferred by investors and allows multiple share classes');
        actionItems.push('File Articles of Incorporation');
        actionItems.push('Prepare for venture capital requirements');
      }

      // Multiple owners
      if (goals.multipleOwners && recommendedStructure !== 'c_corp') {
        recommendedStructure = 'multi_llc';
        reasons.push('Multi-member LLC allows flexible ownership and profit sharing');
        actionItems.push('Draft comprehensive operating agreement');
        actionItems.push('Define member roles and responsibilities');
      }

      // Simplicity preference
      if (goals.simplicity && income < 50000 && !goals.limitLiability && !goals.multipleOwners) {
        recommendedStructure = 'sole_proprietor';
        reasons.push('Sole proprietorship keeps compliance requirements minimal');
        actionItems.push('Ensure proper business expense tracking');
        actionItems.push('Consider business insurance for liability protection');
      }

      // Tax flexibility
      if (goals.taxFlexibility && income > 75000) {
        if (recommendedStructure === 'single_llc') {
          reasons.push('LLC provides flexibility to elect different tax treatments');
          actionItems.push('Evaluate S-Corp election annually');
        }
      }

      return {
        recommendedStructure,
        reasons,
        actionItems,
        estimatedSavings,
        nextSteps: actionItems.length > 0 ? actionItems : [
          'Review current structure annually',
          'Consult with tax professional for optimization'
        ]
      };
    };

    const recommendation = generateRecommendation(data.selfEmploymentIncome, data.businessGoals);

    // Save the business structure data
    const selfEmployedData = profile.selfEmployedData || {};
    const updatedSelfEmployedData = {
      ...selfEmployedData,
      businessStructureData: {
        currentStructure: data.businessStructure,
        businessGoals: data.businessGoals,
        recommendation,
        lastUpdated: new Date().toISOString()
      }
    };

    await db
      .update(financialProfiles)
      .set({ 
        selfEmployedData: updatedSelfEmployedData,
        lastUpdated: new Date()
      })
      .where(eq(financialProfiles.userId, req.user.id));

    return res.json({ 
      success: true, 
      recommendation,
      message: "Business structure recommendation generated successfully"
    });
  } catch (error) {
    console.error("Error generating business structure recommendation:", error);
    return res.status(500).json({ error: "Failed to generate business structure recommendation" });
  }
});

// Save business structure selection
router.post("/save-business-structure", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      businessStructure: z.string(),
      businessGoals: z.object({
        limitLiability: z.boolean(),
        multipleOwners: z.boolean(),
        raiseFunding: z.boolean(),
        taxFlexibility: z.boolean(),
        simplicity: z.boolean()
      }).optional()
    });

    const data = schema.parse(req.body);
    
    // Get existing profile
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, req.user.id));

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Update business structure in profile
    const selfEmployedData = profile.selfEmployedData || {};
    const existingBusinessData = selfEmployedData.businessStructureData || {};
    
    const updatedBusinessData = {
      ...existingBusinessData,
      currentStructure: data.businessStructure,
      ...(data.businessGoals && { businessGoals: data.businessGoals }),
      lastUpdated: new Date().toISOString()
    };
    
    const updatedSelfEmployedData = {
      ...selfEmployedData,
      businessStructureData: updatedBusinessData
    };

    await db
      .update(financialProfiles)
      .set({ 
        selfEmployedData: updatedSelfEmployedData,
        lastUpdated: new Date()
      })
      .where(eq(financialProfiles.userId, req.user.id));

    return res.json({ 
      success: true, 
      message: "Business structure saved successfully",
      businessStructureData: updatedSelfEmployedData.businessStructureData
    });
  } catch (error) {
    console.error("Error saving business structure:", error);
    return res.status(500).json({ error: "Failed to save business structure" });
  }
});

// Get business structure data
router.get("/business-structure", requireAuth, async (req: any, res) => {
  try {
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, req.user.id));

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const selfEmployedData = profile.selfEmployedData as any || {};
    const businessStructureData = selfEmployedData.businessStructureData || null;

    return res.json({ 
      businessStructureData,
      lastUpdated: businessStructureData?.lastUpdated || null
    });
  } catch (error) {
    console.error("Error retrieving business structure data:", error);
    return res.status(500).json({ error: "Failed to retrieve business structure data" });
  }
});

// Helper function
function calculateAge(dateOfBirth: string | null): number {
  if (!dateOfBirth) return 40; // Default age
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export default router;
