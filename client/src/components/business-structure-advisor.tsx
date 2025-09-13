import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Shield,
  DollarSign,
  Users,
  Scale,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Building2,
  Briefcase
} from "lucide-react";

interface BusinessStructureAdvisorProps {
  userProfile: any;
}

interface BusinessStructure {
  type: string;
  name: string;
  description: string;
  taxTreatment: string;
  liability: string;
  complexity: 'Low' | 'Medium' | 'High';
  bestFor: string;
  pros: string[];
  cons: string[];
  setupCost: string;
  ongoingCost: string;
  taxBenefits: string[];
}

export function BusinessStructureAdvisor({ userProfile }: BusinessStructureAdvisorProps) {
  const [selectedStructure, setSelectedStructure] = useState<string>('sole_proprietor');
  const [businessGoals, setBusinessGoals] = useState({
    limitLiability: false,
    multipleOwners: false,
    raiseFunding: false,
    taxFlexibility: false,
    simplicity: true
  });
  const [recommendation, setRecommendation] = useState<any>(null);
  
  const queryClient = useQueryClient();

  // Check if user is self-employed and get appropriate income
  const userIsSelfEmployed = userProfile?.employmentStatus === 'self-employed' || 
                             userProfile?.employmentStatus === 'business-owner';
  let selfEmploymentIncome = 0;
  if (userIsSelfEmployed) {
    selfEmploymentIncome = userProfile?.selfEmploymentIncome || userProfile?.annualIncome || 0;
  }
  
  const currentBusinessType = userProfile?.businessType || 'sole_proprietor';
  
  // Fetch saved business structure data
  const { data: businessStructureData } = useQuery({
    queryKey: ['business-structure'],
    queryFn: async () => {
      const response = await fetch('/api/self-employed/business-structure');
      if (!response.ok) {
        throw new Error('Failed to fetch business structure data');
      }
      return response.json();
    }
  });
  
  // Save business structure mutation
  const saveBusinessStructure = useMutation({
    mutationFn: async (data: { businessStructure: string; businessGoals?: any }) => {
      const response = await fetch('/api/self-employed/save-business-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error('Failed to save business structure');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-structure'] });
    }
  });
  
  
  // Load saved data on component mount
  useEffect(() => {
    if (businessStructureData?.businessStructureData) {
      const savedData = businessStructureData.businessStructureData;
      if (savedData.currentStructure) {
        setSelectedStructure(savedData.currentStructure);
      }
      if (savedData.businessGoals) {
        setBusinessGoals(savedData.businessGoals);
      }
      if (savedData.recommendation) {
        setRecommendation(savedData.recommendation);
      }
    }
  }, [businessStructureData]);
  
  // Auto-save when structure changes
  useEffect(() => {
    if (selectedStructure && selectedStructure !== 'sole_proprietor') {
      saveBusinessStructure.mutate({ businessStructure: selectedStructure });
    }
  }, [selectedStructure]);
  
  // Auto-save when business goals change
  useEffect(() => {
    if (Object.values(businessGoals).some(Boolean)) {
      saveBusinessStructure.mutate({ 
        businessStructure: selectedStructure, 
        businessGoals 
      });
    }
  }, [businessGoals]);

  const businessStructures: BusinessStructure[] = [
    {
      type: 'sole_proprietor',
      name: 'Sole Proprietorship',
      description: 'Simplest business structure with no formal entity creation',
      taxTreatment: 'Pass-through taxation on Schedule C',
      liability: 'No liability protection - personal assets at risk',
      complexity: 'Low',
      bestFor: 'Freelancers, consultants, and low-risk businesses',
      pros: [
        'No formation paperwork or fees',
        'Complete control over business',
        'Simple tax filing (Schedule C)',
        'All profits go to owner',
        'Easy to dissolve'
      ],
      cons: [
        'Unlimited personal liability',
        'Harder to raise capital',
        'All income subject to self-employment tax',
        'Business ends if owner dies',
        'Less credibility with some clients'
      ],
      setupCost: '$0-$100',
      ongoingCost: '$0',
      taxBenefits: [
        'Qualified Business Income (QBI) deduction up to 20%',
        'All business expenses deductible',
        'Home office deduction available',
        'No double taxation'
      ]
    },
    {
      type: 'single_llc',
      name: 'Single-Member LLC',
      description: 'Limited liability protection with pass-through taxation',
      taxTreatment: 'Default: Disregarded entity (taxed as sole proprietor). Option to elect S-Corp',
      liability: 'Personal assets protected from business liabilities',
      complexity: 'Low',
      bestFor: 'Solo business owners wanting liability protection',
      pros: [
        'Personal asset protection',
        'Pass-through taxation (no double tax)',
        'Flexibility in management',
        'Can elect S-Corp tax treatment',
        'Professional credibility'
      ],
      cons: [
        'State filing fees required',
        'Annual state fees/taxes',
        'More paperwork than sole proprietorship',
        'Still subject to full SE tax (unless S-Corp election)',
        'May need operating agreement'
      ],
      setupCost: '$100-$800',
      ongoingCost: '$50-$800/year',
      taxBenefits: [
        'QBI deduction available',
        'Option to elect S-Corp for SE tax savings',
        'Business expense deductions',
        'Flexibility in profit distributions'
      ]
    },
    {
      type: 'multi_llc',
      name: 'Multi-Member LLC',
      description: 'LLC with multiple owners, taxed as partnership by default',
      taxTreatment: 'Default: Partnership taxation. Option to elect corporate taxation',
      liability: 'Members protected from business liabilities',
      complexity: 'Medium',
      bestFor: 'Businesses with multiple owners wanting flexibility',
      pros: [
        'Liability protection for all members',
        'Flexible profit sharing',
        'Pass-through taxation',
        'Can add/remove members',
        'Different classes of membership possible'
      ],
      cons: [
        'Complex operating agreement needed',
        'Partnership tax return (Form 1065) required',
        'Potential member disputes',
        'Self-employment tax on active members',
        'More expensive to maintain'
      ],
      setupCost: '$500-$3,000',
      ongoingCost: '$800-$2,500/year',
      taxBenefits: [
        'Pass-through taxation avoids double tax',
        'Special allocations possible',
        'QBI deduction for members',
        'Basis step-up for contributions'
      ]
    },
    {
      type: 's_corp',
      name: 'S Corporation',
      description: 'Corporation electing special tax status to avoid double taxation',
      taxTreatment: 'Pass-through with salary/distribution split',
      liability: 'Shareholders protected from corporate liabilities',
      complexity: 'High',
      bestFor: 'Profitable businesses wanting to minimize self-employment tax',
      pros: [
        'Significant SE tax savings on distributions',
        'Pass-through taxation',
        'Liability protection',
        'Easier to transfer ownership',
        'Professional credibility'
      ],
      cons: [
        'Strict requirements (100 shareholder limit, US citizens only)',
        'Payroll required for owner-employees',
        'Annual corporate formalities',
        'Separate tax return (1120S)',
        'Higher accounting costs'
      ],
      setupCost: '$800-$3,000',
      ongoingCost: '$2,000-$5,000/year',
      taxBenefits: [
        'SE tax savings on distributions',
        'QBI deduction still available',
        'Salary is deductible expense',
        'Pass-through avoids double tax'
      ]
    },
    {
      type: 'c_corp',
      name: 'C Corporation',
      description: 'Traditional corporation with separate legal entity status',
      taxTreatment: 'Double taxation (corporate tax + personal tax on dividends)',
      liability: 'Complete separation between owners and business',
      complexity: 'High',
      bestFor: 'Businesses planning to go public or raise venture capital',
      pros: [
        'Unlimited growth potential',
        'Can raise capital through stock',
        'No restrictions on ownership',
        'Perpetual existence',
        'Best for venture funding'
      ],
      cons: [
        'Double taxation on profits',
        'Complex compliance requirements',
        'Expensive to maintain',
        'Less tax flexibility',
        'Extensive record-keeping'
      ],
      setupCost: '$500-$2,000',
      ongoingCost: '$3,000-$10,000+/year',
      taxBenefits: [
        'Lower corporate tax rate (21%)',
        'More fringe benefit options',
        'No SE tax on dividends',
        'Section 1202 exclusion possible'
      ]
    }
  ];

  const getRecommendedStructure = () => {
    // Use backend recommendation if available
    if (recommendation?.recommendedStructure) {
      return recommendation.recommendedStructure;
    }
    
    // Fallback local logic
    if (selfEmploymentIncome > 100000 && !businessGoals.multipleOwners) {
      return 'single_llc';
    } else if (businessGoals.multipleOwners) {
      return 'multi_llc';
    } else if (businessGoals.raiseFunding) {
      return 'c_corp';
    } else if (businessGoals.simplicity) {
      return selfEmploymentIncome < 50000 ? 'sole_proprietor' : 'single_llc';
    }
    return 'sole_proprietor';
  };

  const recommendedType = getRecommendedStructure();
  const recommendedStructure = businessStructures.find(s => s.type === recommendedType);
  const currentStructure = businessStructures.find(s => s.type === selectedStructure);
  

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Briefcase className="h-5 w-5" />
            Business Structure Advisor
          </CardTitle>
          <CardDescription className="text-gray-400">
            Choose the optimal business structure for tax efficiency and liability protection
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Current Status */}
          <Alert className="mb-6 bg-blue-900/20 border-blue-700">
            <Info className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-gray-300">
              <strong className="text-white">Current Status:</strong> {currentBusinessType === 'sole_proprietor' ? 'Sole Proprietorship' : currentBusinessType}
              <br />
              <strong className="text-white">Annual Income:</strong> ${Math.round(selfEmploymentIncome).toLocaleString()}
            </AlertDescription>
          </Alert>

          {/* Business Structure Selection Form */}
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3 text-white">Select Your Current Business Structure</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="business-structure" className="text-gray-300 mb-2 block">
                  Business Structure
                </Label>
                <Select value={selectedStructure} onValueChange={setSelectedStructure}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Select business structure" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="sole_proprietor" className="text-white hover:bg-gray-700">
                      Sole Proprietorship
                    </SelectItem>
                    <SelectItem value="single_llc" className="text-white hover:bg-gray-700">
                      Single-Member LLC
                    </SelectItem>
                    <SelectItem value="multi_llc" className="text-white hover:bg-gray-700">
                      Multi-Member LLC
                    </SelectItem>
                    <SelectItem value="s_corp" className="text-white hover:bg-gray-700">
                      S Corporation
                    </SelectItem>
                    <SelectItem value="c_corp" className="text-white hover:bg-gray-700">
                      C Corporation
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="annual-income" className="text-gray-300 mb-2 block">
                  Annual Self-Employment Income
                </Label>
                <div className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white">
                  ${Math.round(selfEmploymentIncome).toLocaleString()}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Pulled from your intake form data
                </p>
              </div>
            </div>
          </div>

          {/* Business Goals Assessment */}
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3 text-white">What are your business priorities?</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="liability"
                  checked={businessGoals.limitLiability}
                  onChange={(e) => {
                    const newGoals = { ...businessGoals, limitLiability: e.target.checked };
                    setBusinessGoals(newGoals);
                  }}
                  className="rounded"
                />
                <Label htmlFor="liability" className="cursor-pointer text-gray-300">
                  Protect personal assets from business liabilities
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="owners"
                  checked={businessGoals.multipleOwners}
                  onChange={(e) => {
                    const newGoals = { ...businessGoals, multipleOwners: e.target.checked };
                    setBusinessGoals(newGoals);
                  }}
                  className="rounded"
                />
                <Label htmlFor="owners" className="cursor-pointer text-gray-300">
                  Have or plan to have business partners
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="funding"
                  checked={businessGoals.raiseFunding}
                  onChange={(e) => {
                    const newGoals = { ...businessGoals, raiseFunding: e.target.checked };
                    setBusinessGoals(newGoals);
                  }}
                  className="rounded"
                />
                <Label htmlFor="funding" className="cursor-pointer text-gray-300">
                  Plan to raise venture capital or go public
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="tax"
                  checked={businessGoals.taxFlexibility}
                  onChange={(e) => {
                    const newGoals = { ...businessGoals, taxFlexibility: e.target.checked };
                    setBusinessGoals(newGoals);
                  }}
                  className="rounded"
                />
                <Label htmlFor="tax" className="cursor-pointer text-gray-300">
                  Maximize tax savings opportunities
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="simple"
                  checked={businessGoals.simplicity}
                  onChange={(e) => {
                    const newGoals = { ...businessGoals, simplicity: e.target.checked };
                    setBusinessGoals(newGoals);
                  }}
                  className="rounded"
                />
                <Label htmlFor="simple" className="cursor-pointer text-gray-300">
                  Keep things as simple as possible
                </Label>
              </div>
            </div>
          </div>


          {/* Recommendation */}
          {recommendation && (
            <Alert className="mb-6 bg-green-900/20 border-green-700">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-gray-300">
                <strong className="text-green-400">AI Recommendation: {businessStructures.find(s => s.type === recommendation.recommendedStructure)?.name}</strong>
                <br />
                {recommendation.reasons?.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-white mb-1">Reasons:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {recommendation.reasons.map((reason: string, index: number) => (
                        <li key={index} className="text-sm">{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {recommendation.estimatedSavings > 0 && (
                  <p className="mt-2 text-green-400 font-medium">
                    Estimated Annual Savings: ${Math.round(recommendation.estimatedSavings).toLocaleString()}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          {recommendedStructure && !recommendation && (
            <Alert className="mb-6 bg-green-900/20 border-green-700">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-gray-300">
                <strong className="text-green-400">Quick Recommendation: {recommendedStructure.name}</strong>
                <br />
                {recommendedStructure.bestFor}
              </AlertDescription>
            </Alert>
          )}

          {/* Structure Comparison */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 text-white">Compare Business Structures</h3>
            <RadioGroup value={selectedStructure} onValueChange={setSelectedStructure}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {businessStructures.map((structure) => (
                  <div key={structure.type} className="relative">
                    <div className={`border border-gray-700 rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedStructure === structure.type ? 'border-blue-500 bg-blue-900/20' : 'hover:bg-gray-800/50'
                    }`}>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value={structure.type} id={structure.type} />
                        <div className="flex-1">
                          <Label htmlFor={structure.type} className="cursor-pointer">
                            <div className="font-medium text-white">{structure.name}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {structure.description}
                            </div>
                          </Label>
                        </div>
                        {structure.type === recommendedType && (
                          <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">Recommended</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Comparison */}
      {currentStructure && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">{currentStructure.name} Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Key Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                    <DollarSign className="h-4 w-4" />
                    Tax Treatment
                  </h4>
                  <p className="text-sm text-gray-300">{currentStructure.taxTreatment}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                    <Shield className="h-4 w-4" />
                    Liability Protection
                  </h4>
                  <p className="text-sm text-gray-300">{currentStructure.liability}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                    <Scale className="h-4 w-4" />
                    Complexity Level
                  </h4>
                  <Badge variant={
                    currentStructure.complexity === 'Low' ? 'secondary' :
                    currentStructure.complexity === 'Medium' ? 'default' : 'destructive'
                  }>
                    {currentStructure.complexity}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                    <Users className="h-4 w-4" />
                    Best For
                  </h4>
                  <p className="text-sm text-gray-300">{currentStructure.bestFor}</p>
                </div>
              </div>

              {/* Costs */}
              <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/30">
                <h4 className="font-semibold mb-3 text-white">Estimated Costs</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Setup Cost</p>
                    <p className="font-semibold text-white">{currentStructure.setupCost}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Annual Maintenance</p>
                    <p className="font-semibold text-white">{currentStructure.ongoingCost}</p>
                  </div>
                </div>
              </div>

              {/* Tax Benefits */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  Tax Benefits
                </h4>
                <ul className="space-y-1 text-sm">
                  {currentStructure.taxBenefits.map((benefit, index) => (
                    <li key={index} className="flex gap-2">
                      <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pros and Cons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Advantages
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {currentStructure.pros.map((pro, index) => (
                      <li key={index} className="flex gap-2">
                        <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-300">{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-red-400">
                    <XCircle className="h-4 w-4" />
                    Disadvantages
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {currentStructure.cons.map((con, index) => (
                      <li key={index} className="flex gap-2">
                        <XCircle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-300">{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Items from AI Recommendation */}
              {recommendation?.actionItems?.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                    <AlertCircle className="h-4 w-4 text-blue-400" />
                    Next Steps
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {recommendation.actionItems.map((item: string, index: number) => (
                      <li key={index} className="flex gap-2">
                        <CheckCircle className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Button */}
              <div className="flex gap-3">
                <Button 
                  className="flex-1"
                  onClick={() => window.open('https://www.legalzoom.com', '_blank')}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Form {currentStructure.name} on LegalZoom
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transition Timeline */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">Structure Transition Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert className="bg-blue-900/20 border-blue-700">
              <Info className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-gray-300">
                Based on your income level, here's a typical progression path:
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selfEmploymentIncome < 50000 ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'
                }`}>
                  1
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">$0 - $50,000: Sole Proprietorship</p>
                  <p className="text-sm text-gray-400">Keep it simple while building your business</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selfEmploymentIncome >= 50000 && selfEmploymentIncome < 100000 ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'
                }`}>
                  2
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">$50,000 - $100,000: Single-Member LLC</p>
                  <p className="text-sm text-gray-400">Add liability protection as business grows</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selfEmploymentIncome >= 100000 ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'
                }`}>
                  3
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">$100,000+: LLC with S-Corp Election</p>
                  <p className="text-sm text-gray-400">Optimize for self-employment tax savings</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}