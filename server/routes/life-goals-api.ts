import { Request, Response, NextFunction } from 'express';
import { Storage } from '../storage';
import { calculateLifeGoalScenario, generateLifeGoalInsights } from '../services/life-goals-service';

// Generate goal recommendations using Gemini
async function generateGoalRecommendations(prompt: string, goalData: any) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const enhancedPrompt = `${prompt}
    
    Please provide specific, actionable recommendations. Each recommendation should be practical and based on the user's actual financial situation.
    Return ONLY a valid JSON array, no markdown or additional text.`;

    const result = await model.generateContent(enhancedPrompt);
    const responseText = result.response.text();
    
    // Parse the JSON response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback recommendations
    return null;
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return null;
  }
}

export function setupLifeGoalsRoutes(app: any, storage: Storage) {
  
  // Get life goals for user
  app.get('/api/life-goals', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goals = await storage.getLifeGoals(req.user!.id);
      res.json(goals);
    } catch (error) {
      next(error);
    }
  });

  // Create new life goal
  app.post('/api/life-goals', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      console.log('=== CREATE LIFE GOAL REQUEST ===');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      console.log('fundingSources in request:', req.body.fundingSources);
      console.log('metadata in request:', req.body.metadata);
      
      const goalData = {
        ...req.body,
        userId: req.user!.id
      };
      
      console.log('Goal data to create:', JSON.stringify(goalData, null, 2));
      
      const goal = await storage.createLifeGoal(req.user!.id, goalData);
      
      console.log('Created goal result:', JSON.stringify(goal, null, 2));
      console.log('=== END CREATE LIFE GOAL ===');
      
      res.json(goal);
    } catch (error) {
      next(error);
    }
  });

  // Update life goal
  app.patch('/api/life-goals/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      const updates = {
        ...req.body
      };
      
      const goal = await storage.updateLifeGoal(req.user!.id, goalId, updates);
      res.json(goal);
    } catch (error) {
      next(error);
    }
  });

  // Delete life goal
  app.delete('/api/life-goals/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      await storage.deleteLifeGoal(req.user!.id, goalId);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Calculate what-if scenario for life goal
  app.post('/api/life-goal-scenario/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      const goal = await storage.getLifeGoal(req.user!.id, goalId);
      
      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      
      const scenario = req.body;
      const result = calculateLifeGoalScenario(goal, scenario);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Get AI insights for life goal
  app.get('/api/life-goal-insights/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      const goal = await storage.getLifeGoal(req.user!.id, goalId);
      
      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      
      // Get user's financial profile for context
      const profile = await storage.getFinancialProfile(req.user!.id);
      
      // Generate insights using Gemini API
      const insights = await generateLifeGoalInsights(goal, profile);
      
      res.json(insights);
    } catch (error) {
      next(error);
    }
  });

  // Generate goal recommendations endpoint
  app.post('/api/generate-goal-recommendations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { prompt, goalData } = req.body;
      
      // Skip education goals as requested - they have their own flow
      if (goalData.goalType === 'education' || goalData.goalType === 'college') {
        const recommendations = await generateGoalRecommendations(prompt, goalData);
        
        if (recommendations) {
          return res.json({ recommendations });
        }
        // Fall through to basic fallback for education goals
        return res.json({ 
          recommendations: [{ 
            type: 'info', 
            text: 'Education goal recommendations are managed in the Education Planning section.' 
          }] 
        });
      }
      
      // Get user's financial profile for comprehensive analysis
      const profile = await storage.getFinancialProfile(req.user!.id);
      
      if (!profile) {
        return res.status(400).json({ 
          error: 'Financial profile required for personalized recommendations',
          recommendations: [{
            type: 'caution',
            text: 'Please complete your financial profile to receive personalized funding recommendations.'
          }]
        });
      }
      
      // Transform goalData to match the LifeGoal format expected by generateLifeGoalInsights
      const goalForAnalysis: any = {
        id: goalData.id || 0,
        goalType: goalData.goalType,
        goalName: goalData.goalName || goalData.name || 'Life Goal',
        description: goalData.description,
        targetAmount: goalData.targetAmount || 0,
        targetDate: goalData.targetDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // Default 1 year
        currentAmount: goalData.currentAmount || 0,
        fundingSources: goalData.fundingSources || goalData.metadata?.fundingSources || [],
        fundingPercentage: goalData.fundingPercentage,
        priority: goalData.priority || 'medium',
        status: goalData.status,
        metadata: goalData.metadata || {}
      };
      
      // Use the sophisticated analysis function that considers all funding options
      const insights = await generateLifeGoalInsights(goalForAnalysis, profile);
      
      // Transform insights to match the client's expected format
      const recommendations = insights.map((insight: any) => {
        // Map priority and funding type to the client's type system
        let type = 'info'; // default
        
        if (insight.priority === 'high' || insight.fundingType === 'cashflow') {
          type = 'urgent';
        } else if (insight.priority === 'medium' || insight.fundingType === 'heloc') {
          type = 'caution';
        } else if (insight.fundingType === 'other' && insight.title?.includes('Summary')) {
          type = 'success';
        }
        
        // Create comprehensive text combining all details
        let text = insight.title;
        
        if (insight.description) {
          text += `: ${insight.description}`;
        }
        
        if (insight.estimatedImpact) {
          text += ` Impact: ${insight.estimatedImpact}.`;
        }
        
        if (insight.monthlyPayment && insight.monthlyPayment > 0) {
          text += ` Monthly payment required: $${insight.monthlyPayment.toLocaleString()}.`;
        }
        
        return {
          type,
          text,
          fundingType: insight.fundingType,
          shortfallReduction: insight.shortfallReduction,
          monthlyPayment: insight.monthlyPayment
        };
      });
      
      // If no insights were generated, provide fallback based on actual data
      if (recommendations.length === 0) {
        const targetAmount = goalData.targetAmount || 0;
        const currentFunding = goalData.currentAmount || 
          (goalData.fundingPercentage ? targetAmount * (goalData.fundingPercentage / 100) : 0);
        const shortfall = Math.max(0, targetAmount - currentFunding);
        const shortfallPercentage = targetAmount > 0 ? (shortfall / targetAmount) * 100 : 0;
        
        if (shortfall > 0) {
          const monthlyIncome = ((profile.annualIncome || 0) + (profile.spouseAnnualIncome || 0)) / 12;
          const monthlyExpenses = profile.monthlyExpenses || 0;
          const monthlyCashFlow = monthlyIncome - monthlyExpenses;
          const homeEquity = (profile.homeValue || 0) - (profile.mortgageBalance || 0);
          const total401k = (profile.retirement401k || 0) + (profile.spouseRetirement401k || 0);
          
          recommendations.push({
            type: shortfallPercentage > 20 ? 'urgent' : (shortfallPercentage > 5 ? 'caution' : 'info'),
            text: `You have a $${shortfall.toLocaleString()} funding shortfall (${shortfallPercentage.toFixed(1)}%). ` +
                  `With $${monthlyCashFlow.toLocaleString()}/month in cash flow, ` +
                  (monthlyCashFlow > shortfall/12 ? 
                    `allocate an additional $${Math.round(shortfall/12).toLocaleString()}/month to eliminate this gap.` :
                    homeEquity > shortfall ? 
                      `consider a HELOC using your $${homeEquity.toLocaleString()} in home equity.` :
                      total401k > shortfall * 2 ?
                        `a 401(k) loan could cover this (you have $${total401k.toLocaleString()} available).` :
                        `explore a combination of funding sources to close this gap.`)
          });
        } else {
          recommendations.push({
            type: 'success',
            text: 'Congratulations! This goal is fully funded. Focus on optimizing your investment allocation and ensuring proper asset protection.'
          });
        }
      }
      
      res.json({ recommendations });
      
    } catch (error) {
      console.error('Error generating enhanced recommendations:', error);
      next(error);
    }
  });

  // Update life goal
  app.patch('/api/life-goals/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      const updates = {
        ...req.body
      };
      
      const goal = await storage.updateLifeGoal(req.user!.id, goalId, updates);
      res.json(goal);
    } catch (error) {
      next(error);
    }
  });

  // Delete life goal
  app.delete('/api/life-goals/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      await storage.deleteLifeGoal(req.user!.id, goalId);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Calculate what-if scenario for life goal
  app.post('/api/life-goal-scenario/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      const goal = await storage.getLifeGoal(req.user!.id, goalId);
      
      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      
      const scenario = req.body;
      const result = calculateLifeGoalScenario(goal, scenario);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Get AI insights for life goal
  app.get('/api/life-goal-insights/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const goalId = parseInt(req.params.id);
      const goal = await storage.getLifeGoal(req.user!.id, goalId);
      
      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      
      // Get user's financial profile for context
      const profile = await storage.getFinancialProfile(req.user!.id);
      
      // Generate insights using Gemini API
      const insights = await generateLifeGoalInsights(goal, profile);
      
      res.json(insights);
    } catch (error) {
      next(error);
    }
  });

  // Generate goal recommendations endpoint
  app.post('/api/generate-goal-recommendations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { prompt, goalData } = req.body;
      
      // Skip education goals as requested - they have their own flow
      if (goalData.goalType === 'education' || goalData.goalType === 'college') {
        const recommendations = await generateGoalRecommendations(prompt, goalData);
        
        if (recommendations) {
          return res.json({ recommendations });
        }
        // Fall through to basic fallback for education goals
        return res.json({ 
          recommendations: [{ 
            type: 'info', 
            text: 'Education goal recommendations are managed in the Education Planning section.' 
          }] 
        });
      }
      
      // Get user's financial profile for comprehensive analysis
      const profile = await storage.getFinancialProfile(req.user!.id);
      
      if (!profile) {
        return res.status(400).json({ 
          error: 'Financial profile required for personalized recommendations',
          recommendations: [{
            type: 'caution',
            text: 'Please complete your financial profile to receive personalized funding recommendations.'
          }]
        });
      }
      
      // Transform goalData to match the LifeGoal format expected by generateLifeGoalInsights
      const goalForAnalysis: any = {
        id: goalData.id || 0,
        goalType: goalData.goalType,
        goalName: goalData.goalName || goalData.name || 'Life Goal',
        description: goalData.description,
        targetAmount: goalData.targetAmount || 0,
        targetDate: goalData.targetDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // Default 1 year
        currentAmount: goalData.currentAmount || 0,
        fundingSources: goalData.fundingSources || goalData.metadata?.fundingSources || [],
        fundingPercentage: goalData.fundingPercentage,
        priority: goalData.priority || 'medium',
        status: goalData.status,
        metadata: goalData.metadata || {}
      };
      
      // Use the sophisticated analysis function that considers all funding options
      const insights = await generateLifeGoalInsights(goalForAnalysis, profile);
      
      // Transform insights to match the client's expected format
      const recommendations = insights.map((insight: any) => {
        // Map priority and funding type to the client's type system
        let type = 'info'; // default
        
        if (insight.priority === 'high' || insight.fundingType === 'cashflow') {
          type = 'urgent';
        } else if (insight.priority === 'medium' || insight.fundingType === 'heloc') {
          type = 'caution';
        } else if (insight.fundingType === 'other' && insight.title?.includes('Summary')) {
          type = 'success';
        }
        
        // Create comprehensive text combining all details
        let text = insight.title;
        
        if (insight.description) {
          text += `: ${insight.description}`;
        }
        
        if (insight.estimatedImpact) {
          text += ` Impact: ${insight.estimatedImpact}.`;
        }
        
        if (insight.monthlyPayment && insight.monthlyPayment > 0) {
          text += ` Monthly payment required: $${insight.monthlyPayment.toLocaleString()}.`;
        }
        
        return {
          type,
          text,
          fundingType: insight.fundingType,
          shortfallReduction: insight.shortfallReduction,
          monthlyPayment: insight.monthlyPayment
        };
      });
      
      // If no insights were generated, provide fallback based on actual data
      if (recommendations.length === 0) {
        const targetAmount = goalData.targetAmount || 0;
        const currentFunding = goalData.currentAmount || 
          (goalData.fundingPercentage ? targetAmount * (goalData.fundingPercentage / 100) : 0);
        const shortfall = Math.max(0, targetAmount - currentFunding);
        const shortfallPercentage = targetAmount > 0 ? (shortfall / targetAmount) * 100 : 0;
        
        if (shortfall > 0) {
          const monthlyIncome = ((profile.annualIncome || 0) + (profile.spouseAnnualIncome || 0)) / 12;
          const monthlyExpenses = profile.monthlyExpenses || 0;
          const monthlyCashFlow = monthlyIncome - monthlyExpenses;
          const homeEquity = (profile.homeValue || 0) - (profile.mortgageBalance || 0);
          const total401k = (profile.retirement401k || 0) + (profile.spouseRetirement401k || 0);
          
          recommendations.push({
            type: shortfallPercentage > 20 ? 'urgent' : (shortfallPercentage > 5 ? 'caution' : 'info'),
            text: `You have a $${shortfall.toLocaleString()} funding shortfall (${shortfallPercentage.toFixed(1)}%). ` +
                  `With $${monthlyCashFlow.toLocaleString()}/month in cash flow, ` +
                  (monthlyCashFlow > shortfall/12 ? 
                    `allocate an additional $${Math.round(shortfall/12).toLocaleString()}/month to eliminate this gap.` :
                    homeEquity > shortfall ? 
                      `consider a HELOC using your $${homeEquity.toLocaleString()} in home equity.` :
                      total401k > shortfall * 2 ?
                        `a 401(k) loan could cover this (you have $${total401k.toLocaleString()} available).` :
                        `explore a combination of funding sources to close this gap.`)
          });
        } else {
          recommendations.push({
            type: 'success',
            text: 'Congratulations! This goal is fully funded. Focus on optimizing your investment allocation and ensuring proper asset protection.'
          });
        }
      }
      
      res.json({ recommendations });
      
    } catch (error) {
      console.error('Error generating enhanced recommendations:', error);
      res.status(500).json({ 
        error: 'Failed to generate recommendations',
        recommendations: [{
          type: 'info',
          text: 'Unable to generate personalized recommendations at this time. Please review your funding sources and consider consulting with a financial advisor.'
        }]
      });
    }
  });
}

// Helper function to calculate funding percentage
function calculateFundingPercentage(goalData: any): number {
  if (!goalData.targetAmount) return 0;
  
  if (goalData.fundingPercentage !== undefined) {
    return goalData.fundingPercentage;
  }
  
  const currentAmount = goalData.currentAmount || 0;
  return Math.min(100, (currentAmount / goalData.targetAmount) * 100);
}