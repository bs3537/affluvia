import React, { useState } from 'react';
import { 
  ChevronRight, 
  AlertCircle, 
  Clock, 
  TrendingUp,
  Shield,
  PiggyBank,
  Umbrella,
  Target,
  Calculator,
  FileText,
  Lightbulb,
  ArrowRight,
  ExternalLink,
  Calendar,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Add hover animation styles
const accordionStyles = `
  .expand-toggle-btn {
    transition: all 0.2s ease-in-out;
    position: relative;
  }
  
  .expand-toggle-btn:hover {
    background-color: rgba(176, 64, 255, 0.2) !important;
    transform: scale(1.1);
    box-shadow: 0 0 15px rgba(176, 64, 255, 0.3);
  }
  
  .expand-toggle-btn:hover .chevron-icon {
    color: #B040FF !important;
    transform: scale(1.1);
  }
  
  .expand-toggle-btn:hover .chevron-icon.rotate-90 {
    transform: rotate(90deg) scale(1.1);
  }
  
  .expand-toggle-btn::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    background: linear-gradient(45deg, #B040FF, #7C3AED);
    border-radius: 8px;
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
    z-index: -1;
  }
  
  .expand-toggle-btn:hover::before {
    opacity: 0.2;
  }
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('recommendation-accordion-styles')) {
  const style = document.createElement('style');
  style.id = 'recommendation-accordion-styles';
  style.textContent = accordionStyles;
  document.head.appendChild(style);
}

interface ActionStep {
  text: string;
  actionType?: 'navigate' | 'external' | 'modal';
  actionData?: any;
}

interface Recommendation {
  title: string;
  description: string;
  impact: string;
  category: string;
  priority: number;
  potentialImprovement?: number;
  actionSteps?: string[];
  status?: 'not-started' | 'in-progress' | 'completed';
  currentGap?: string;
  targetState?: string;
  estimatedTime?: string;
  estimatedCost?: string;
}

interface RecommendationAccordionProps {
  recommendations: Recommendation[];
  onActionClick?: (action: any) => void;
  retirementScore?: number; // To determine if retirement prep center should be shown
}

export function RecommendationAccordion({ 
  recommendations, 
  onActionClick,
  retirementScore 
}: RecommendationAccordionProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'emergency planning': return Umbrella;
      case 'debt management': return TrendingUp;
      case 'retirement planning': return PiggyBank;
      case 'risk management': 
      case 'insurance': return Shield;
      case 'investment strategy': return TrendingUp;
      case 'goal planning': return Target;
      case 'tax planning': return Calculator;
      case 'estate planning': return FileText;
      default: return Lightbulb;
    }
  };

  const getPriorityLabel = (priority: number) => {
    if (priority <= 2) return { label: 'High Priority', color: 'text-red-400', bgColor: 'bg-red-500/20' };
    if (priority <= 3) return { label: 'Medium Priority', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
    return { label: 'Low Priority', color: 'text-green-400', bgColor: 'bg-green-500/20' };
  };

  // Group recommendations by priority
  const highPriority = recommendations.filter(r => r.priority <= 2);
  const mediumPriority = recommendations.filter(r => r.priority === 3);
  const lowPriority = recommendations.filter(r => r.priority > 3);

  const renderRecommendationGroup = (items: Recommendation[], groupTitle: string, groupColor: string) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className={`text-sm font-semibold ${groupColor} mb-3 flex items-center gap-2`}>
          <AlertCircle className="w-4 h-4" />
          {groupTitle} ({items.length})
        </h3>
        <div className="space-y-2">
          {items.map((rec, index) => {
            const globalIndex = recommendations.indexOf(rec);
            const isExpanded = expandedItems.has(globalIndex);
            const Icon = getCategoryIcon(rec.category);
            const priorityInfo = getPriorityLabel(rec.priority);

            return (
              <div 
                key={globalIndex}
                className={`rounded-lg border transition-all duration-200 ${
                  isExpanded 
                    ? 'border-purple-500/50 bg-purple-500/5' 
                    : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                {/* Accordion Header */}
                <button
                  onClick={() => toggleExpanded(globalIndex)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors rounded-t-lg group"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${priorityInfo.bgColor}`}>
                      <Icon className={`w-4 h-4 ${priorityInfo.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-white">
                          {rec.title}
                        </h4>
                      </div>
                      {!isExpanded && (
                        <p className="text-xs mt-1 line-clamp-1 text-gray-400">
                          {rec.currentGap || rec.description}
                        </p>
                      )}
                    </div>
                    {rec.potentialImprovement && (
                      <div className="text-right mr-2">
                        <div className="text-sm font-semibold text-green-400">
                          +{rec.potentialImprovement}
                        </div>
                        <div className="text-xs text-gray-400">points</div>
                      </div>
                    )}
                  </div>
                  <div className="relative expand-toggle-btn h-8 w-8 flex items-center justify-center rounded">
                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-all duration-200 chevron-icon ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-700/50">
                    {/* Status → Gap → Action format */}
                    <div className="mt-4 space-y-3">
                      {/* Current Status */}
                      {rec.currentGap && (
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-400 font-medium">Current Gap</p>
                            <p className="text-sm text-gray-300">{rec.currentGap}</p>
                          </div>
                        </div>
                      )}

                      {/* Target State */}
                      {rec.targetState && (
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-400 font-medium">Target State</p>
                            <p className="text-sm text-gray-300">{rec.targetState}</p>
                          </div>
                        </div>
                      )}

                      {/* Description/Impact */}
                      <div className="bg-gray-700/30 rounded-lg p-3">
                        <p className="text-sm text-gray-300">{rec.description}</p>
                        {rec.impact && (
                          <p className="text-xs text-purple-400 mt-2 font-medium">{rec.impact}</p>
                        )}
                      </div>

                      {/* Action Steps */}
                      {rec.actionSteps && rec.actionSteps.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 font-medium mb-2">Action Steps</p>
                          <ol className="space-y-1.5">
                            {rec.actionSteps.map((step, stepIndex) => (
                              <li key={stepIndex} className="flex items-start gap-2 text-sm text-gray-300">
                                <span className="text-purple-400 font-medium">{stepIndex + 1}.</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        {rec.estimatedTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{rec.estimatedTime}</span>
                          </div>
                        )}
                        {rec.estimatedCost && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            <span>{rec.estimatedCost}</span>
                          </div>
                        )}
                        <div className={`px-2 py-0.5 rounded-full ${priorityInfo.bgColor} ${priorityInfo.color}`}>
                          {priorityInfo.label}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-2">
                        {rec.status !== 'completed' && (
                          <>
                            {/* Estate Planning Center */}
                            {rec.category.toLowerCase() === 'estate planning' && (
                              <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onActionClick?.({
                                    type: 'navigate',
                                    target: 'estate-planning-center',
                                    recommendation: rec
                                  });
                                }}
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                Visit Estate Planning Center
                              </Button>
                            )}
                            
                            {/* Retirement Prep Center */}
                            {(rec.category.toLowerCase() === 'retirement planning' || 
                              rec.title.toLowerCase().includes('retirement') ||
                              (retirementScore && retirementScore < 80 && 
                               (rec.title.toLowerCase().includes('retirement') || 
                                rec.title.toLowerCase().includes('401k') ||
                                rec.title.toLowerCase().includes('ira')))) && (
                              <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onActionClick?.({
                                    type: 'navigate',
                                    target: 'retirement-prep-center',
                                    recommendation: rec
                                  });
                                }}
                              >
                                <PiggyBank className="w-3 h-3 mr-1" />
                                Visit Retirement Planning
                              </Button>
                            )}
                            
                            {/* Tax Strategies Center */}
                            {rec.category.toLowerCase() === 'tax planning' && (
                              <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onActionClick?.({
                                    type: 'navigate',
                                    target: 'tax-strategies-center',
                                    recommendation: rec
                                  });
                                }}
                              >
                                <Calculator className="w-3 h-3 mr-1" />
                                Visit Tax Strategies Center
                              </Button>
                            )}
                            
                            {/* Investment Picks - for portfolio optimization */}
                            {(rec.category.toLowerCase() === 'investment strategy' || 
                              rec.title.toLowerCase().includes('portfolio')) && (
                              <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onActionClick?.({
                                    type: 'navigate',
                                    target: 'investment-picks',
                                    recommendation: rec
                                  });
                                }}
                              >
                                <TrendingUp className="w-3 h-3 mr-1" />
                                View Investment Picks
                              </Button>
                            )}
                            
                            {/* Education Planning Center */}
                            {(rec.category.toLowerCase().includes('education') || 
                              rec.title.toLowerCase().includes('education') ||
                              rec.title.toLowerCase().includes('529')) && (
                              <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onActionClick?.({
                                    type: 'navigate',
                                    target: 'education-planning-center',
                                    recommendation: rec
                                  });
                                }}
                              >
                                <Lightbulb className="w-3 h-3 mr-1" />
                                Visit Education Planning Center
                              </Button>
                            )}
                            
                            {/* Insurance quotes for insurance recommendations */}
                            {(rec.category.toLowerCase() === 'insurance' || 
                              rec.category.toLowerCase() === 'risk management') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-[#B040FF] text-white border-[#B040FF] hover:bg-[#9020FF] hover:border-[#9020FF] hover:shadow-[0_0_20px_rgba(176,64,255,0.5)] transition-all duration-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onActionClick?.({
                                    type: 'external',
                                    url: 'https://www.policygenius.com',
                                    recommendation: rec
                                  });
                                }}
                              >
                                <ExternalLink className="w-3 h-3 mr-1 text-white" />
                                Get Insurance Quotes
                              </Button>
                            )}
                            
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Recommendations by Priority */}
      {renderRecommendationGroup(highPriority, 'High Priority - Address Immediately', 'text-red-400')}
      {renderRecommendationGroup(mediumPriority, 'Medium Priority - Plan This Quarter', 'text-yellow-400')}
      {renderRecommendationGroup(lowPriority, 'Low Priority - Review Annually', 'text-green-400')}

      {/* Footer Note */}
      <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <p className="text-purple-200 text-sm">
          <strong>💡 Pro Tip:</strong> Focus on high-priority insights first. These insights are designed to help improve your financial health and bring you closer to your goals.
        </p>
      </div>
    </div>
  );
}