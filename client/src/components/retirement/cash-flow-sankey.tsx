import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ChevronLeft, ChevronRight, TrendingUp, DollarSign, Info } from 'lucide-react';
import { ResponsiveSankey } from '@nivo/sankey';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Badge } from '../ui/badge';

interface CashFlowData {
  year: number;
  age: number;
  spouseAge?: number;
  
  // Income sources
  socialSecurity: number;
  spouseSocialSecurity?: number;
  pension: number;
  spousePension?: number;
  partTimeIncome: number;
  spousePartTimeIncome?: number;
  employmentIncome?: number;
  spouseEmploymentIncome?: number;
  
  // Portfolio withdrawals by account type
  taxableWithdrawal: number;
  taxDeferredWithdrawal: number;
  rothWithdrawal: number;
  
  // Expenses
  livingExpenses: number;
  healthcare: number;
  housing: number;
  insurance: number;
  discretionary: number;
  debt: number;
  
  // Taxes
  federalTax: number;
  stateTax: number;
  ficaTax: number;
  
  // Savings/Deficit
  netCashFlow: number;
  
  // Portfolio balances for context
  portfolioBalance: number;
}

interface RetirementCashFlowSankeyProps {
  data: CashFlowData[];
  retirementAge: number;
  currentAge: number;
  isOptimized?: boolean;
}

export function RetirementCashFlowSankey({
  data,
  retirementAge,
  currentAge,
  isOptimized = false
}: RetirementCashFlowSankeyProps) {
  // Initialize to first year with data
  const [selectedYearIndex, setSelectedYearIndex] = useState(0);
    
  if (!data || data.length === 0) return null;
  
  const yearData = data[selectedYearIndex];
  
  if (!yearData) return null;
  
  // Format currency for display
  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      return `$${Math.round(value / 1000)}K`;
    }
    return `$${Math.round(value)}`;
  };
  
  // Create Sankey data structure
  const sankeyData = useMemo(() => {
    if (!yearData) return { nodes: [], links: [] };
    
    const nodes: any[] = [];
    const links: any[] = [];
    
    // Income source nodes (left side)
    const incomeNodes = [
      { id: 'employment', label: 'Employment Income', value: (yearData.employmentIncome || 0) + (yearData.spouseEmploymentIncome || 0) },
      { id: 'social-security', label: 'Social Security', value: yearData.socialSecurity + (yearData.spouseSocialSecurity || 0) },
      { id: 'pension', label: 'Pension', value: yearData.pension + (yearData.spousePension || 0) },
      { id: 'part-time', label: 'Part-Time Income', value: yearData.partTimeIncome + (yearData.spousePartTimeIncome || 0) },
      { id: 'taxable-withdrawal', label: 'Taxable Accounts', value: yearData.taxableWithdrawal },
      { id: 'tax-deferred-withdrawal', label: '401k/IRA', value: yearData.taxDeferredWithdrawal },
      { id: 'roth-withdrawal', label: 'Roth IRA', value: yearData.rothWithdrawal },
    ].filter(n => n.value > 0);
    
    // Calculate total income from all sources
    const totalIncome = incomeNodes.reduce((sum, node) => sum + node.value, 0);
    
    // Expense nodes (right side)
    const expenseNodes = [
      { id: 'living-expenses', label: 'Living Expenses', value: yearData.livingExpenses },
      { id: 'healthcare', label: 'Healthcare', value: yearData.healthcare },
      { id: 'housing', label: 'Housing', value: yearData.housing },
      { id: 'insurance', label: 'Insurance', value: yearData.insurance },
      { id: 'discretionary', label: 'Discretionary', value: yearData.discretionary },
      { id: 'debt', label: 'Debt Payments', value: yearData.debt },
      { id: 'federal-tax', label: 'Federal Tax', value: yearData.federalTax },
      { id: 'state-tax', label: 'State Tax', value: yearData.stateTax },
      { id: 'fica-tax', label: 'FICA Tax', value: yearData.ficaTax },
    ].filter(n => n.value > 0);
    
    // Calculate total expenses
    const totalExpenses = expenseNodes.reduce((sum, node) => sum + node.value, 0);
    
    // Calculate actual savings (total income minus total expenses)
    const actualSavings = totalIncome - totalExpenses;
    
    // Only show savings if positive (typically happens after age 73 with RMDs)
    if (actualSavings > 0) {
      expenseNodes.push({ id: 'savings', label: 'Savings', value: actualSavings });
    }
    
    // Create nodes array for Sankey
    incomeNodes.forEach(node => {
      nodes.push({
        id: node.id,
        label: node.label,
        color: getNodeColor(node.id, 'income')
      });
    });
    
    // Add central "Total Income" node with lighter green
    nodes.push({
      id: 'total-income',
      label: 'Total Income',
      color: '#86EFAC'  // green-300 - lighter green for income
    });
    
    expenseNodes.forEach(node => {
      nodes.push({
        id: node.id,
        label: node.label,
        color: getNodeColor(node.id, 'expense')
      });
    });
    
    // Create links from income sources to total
    incomeNodes.forEach(node => {
      links.push({
        source: node.id,
        target: 'total-income',
        value: node.value,
        color: getNodeColor(node.id, 'income')
      });
    });
    
    // Create links from total to expenses
    expenseNodes.forEach(node => {
      links.push({
        source: 'total-income',
        target: node.id,
        value: node.value,
        color: getNodeColor(node.id, 'expense')
      });
    });
    
    return { nodes, links };
  }, [yearData]);
  
  // Get color for each node type - Lighter gradients of green for income, red for expenses
  function getNodeColor(nodeId: string, type: 'income' | 'expense'): string {
    if (type === 'income') {
      // All income sources in lighter shades of green with gradient effect
      switch (nodeId) {
        case 'employment': return '#86EFAC'; // green-300
        case 'social-security': return '#BBF7D0'; // green-200
        case 'pension': return '#A7F3D0'; // emerald-200
        case 'part-time': return '#BEF264'; // lime-300
        case 'taxable-withdrawal': return '#6EE7B7'; // emerald-300
        case 'tax-deferred-withdrawal': return '#86EFAC'; // green-300
        case 'roth-withdrawal': return '#34D399'; // emerald-400
        default: return '#BBF7D0'; // green-200
      }
    } else {
      // All expenses in lighter shades of red/rose with gradient effect
      switch (nodeId) {
        case 'living-expenses': return '#FCA5A5'; // red-300
        case 'healthcare': return '#FECACA'; // red-200
        case 'housing': return '#FEE2E2'; // red-100
        case 'insurance': return '#FECDD3'; // rose-200
        case 'discretionary': return '#FED7E2'; // pink-200
        case 'debt': return '#FB7185'; // rose-400
        case 'federal-tax': return '#F87171'; // red-400
        case 'state-tax': return '#FCA5A5'; // red-300
        case 'fica-tax': return '#FECACA'; // red-200
        case 'savings': return '#BBF7D0'; // green-200 (savings is positive)
        default: return '#FECACA'; // red-200
      }
    }
  }
  
  
  return (
    <div className="space-y-4">
      {/* Header with info tooltip */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Cash Flow Visualization</h3>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Info className="w-4 h-4 text-gray-400" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 border-gray-700 max-w-xs">
              <p className="text-sm">
                This diagram shows the flow of money in retirement. 
                Income sources on the left flow to expenses on the right. 
                Width represents the relative amount of each flow.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {/* Year navigation with dropdown */}
      <div className="flex items-center justify-center bg-gray-800/50 rounded-lg p-3">
        <Select 
          value={selectedYearIndex.toString()} 
          onValueChange={(value) => setSelectedYearIndex(parseInt(value))}
        >
          <SelectTrigger className="w-[250px] bg-gray-900/50 border-gray-700 text-white">
            <SelectValue>
              Year {yearData.year} - Age {yearData.age}{yearData.spouseAge ? ` / ${yearData.spouseAge}` : ''}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700 max-h-[300px] overflow-y-auto">
            {data.map((item, index) => (
              <SelectItem 
                key={index} 
                value={index.toString()}
                className="text-gray-300 hover:bg-gray-700 focus:bg-gray-700"
              >
                Year {item.year} - Age {item.age}{item.spouseAge ? ` / ${item.spouseAge}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      
      {/* Sankey diagram */}
      <Card className="bg-gray-900/50 border-gray-700">
        <CardContent className="p-6">
          <div style={{ height: '500px' }}>
            <ResponsiveSankey
              data={sankeyData}
              margin={{ top: 20, right: 160, bottom: 20, left: 160 }}
              align="justify"
              colors={(node: any) => node.color}
              nodeOpacity={1}
              nodeHoverOpacity={1}
              nodeThickness={24}
              nodeInnerPadding={3}
              nodeSpacing={24}
              nodeBorderWidth={0}
              nodeBorderColor="transparent"
              linkOpacity={0.6}
              linkHoverOpacity={0.85}
              linkContract={3}
              linkBlendMode="normal"
              enableLinkGradient={true}
              labelPosition="outside"
              labelOrientation="horizontal"
              labelPadding={16}
              labelTextColor="#E5E7EB"
              animate={true}
              motionConfig="gentle"
              theme={{
                background: 'transparent',
                textColor: '#E5E7EB',
                fontSize: 12,
                axis: {
                  domain: {
                    line: {
                      stroke: '#374151',
                      strokeWidth: 1
                    }
                  },
                  legend: {
                    text: {
                      fontSize: 12,
                      fill: '#E5E7EB'
                    }
                  },
                  ticks: {
                    line: {
                      stroke: '#374151',
                      strokeWidth: 1
                    },
                    text: {
                      fontSize: 11,
                      fill: '#E5E7EB'
                    }
                  }
                },
                grid: {
                  line: {
                    stroke: '#374151',
                    strokeWidth: 1
                  }
                }
              }}
              nodeTooltip={({ node }) => (
                <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-600 text-white p-4 rounded-lg shadow-xl max-w-xs">
                  <div className="font-semibold text-gray-300 text-sm mb-1">{node.label}</div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(node.value)}</div>
                  <div className="text-xs text-gray-400 mt-2">
                    {node.id.includes('withdrawal') ? 'Portfolio withdrawal' : 
                     node.id.includes('tax') ? 'Tax payment' :
                     node.id.includes('expense') ? 'Expense' : 'Income'}
                  </div>
                </div>
              )}
              linkTooltip={({ link }) => (
                <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-600 text-white p-4 rounded-lg shadow-xl max-w-xs">
                  <div className="text-sm text-gray-300 mb-2">
                    <span className="font-semibold">{link.source.label}</span>
                    <span className="mx-2 text-gray-400">→</span>
                    <span className="font-semibold">{link.target.label}</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{formatCurrency(link.value)}</div>
                  <div className="text-xs text-gray-400">Cash flow</div>
                </div>
              )}
            />
          </div>
          
          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Income Sources</h4>
                <div className="space-y-1">
                  {sankeyData.nodes
                    .filter(n => ['employment', 'social-security', 'pension', 'part-time', 'taxable-withdrawal', 'tax-deferred-withdrawal', 'roth-withdrawal'].includes(n.id))
                    .map(node => (
                      <div key={node.id} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: node.color }}></div>
                        <span className="text-gray-300">{node.label}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Expenses & Taxes</h4>
                <div className="space-y-1">
                  {sankeyData.nodes
                    .filter(n => !['employment', 'social-security', 'pension', 'part-time', 'taxable-withdrawal', 'tax-deferred-withdrawal', 'roth-withdrawal', 'total-income'].includes(n.id))
                    .map(node => (
                      <div key={node.id} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: node.color }}></div>
                        <span className="text-gray-300">{node.label}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
          
        </CardContent>
      </Card>
    </div>
  );
}