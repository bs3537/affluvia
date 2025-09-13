import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, 
  Target, 
  Shield, 
  TrendingDown, 
  PiggyBank, 
  Umbrella, 
  TrendingUp,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface HealthScoreData {
  overall: number;
  netWorthScore: number;
  emergencyFundScore: number;
  dtiScore: number;
  savingsRateScore: number;
  insuranceScore: number;
  emergencyMonths?: number;
  dtiRatio?: number;
  savingsRate?: number;
}

interface Suggestion {
  icon: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  priority?: number;
}

interface Props {
  healthScoreData: HealthScoreData;
  profile: any;
}

export function FinancialHealthSuggestions({ healthScoreData, profile }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  
  // Map icon strings to components
  const iconMap = {
    Target,
    Shield,
    TrendingDown,
    PiggyBank,
    Umbrella,
    TrendingUp,
    TrendingUpIcon: TrendingUp
  };
  
  const generateSuggestions = useMutation({
    mutationFn: async (data: HealthScoreData) => {
      // Only send essential profile data to avoid 413 Payload Too Large error
      const minimalProfile = {
        annualIncome: profile?.annualIncome,
        monthlyExpenses: profile?.monthlyExpenses,
        assets: profile?.assets?.length || 0,
        liabilities: profile?.liabilities?.length || 0,
        emergencyFundSize: profile?.emergencyFundSize,
        hasLifeInsurance: profile?.lifeInsurance ? true : false,
        hasDisabilityInsurance: profile?.disabilityInsurance ? true : false,
        retirementAge: profile?.desiredRetirementAge || profile?.retirementAge
      };
      
      const response = await fetch('/api/generate-financial-health-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          healthScoreData: data, 
          profile: minimalProfile 
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate suggestions');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.suggestions && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
    },
    onError: (error) => {
      console.error('Failed to generate suggestions:', error);
      // Set default suggestions on error
      setSuggestions(getDefaultSuggestions(healthScoreData));
    }
  });

  const getDefaultSuggestions = (data: HealthScoreData): Suggestion[] => {
    const suggestions = [];
    
    // Add suggestions based on lowest scores
    if (data.netWorthScore < 50) {
      suggestions.push({
        icon: 'Target',
        title: 'Build Net Worth',
        description: 'Focus on increasing assets and reducing high-interest debt to reach 5x annual income',
        impact: 'high',
        priority: 1
      });
    }
    
    if (data.emergencyFundScore < 60) {
      suggestions.push({
        icon: 'Shield',
        title: 'Boost Emergency Fund',
        description: 'Save aggressively to reach 6 months of essential expenses',
        impact: 'high',
        priority: 2
      });
    }
    
    if (data.dtiScore < 60) {
      suggestions.push({
        icon: 'TrendingDown',
        title: 'Reduce Debt Ratio',
        description: 'Pay down debt to achieve DTI ratio below 28%',
        impact: 'medium',
        priority: 3
      });
    }
    
    // Ensure we always have 3 suggestions
    while (suggestions.length < 3) {
      if (data.savingsRateScore < 80 && !suggestions.find(s => s.icon === 'PiggyBank')) {
        suggestions.push({
          icon: 'PiggyBank',
          title: 'Increase Savings',
          description: 'Automate savings to reach 20% of gross income',
          impact: 'medium',
          priority: suggestions.length + 1
        });
      } else if (data.insuranceScore < 80 && !suggestions.find(s => s.icon === 'Umbrella')) {
        suggestions.push({
          icon: 'Umbrella',
          title: 'Optimize Insurance',
          description: 'Review coverage gaps and ensure adequate protection',
          impact: 'low',
          priority: suggestions.length + 1
        });
      } else {
        suggestions.push({
          icon: 'TrendingUp',
          title: 'Maximize Investments',
          description: 'Increase retirement contributions and optimize asset allocation',
          impact: 'low',
          priority: suggestions.length + 1
        });
      }
    }
    
    return suggestions.slice(0, 3);
  };

  useEffect(() => {
    if (healthScoreData.overall !== undefined) {
      // Set default suggestions immediately
      setSuggestions(getDefaultSuggestions(healthScoreData));
      
      // Then try to get AI suggestions
      generateSuggestions.mutate(healthScoreData);
    }
  }, [healthScoreData.overall]);

  if (suggestions.length === 0 && !generateSuggestions.isPending) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-800/30">
      <h5 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-yellow-400" />
        Top 3 Ways to Improve Your Score
      </h5>
      
      <div className="space-y-3">
        <AnimatePresence mode="wait">
          {suggestions.map((suggestion, index) => {
            const IconComponent = iconMap[suggestion.icon as keyof typeof iconMap] || Target;
            
            return (
              <motion.div
                key={`${suggestion.title}-${index}`}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-800/40 rounded-lg p-3 border border-gray-700 hover:border-purple-700/50 transition-all hover:bg-gray-800/60"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    suggestion.impact === 'high' 
                      ? 'bg-red-900/30 text-red-400' 
                      : suggestion.impact === 'medium'
                      ? 'bg-yellow-900/30 text-yellow-400'
                      : 'bg-green-900/30 text-green-400'
                  }`}>
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h6 className="text-sm font-semibold text-white flex items-center gap-2">
                        <span className="text-purple-400">#{index + 1}</span>
                        {suggestion.title}
                      </h6>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        suggestion.impact === 'high' 
                          ? 'bg-red-900/30 text-red-400' 
                          : suggestion.impact === 'medium'
                          ? 'bg-yellow-900/30 text-yellow-400'
                          : 'bg-green-900/30 text-green-400'
                      }`}>
                        {suggestion.impact} impact
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      {suggestion.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {generateSuggestions.isPending && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-3"
          >
            <div className="inline-flex items-center gap-2 text-gray-400">
              <Sparkles className="h-4 w-4 animate-pulse text-purple-400" />
              <span className="text-xs">Analyzing your financial data...</span>
            </div>
          </motion.div>
        )}
      </div>
      
      {healthScoreData.overall < 80 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-400">
            💡 <span className="text-purple-300">Pro tip:</span> Focus on the #1 recommendation first for maximum impact on your financial health score
          </p>
        </div>
      )}
    </div>
  );
}