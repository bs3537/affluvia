import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  DollarSign, 
  Users, 
  Building, 
  FileText,
  AlertCircle,
  Info,
  ArrowRight,
  PlusCircle,
  Edit2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EstatePlan } from '@shared/schema';
import { formatCurrency } from '@/lib/utils';
import { estatePlanningService } from '@/services/estate-planning.service';

interface EstateAnalysis {
  federalExemption: number;
  federalTaxableEstate: number;
  federalEstateTax: number;
  stateExemption: number;
  stateTaxableEstate: number;
  stateEstateTax: number;
  totalEstateTax: number;
  netToHeirs: number;
  effectiveTaxRate: number;
  recommendations: string[];
}

interface EstatePlanWithAnalysis extends EstatePlan {
  analysis?: EstateAnalysis;
}

interface EstateOverviewProps {
  estatePlan: EstatePlanWithAnalysis | null;
}

interface SpouseAssets {
  name: string;
  assets: {
    liquidAssets: number;
    illiquidAssets: number;
    retirementAccounts: number;
    realEstate: number;
    businessInterests: number;
    personalProperty: number;
    liabilities: number;
    total: number;
  };
  federalExemption: number;
  stateExemption: number;
  taxableEstate: number;
  estimatedTax: number;
  netToHeirs: number;
}

export function EstateOverview({ estatePlan }: EstateOverviewProps) {
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const queryClient = useQueryClient();
  
  // Fetch financial profile for estate value calculation
  const { data: profile } = useQuery({
    queryKey: ['/api/financial-profile'],
    queryFn: async () => {
      const response = await fetch('/api/financial-profile', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
  });
  
  // Determine if married
  const isMarried = profile?.maritalStatus === 'married';
  
  // Calculate separate spouse assets
  const calculateSpouseAssets = (): { user: SpouseAssets; spouse?: SpouseAssets } | null => {
    if (!profile) return null;
    
    const assets = Array.isArray(profile.assets) ? profile.assets : [];
    const liabilities = Array.isArray(profile.liabilities) ? profile.liabilities : [];
    
    // For married couples, split assets based on ownership
    // In community property states, typically 50/50
    // For this implementation, we'll use account ownership if specified
    const userAssets = {
      liquidAssets: 0,
      illiquidAssets: 0,
      retirementAccounts: 0,
      realEstate: 0,
      businessInterests: 0,
      personalProperty: 0,
      liabilities: 0,
      total: 0
    };
    
    const spouseAssets = {
      liquidAssets: 0,
      illiquidAssets: 0,
      retirementAccounts: 0,
      realEstate: 0,
      businessInterests: 0,
      personalProperty: 0,
      liabilities: 0,
      total: 0
    };
    
    // Process assets
    assets.forEach((asset: any) => {
      const value = asset.value || 0;
      const ownership = asset.owner || asset.ownership || (isMarried ? 'joint' : 'user');
      
      // Determine asset category
      let category: keyof typeof userAssets = 'liquidAssets';
      if (asset.type === 'retirement') category = 'retirementAccounts';
      else if (asset.type === 'real_estate') category = 'realEstate';
      else if (asset.type === 'business') category = 'businessInterests';
      else if (asset.type === 'personal') category = 'personalProperty';
      else if (asset.type === 'investment') category = 'liquidAssets';
      else if (asset.type === 'other') category = 'illiquidAssets';
      
      // Allocate based on ownership
      if (ownership === 'user' || ownership === 'User') {
        userAssets[category] += value;
      } else if (ownership === 'spouse' || ownership === 'Spouse') {
        spouseAssets[category] += value;
      } else if (ownership === 'joint' || ownership === 'Joint') {
        userAssets[category] += value / 2;
        spouseAssets[category] += value / 2;
      }
    });
    
    // Add primary residence
    if (profile.primaryResidence) {
      const homeEquity = (profile.primaryResidence.marketValue || 0) - (profile.primaryResidence.mortgageBalance || 0);
      if (isMarried) {
        userAssets.realEstate += homeEquity / 2;
        spouseAssets.realEstate += homeEquity / 2;
      } else {
        userAssets.realEstate += homeEquity;
      }
    }
    
    // Process liabilities
    liabilities.forEach((liability: any) => {
      const balance = liability.balance || 0;
      const ownership = liability.owner || liability.ownership || (isMarried ? 'joint' : 'user');
      
      if (ownership === 'user' || ownership === 'User') {
        userAssets.liabilities += balance;
      } else if (ownership === 'spouse' || ownership === 'Spouse') {
        spouseAssets.liabilities += balance;
      } else if (ownership === 'joint' || ownership === 'Joint') {
        userAssets.liabilities += balance / 2;
        spouseAssets.liabilities += balance / 2;
      }
    });
    
    // Calculate totals
    userAssets.total = userAssets.liquidAssets + userAssets.illiquidAssets + 
      userAssets.retirementAccounts + userAssets.realEstate + 
      userAssets.businessInterests + userAssets.personalProperty - userAssets.liabilities;
    
    spouseAssets.total = spouseAssets.liquidAssets + spouseAssets.illiquidAssets + 
      spouseAssets.retirementAccounts + spouseAssets.realEstate + 
      spouseAssets.businessInterests + spouseAssets.personalProperty - spouseAssets.liabilities;
    
    // 2024 Federal exemption: $13.61 million per person
    const federalExemption = 13610000;
    // State exemption varies - using example
    const stateExemption = profile.state === 'NY' ? 6940000 : 0;
    
    const calculateTaxes = (assets: any, exemptions: { federal: number; state: number }) => {
      const taxableEstate = Math.max(0, assets.total - exemptions.federal);
      const federalTax = taxableEstate * 0.4; // 40% federal estate tax rate
      const stateTaxableEstate = Math.max(0, assets.total - exemptions.state);
      const stateTax = stateTaxableEstate * 0.16; // Example state tax rate
      return {
        federalExemption: exemptions.federal,
        stateExemption: exemptions.state,
        taxableEstate: taxableEstate + stateTaxableEstate,
        estimatedTax: federalTax + stateTax,
        netToHeirs: assets.total - federalTax - stateTax
      };
    };
    
    const userTaxes = calculateTaxes(userAssets, { federal: federalExemption, state: stateExemption });
    const spouseTaxes = calculateTaxes(spouseAssets, { federal: federalExemption, state: stateExemption });
    
    const result: { user: SpouseAssets; spouse?: SpouseAssets } = {
      user: {
        name: profile.firstName + ' ' + profile.lastName,
        assets: userAssets,
        ...userTaxes
      }
    };
    
    if (isMarried) {
      result.spouse = {
        name: profile.spouseName || 'Spouse',
        assets: spouseAssets,
        ...spouseTaxes
      };
    }
    
    return result;
  };
  
  const spouseAssets = calculateSpouseAssets();
  
  // Create estate plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async () => {
      if (profile) {
        return await estatePlanningService.createInitialEstatePlanFromProfile(profile);
      }
      throw new Error('No profile data available');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estate-plan'] });
      queryClient.invalidateQueries({ queryKey: ['estate-documents'] });
      queryClient.invalidateQueries({ queryKey: ['estate-beneficiaries'] });
      setShowCreatePlan(false);
    },
  });

  if (!estatePlan && !showCreatePlan) {
    return (
      <div className="text-center py-12">
        <Building className="h-16 w-16 text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">No Estate Plan Found</h3>
        <p className="text-gray-400 mb-6">
          Start creating your estate plan to ensure your assets are distributed according to your wishes.
        </p>
        <Button 
          onClick={() => createPlanMutation.mutate()}
          className="bg-[#8A00C4] hover:bg-[#7000A4]"
          disabled={createPlanMutation.isPending || !profile}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          {createPlanMutation.isPending ? 'Creating...' : 'Create Estate Plan'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Asset Preview - Three Column Layout */}
      {spouseAssets && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Asset Distribution by Ownership</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="grid grid-cols-3 gap-6">
                {/* User Column */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-blue-300 border-b border-gray-600 pb-2">
                    {spouseAssets.user.name}
                  </h4>
                  <div className="space-y-3">
                    {(() => {
                      const userAssets = profile?.assets?.filter((asset: any) => 
                        asset.owner === 'user' || asset.owner === 'User' || (!asset.owner && !isMarried)
                      ) || [];
                      const userLiabilities = profile?.liabilities?.filter((liability: any) => 
                        liability.owner === 'user' || liability.owner === 'User' || (!liability.owner && !isMarried)
                      ) || [];
                      
                      return (
                        <>
                          {userAssets.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-400 mb-2">Assets</p>
                              {userAssets.map((asset: any, idx: number) => (
                                <div key={idx} className="bg-gray-700/30 rounded-lg p-3 mb-2">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className="text-white text-sm font-medium">{asset.description || asset.type}</p>
                                      <p className="text-gray-400 text-xs capitalize">{asset.type}</p>
                                    </div>
                                    <p className="text-green-400 font-medium text-sm">
                                      {formatCurrency(asset.value || 0)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Add primary residence if owned by user */}
                          {profile?.primaryResidence && (!profile.primaryResidence.owner || 
                            profile.primaryResidence.owner === 'user' || 
                            profile.primaryResidence.owner === 'User') && (
                            <div className="bg-gray-700/30 rounded-lg p-3 mb-2">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="text-white text-sm font-medium">Primary Residence</p>
                                  <p className="text-gray-400 text-xs">Real Estate</p>
                                </div>
                                <p className="text-green-400 font-medium text-sm">
                                  {formatCurrency((profile.primaryResidence.marketValue || 0) - (profile.primaryResidence.mortgageBalance || 0))}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {/* Add additional properties owned by user */}
                          {profile?.additionalProperties?.filter((prop: any) => 
                            prop.owner === 'user' || prop.owner === 'User' || (!prop.owner && !isMarried)
                          ).map((prop: any, idx: number) => (
                            <div key={`prop-${idx}`} className="bg-gray-700/30 rounded-lg p-3 mb-2">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="text-white text-sm font-medium">{prop.type || 'Additional Property'}</p>
                                  <p className="text-gray-400 text-xs">Real Estate</p>
                                </div>
                                <p className="text-green-400 font-medium text-sm">
                                  {formatCurrency((prop.marketValue || 0) - (prop.mortgageBalance || 0))}
                                </p>
                              </div>
                            </div>
                          ))}
                          
                          {userLiabilities.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm font-medium text-gray-400 mb-2">Liabilities</p>
                              {userLiabilities.map((liability: any, idx: number) => (
                                <div key={idx} className="bg-gray-700/30 rounded-lg p-3 mb-2">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className="text-white text-sm font-medium">{liability.description || liability.type}</p>
                                      <p className="text-gray-400 text-xs capitalize">{liability.type}</p>
                                    </div>
                                    <p className="text-red-400 font-medium text-sm">
                                      -{formatCurrency(liability.balance || 0)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Spouse Column */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-pink-300 border-b border-gray-600 pb-2">
                    {isMarried ? (spouseAssets.spouse?.name || 'Spouse') : 'Spouse'}
                  </h4>
                  <div className="space-y-3">
                    {isMarried ? (() => {
                      const spouseAssets = profile?.assets?.filter((asset: any) => 
                        asset.owner === 'spouse' || asset.owner === 'Spouse'
                      ) || [];
                      const spouseLiabilities = profile?.liabilities?.filter((liability: any) => 
                        liability.owner === 'spouse' || liability.owner === 'Spouse'
                      ) || [];
                      
                      return (
                        <>
                          {spouseAssets.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-400 mb-2">Assets</p>
                              {spouseAssets.map((asset: any, idx: number) => (
                                <div key={idx} className="bg-gray-700/30 rounded-lg p-3 mb-2">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className="text-white text-sm font-medium">{asset.description || asset.type}</p>
                                      <p className="text-gray-400 text-xs capitalize">{asset.type}</p>
                                    </div>
                                    <p className="text-green-400 font-medium text-sm">
                                      {formatCurrency(asset.value || 0)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Add primary residence if owned by spouse */}
                          {profile?.primaryResidence && (
                            profile.primaryResidence.owner === 'spouse' || 
                            profile.primaryResidence.owner === 'Spouse') && (
                            <div className="bg-gray-700/30 rounded-lg p-3 mb-2">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="text-white text-sm font-medium">Primary Residence</p>
                                  <p className="text-gray-400 text-xs">Real Estate</p>
                                </div>
                                <p className="text-green-400 font-medium text-sm">
                                  {formatCurrency((profile.primaryResidence.marketValue || 0) - (profile.primaryResidence.mortgageBalance || 0))}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {/* Add additional properties owned by spouse */}
                          {profile?.additionalProperties?.filter((prop: any) => 
                            prop.owner === 'spouse' || prop.owner === 'Spouse'
                          ).map((prop: any, idx: number) => (
                            <div key={`spouse-prop-${idx}`} className="bg-gray-700/30 rounded-lg p-3 mb-2">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="text-white text-sm font-medium">{prop.type || 'Additional Property'}</p>
                                  <p className="text-gray-400 text-xs">Real Estate</p>
                                </div>
                                <p className="text-green-400 font-medium text-sm">
                                  {formatCurrency((prop.marketValue || 0) - (prop.mortgageBalance || 0))}
                                </p>
                              </div>
                            </div>
                          ))}
                          
                          {spouseLiabilities.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm font-medium text-gray-400 mb-2">Liabilities</p>
                              {spouseLiabilities.map((liability: any, idx: number) => (
                                <div key={idx} className="bg-gray-700/30 rounded-lg p-3 mb-2">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className="text-white text-sm font-medium">{liability.description || liability.type}</p>
                                      <p className="text-gray-400 text-xs capitalize">{liability.type}</p>
                                    </div>
                                    <p className="text-red-400 font-medium text-sm">
                                      -{formatCurrency(liability.balance || 0)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {spouseAssets.length === 0 && spouseLiabilities.length === 0 && (
                            <p className="text-gray-500 text-sm text-center py-8">No spouse-specific assets</p>
                          )}
                        </>
                      );
                    })() : (
                      <p className="text-gray-500 text-sm text-center py-8">Not applicable</p>
                    )}
                  </div>
                </div>
                
                {/* Joint Column */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-purple-300 border-b border-gray-600 pb-2">
                    Joint
                  </h4>
                  <div className="space-y-3">
                    {(() => {
                      const jointAssets = profile?.assets?.filter((asset: any) => 
                        asset.owner === 'joint' || asset.owner === 'Joint'
                      ) || [];
                      const jointLiabilities = profile?.liabilities?.filter((liability: any) => 
                        liability.owner === 'joint' || liability.owner === 'Joint'
                      ) || [];
                      
                      return (
                        <>
                          {jointAssets.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-400 mb-2">Assets</p>
                              {jointAssets.map((asset: any, idx: number) => (
                                <div key={idx} className="bg-gray-700/30 rounded-lg p-3 mb-2">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className="text-white text-sm font-medium">{asset.description || asset.type}</p>
                                      <p className="text-gray-400 text-xs capitalize">{asset.type}</p>
                                    </div>
                                    <p className="text-green-400 font-medium text-sm">
                                      {formatCurrency(asset.value || 0)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Add primary residence if jointly owned */}
                          {profile?.primaryResidence && (
                            profile.primaryResidence.owner === 'joint' || 
                            profile.primaryResidence.owner === 'Joint' ||
                            (isMarried && !profile.primaryResidence.owner)) && (
                            <div className="bg-gray-700/30 rounded-lg p-3 mb-2">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="text-white text-sm font-medium">Primary Residence</p>
                                  <p className="text-gray-400 text-xs">Real Estate</p>
                                </div>
                                <p className="text-green-400 font-medium text-sm">
                                  {formatCurrency((profile.primaryResidence.marketValue || 0) - (profile.primaryResidence.mortgageBalance || 0))}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {/* Add additional properties jointly owned */}
                          {profile?.additionalProperties?.filter((prop: any) => 
                            prop.owner === 'joint' || prop.owner === 'Joint'
                          ).map((prop: any, idx: number) => (
                            <div key={`joint-prop-${idx}`} className="bg-gray-700/30 rounded-lg p-3 mb-2">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="text-white text-sm font-medium">{prop.type || 'Additional Property'}</p>
                                  <p className="text-gray-400 text-xs">Real Estate</p>
                                </div>
                                <p className="text-green-400 font-medium text-sm">
                                  {formatCurrency((prop.marketValue || 0) - (prop.mortgageBalance || 0))}
                                </p>
                              </div>
                            </div>
                          ))}
                          
                          {jointLiabilities.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm font-medium text-gray-400 mb-2">Liabilities</p>
                              {jointLiabilities.map((liability: any, idx: number) => (
                                <div key={idx} className="bg-gray-700/30 rounded-lg p-3 mb-2">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className="text-white text-sm font-medium">{liability.description || liability.type}</p>
                                      <p className="text-gray-400 text-xs capitalize">{liability.type}</p>
                                    </div>
                                    <p className="text-red-400 font-medium text-sm">
                                      -{formatCurrency(liability.balance || 0)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add joint/unspecified owner financial assets (e.g., brokerage, cash) */}
                          {(() => {
                            const jointFinancialAssets = (profile?.assets || []).filter((asset: any) => 
                              asset.owner === 'joint' || asset.owner === 'Joint' || (isMarried && !asset.owner)
                            );
                            if (jointFinancialAssets.length === 0) return null;
                            return (
                              <div className="mt-3">
                                <p className="text-sm font-medium text-gray-400 mb-2">Financial Assets</p>
                                {jointFinancialAssets.map((asset: any, idx: number) => (
                                  <div key={`joint-asset-${idx}`} className="bg-gray-700/30 rounded-lg p-3 mb-2">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <p className="text-white text-sm font-medium">{asset.description || asset.type || 'Asset'}</p>
                                        <p className="text-gray-400 text-xs capitalize">{asset.type || 'asset'}</p>
                                      </div>
                                      <p className="text-green-400 font-medium text-sm">
                                        {formatCurrency(asset.value || 0)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          
                          {jointAssets.length === 0 && jointLiabilities.length === 0 && (
                            <p className="text-gray-500 text-sm text-center py-8">No joint assets</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
              
              {/* Summary Row */}
              <div className="mt-6 pt-6 border-t border-gray-600">
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm mb-1">Total Value</p>
                    <p className="text-xl font-bold text-blue-300">{formatCurrency(spouseAssets.user.assets.total)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm mb-1">Total Value</p>
                    <p className="text-xl font-bold text-pink-300">
                      {isMarried && spouseAssets.spouse ? formatCurrency(spouseAssets.spouse.assets.total) : '$0'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm mb-1">Combined Joint</p>
                    <p className="text-xl font-bold text-purple-300">
                      {formatCurrency(
                        (profile?.assets?.filter((a: any) => a.owner === 'joint' || a.owner === 'Joint')
                          .reduce((sum: number, a: any) => sum + (a.value || 0), 0) || 0) +
                        ((profile?.primaryResidence && (profile.primaryResidence.owner === 'joint' || 
                          profile.primaryResidence.owner === 'Joint' || (isMarried && !profile.primaryResidence.owner))) ?
                          ((profile.primaryResidence.marketValue || 0) - (profile.primaryResidence.mortgageBalance || 0)) : 0) -
                        (profile?.liabilities?.filter((l: any) => l.owner === 'joint' || l.owner === 'Joint')
                          .reduce((sum: number, l: any) => sum + (l.balance || 0), 0) || 0)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
      )}
    </div>
  );
}
