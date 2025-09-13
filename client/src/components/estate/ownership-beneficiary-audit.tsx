import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Users, 
  AlertCircle, 
  CheckCircle,
  XCircle,
  Edit2,
  RefreshCw,
  Shield,
  FileText,
  Info,
  Download,
  Upload,
  Plus,
  Trash2,
  Save
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface OwnershipBeneficiaryAuditProps {
  estatePlanId?: number;
}

interface AssetOwnership {
  assetId: string;
  description: string;
  type: string;
  value: number;
  currentOwnership: 'individual' | 'joint-ros' | 'tenancy-entirety' | 'trust' | 'community';
  recommendedOwnership?: string;
  ownershipIssue?: string;
  probateExposure: boolean;
  hasBeneficiary?: boolean;
  beneficiaryName?: string;
  canHaveBeneficiary?: boolean;
}

interface BeneficiaryDesignation {
  accountId: string;
  accountType: 'IRA' | '401k' | 'Life Insurance' | 'HSA' | '529' | 'TOD' | 'POD';
  accountName: string;
  value: number;
  primaryBeneficiaries: {
    name: string;
    ssn?: string;
    percentage: number;
    relationship: string;
  }[];
  contingentBeneficiaries: {
    name: string;
    ssn?: string;
    percentage: number;
    relationship: string;
  }[];
  lastUpdated?: Date;
  issues?: string[];
}

interface BeneficiaryFormData {
  primary: {
    name: string;
    ssn?: string;
    percentage: number;
    relationship: string;
  }[];
  contingent: {
    name: string;
    ssn?: string;
    percentage: number;
    relationship: string;
  }[];
}

export function OwnershipBeneficiaryAudit({ estatePlanId }: OwnershipBeneficiaryAuditProps) {
  const [showBeneficiaryModal, setShowBeneficiaryModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BeneficiaryDesignation | null>(null);
  const [beneficiaryForm, setBeneficiaryForm] = useState<BeneficiaryFormData>({
    primary: [],
    contingent: []
  });
  const [assetBeneficiaries, setAssetBeneficiaries] = useState<Record<string, {hasBeneficiary: boolean; beneficiaryName: string}>>(() => {
    const saved = localStorage.getItem('asset-beneficiaries');
    return saved ? JSON.parse(saved) : {};
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch financial profile
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
  
  // Save asset beneficiary info
  const saveAssetBeneficiary = (assetId: string, hasBeneficiary: boolean, beneficiaryName: string) => {
    const updated = {
      ...assetBeneficiaries,
      [assetId]: { hasBeneficiary, beneficiaryName }
    };
    setAssetBeneficiaries(updated);
    localStorage.setItem('asset-beneficiaries', JSON.stringify(updated));
    // Force re-render by invalidating queries
    queryClient.invalidateQueries({ queryKey: ['/api/financial-profile'] });
  };
  
  // Analyze asset ownership
  const analyzeOwnership = (): AssetOwnership[] => {
    if (!profile) return [];
    
    const ownership: AssetOwnership[] = [];
    const isMarried = profile.maritalStatus === 'married';
    
    // Analyze regular assets
    profile.assets?.forEach((asset: any, idx: number) => {
      const assetId = `asset-${asset.id ?? idx}`;   // stable across renders
      const currentOwnership = determineOwnershipType(asset.owner, isMarried);
      const analysis = analyzeAssetOwnership(asset, currentOwnership, isMarried, assetId);
      const beneficiaryInfo = assetBeneficiaries[assetId] || { hasBeneficiary: false, beneficiaryName: '' };
      
      ownership.push({
        assetId,
        description: asset.description || asset.type,
        type: asset.type,
        value: asset.value || 0,
        currentOwnership,
        recommendedOwnership: analysis.recommended,
        ownershipIssue: analysis.issue,
        probateExposure: analysis.probateExposure,
        hasBeneficiary: beneficiaryInfo.hasBeneficiary,
        beneficiaryName: beneficiaryInfo.beneficiaryName,
        canHaveBeneficiary: analysis.canHaveBeneficiary
      });
    });
    
    // Analyze primary residence
    if (profile.primaryResidence) {
      const assetId = 'primary-residence';
      const currentOwnership = determineOwnershipType(profile.primaryResidence.owner, isMarried);
      const analysis = analyzeAssetOwnership(
        { type: 'real_estate', value: profile.primaryResidence.marketValue - profile.primaryResidence.mortgageBalance },
        currentOwnership,
        isMarried,
        assetId
      );
      const beneficiaryInfo = assetBeneficiaries[assetId] || { hasBeneficiary: false, beneficiaryName: '' };
      
      ownership.push({
        assetId,
        description: 'Primary Residence',
        type: 'real_estate',
        value: profile.primaryResidence.marketValue - profile.primaryResidence.mortgageBalance,
        currentOwnership,
        recommendedOwnership: analysis.recommended,
        ownershipIssue: analysis.issue,
        probateExposure: analysis.probateExposure,
        hasBeneficiary: beneficiaryInfo.hasBeneficiary,
        beneficiaryName: beneficiaryInfo.beneficiaryName,
        canHaveBeneficiary: analysis.canHaveBeneficiary
      });
    }
    
    return ownership;
  };
  
  // Determine ownership type from owner field
  const determineOwnershipType = (owner: string | undefined, isMarried: boolean): AssetOwnership['currentOwnership'] => {
    if (!owner) return isMarried ? 'joint-ros' : 'individual';
    
    const ownerLower = owner.toLowerCase();
    if (ownerLower.includes('trust')) return 'trust';
    if (ownerLower === 'joint' || ownerLower === 'both') return isMarried ? 'tenancy-entirety' : 'joint-ros';
    if (ownerLower === 'user' || ownerLower === 'spouse') return 'individual';
    
    return 'individual';
  };
  
  // Analyze asset ownership and provide recommendations
  const analyzeAssetOwnership = (asset: any, current: AssetOwnership['currentOwnership'], isMarried: boolean, assetId: string) => {
    let recommended = current;
    let issue = undefined;
    let probateExposure = true;
    let canHaveBeneficiary = false;
    
    // Trust ownership avoids probate
    if (current === 'trust') {
      probateExposure = false;
    }
    
    // Real estate recommendations - always recommend trust for probate avoidance
    if (asset.type === 'real_estate') {
      canHaveBeneficiary = true; // Can use TOD deed in many states
      if (current !== 'trust') {
        recommended = 'trust';
        probateExposure = true;
        
        if (isMarried && current === 'individual') {
          issue = 'Consider trust ownership or tenancy by entirety. Trust avoids probate for both spouses';
        } else if (isMarried && (current === 'joint-ros' || current === 'tenancy-entirety')) {
          issue = 'Joint ownership only avoids probate at first death. Consider trust for complete probate avoidance';
        } else if (!isMarried) {
          issue = 'Real estate will go through probate. Consider trust ownership or transfer-on-death deed';
        }
      }
    }
    
    // Investment account recommendations - especially for taxable brokerage
    if (asset.type === 'investment' || asset.description?.toLowerCase().includes('brokerage')) {
      canHaveBeneficiary = true; // Can use TOD
      
      // Check if account has beneficiary
      const beneficiaryInfo = assetBeneficiaries[assetId] || { hasBeneficiary: false };
      
      if (current !== 'trust' && !beneficiaryInfo.hasBeneficiary) {
        probateExposure = true;
        
        // Taxable brokerage specific recommendations
        if (asset.description?.toLowerCase().includes('brokerage') || 
            asset.description?.toLowerCase().includes('taxable')) {
          issue = 'Taxable brokerage account needs TOD beneficiary to avoid probate. Without TOD, assets will go through probate';
          recommended = 'individual'; // Keep individual but add TOD
        } else if (asset.value > 100000) {
          issue = 'High-value investment account should have TOD beneficiary or trust ownership for probate avoidance';
        } else {
          issue = 'Add TOD (Transfer on Death) beneficiary to avoid probate';
        }
      } else if (current !== 'trust' && beneficiaryInfo.hasBeneficiary) {
        probateExposure = false; // TOD avoids probate
        issue = undefined; // No issue if has beneficiary
      }
    }
    
    // Bank accounts
    if (asset.type === 'cash' || asset.type === 'savings' || asset.type === 'checking') {
      canHaveBeneficiary = true; // Can use POD
      if (current !== 'trust') {
        issue = 'Consider POD (Payable on Death) beneficiary designation to avoid probate';
        probateExposure = true;
      }
    }
    
    // Retirement accounts should have beneficiaries, not be in trust
    if (asset.type === 'retirement') {
      canHaveBeneficiary = true;
      if (current === 'trust') {
        recommended = 'individual';
        issue = 'Retirement accounts should use beneficiary designations, not trust ownership';
      } else {
        probateExposure = false; // Retirement accounts with beneficiaries bypass probate
        issue = 'Ensure beneficiary designations are current (see Beneficiary Sweep tab)';
      }
    }
    
    // Life insurance
    if (asset.type === 'life_insurance') {
      canHaveBeneficiary = true;
      probateExposure = false; // Life insurance with beneficiaries bypasses probate
    }
    
    // Joint ownership without right of survivorship is problematic
    if (current === 'joint-ros' && !isMarried) {
      issue = 'Joint ownership with non-spouse requires careful planning and may have gift tax implications';
    }
    
    // Bank accounts (checking, savings, CDs)
    if (asset.type === 'cash' || asset.type === 'savings') {
      canHaveBeneficiary = true; // Can use POD
      const beneficiaryInfo = assetBeneficiaries[assetId] || { hasBeneficiary: false };
      
      if (current === 'individual' && !beneficiaryInfo.hasBeneficiary) {
        probateExposure = true;
        issue = 'Add POD (Payable on Death) beneficiary to avoid probate';
        recommended = 'individual'; // Keep individual but add POD
      } else if (current === 'individual' && beneficiaryInfo.hasBeneficiary) {
        probateExposure = false; // POD avoids probate
        issue = undefined;
      } else if (current === 'joint-ros' || current === 'tenancy-entirety') {
        probateExposure = false; // Joint ownership avoids probate at first death
        issue = undefined;
      }
    }
    
    // Retirement accounts (401k, IRA, etc)
    if (asset.type === 'retirement') {
      canHaveBeneficiary = true; // Must have beneficiaries
      const beneficiaryInfo = assetBeneficiaries[assetId] || { hasBeneficiary: false };
      
      if (!beneficiaryInfo.hasBeneficiary) {
        probateExposure = true;
        issue = 'Update beneficiary designation - retirement accounts without beneficiaries go through probate';
      } else {
        probateExposure = false;
        issue = undefined;
      }
      recommended = 'individual'; // Retirement accounts should always be individual
    }
    
    return { recommended, issue, probateExposure, canHaveBeneficiary };
  };
  
  // Load saved beneficiaries from localStorage
  const loadSavedBeneficiaries = () => {
    const saved = localStorage.getItem('estate-beneficiaries');
    return saved ? JSON.parse(saved) : {};
  };
  
  // Save beneficiaries to localStorage
  const saveBeneficiaries = (accountId: string, beneficiaries: BeneficiaryFormData) => {
    const saved = loadSavedBeneficiaries();
    saved[accountId] = {
      ...beneficiaries,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('estate-beneficiaries', JSON.stringify(saved));
  };
  
  // Get beneficiary designations with saved data
  const getBeneficiaryDesignations = (): BeneficiaryDesignation[] => {
    const designations: BeneficiaryDesignation[] = [];
    const savedBeneficiaries = loadSavedBeneficiaries();
    
    // Check retirement accounts
    profile?.assets?.forEach((asset: any, idx: number) => {
      if (asset.type === 'retirement') {
        const accountId = `ret-${asset.id ?? idx}`;
        const saved = savedBeneficiaries[accountId];
        
        designations.push({
          accountId,
          accountType: asset.description?.includes('401') ? '401k' : 'IRA',
          accountName: asset.description || 'Retirement Account',
          value: asset.value || 0,
          primaryBeneficiaries: saved?.primary || [],
          contingentBeneficiaries: saved?.contingent || [],
          lastUpdated: saved?.lastUpdated ? new Date(saved.lastUpdated) : undefined,
          issues: validateBeneficiaries(saved?.primary, saved?.contingent)
        });
      }
    });
    
    // Add life insurance if exists
    if (profile?.lifeInsurance?.hasPolicy) {
      const accountId = 'life-ins-1';
      const saved = savedBeneficiaries[accountId];
      
      designations.push({
        accountId,
        accountType: 'Life Insurance',
        accountName: 'Life Insurance Policy',
        value: profile.lifeInsurance.coverageAmount || 0,
        primaryBeneficiaries: saved?.primary || [],
        contingentBeneficiaries: saved?.contingent || [],
        lastUpdated: saved?.lastUpdated ? new Date(saved.lastUpdated) : undefined,
        issues: validateBeneficiaries(saved?.primary, saved?.contingent)
      });
    }
    
    // Add HSA if exists
    profile?.assets?.forEach((asset: any, idx: number) => {
      if (asset.type === 'hsa' || asset.description?.toLowerCase().includes('hsa')) {
        const accountId = `hsa-${asset.id ?? idx}`;
        const saved = savedBeneficiaries[accountId];
        
        designations.push({
          accountId,
          accountType: 'HSA',
          accountName: asset.description || 'Health Savings Account',
          value: asset.value || 0,
          primaryBeneficiaries: saved?.primary || [],
          contingentBeneficiaries: saved?.contingent || [],
          lastUpdated: saved?.lastUpdated ? new Date(saved.lastUpdated) : undefined,
          issues: validateBeneficiaries(saved?.primary, saved?.contingent)
        });
      }
    });
    
    return designations;
  };
  
  // Validate beneficiary data
  const validateBeneficiaries = (primary?: any[], contingent?: any[]): string[] => {
    const issues: string[] = [];
    
    if (!primary || primary.length === 0) {
      issues.push('No primary beneficiary designated');
    } else {
      const primaryTotal = primary.reduce((sum: number, b: any) => sum + (b.percentage || 0), 0);
      if (primaryTotal !== 100) {
        issues.push(`Primary beneficiary percentages total ${primaryTotal}% (should be 100%)`);
      }
    }
    
    if (contingent && contingent.length > 0) {
      const contingentTotal = contingent.reduce((sum: number, b: any) => sum + (b.percentage || 0), 0);
      if (contingentTotal !== 100) {
        issues.push(`Contingent beneficiary percentages total ${contingentTotal}% (should be 100%)`);
      }
    }
    
    return issues;
  };
  
  // Handle opening the update modal
  const handleUpdateBeneficiaries = (account: BeneficiaryDesignation) => {
    console.log('Update beneficiaries clicked for:', account);
    setSelectedAccount(account);
    setBeneficiaryForm({
      primary: account.primaryBeneficiaries.map(b => ({ ...b })),
      contingent: account.contingentBeneficiaries.map(b => ({ ...b }))
    });
    setShowBeneficiaryModal(true);
  };
  
  // Add beneficiary
  const addBeneficiary = (type: 'primary' | 'contingent') => {
    setBeneficiaryForm(prev => ({
      ...prev,
      [type]: [...prev[type], { name: '', percentage: 0, relationship: '' }]
    }));
  };
  
  // Remove beneficiary
  const removeBeneficiary = (type: 'primary' | 'contingent', index: number) => {
    setBeneficiaryForm(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };
  
  // Update beneficiary field
  const updateBeneficiary = (type: 'primary' | 'contingent', index: number, field: string, value: any) => {
    setBeneficiaryForm(prev => ({
      ...prev,
      [type]: prev[type].map((b, i) => i === index ? { ...b, [field]: value } : b)
    }));
  };
  
  // Save beneficiary updates
  const handleSaveBeneficiaries = () => {
    if (!selectedAccount) return;
    
    // Validate percentages
    const primaryTotal = beneficiaryForm.primary.reduce((sum, b) => sum + Number(b.percentage), 0);
    const contingentTotal = beneficiaryForm.contingent.reduce((sum, b) => sum + Number(b.percentage), 0);
    
    if (beneficiaryForm.primary.length > 0 && primaryTotal !== 100) {
      toast({
        title: "Invalid Primary Beneficiaries",
        description: `Percentages must total 100% (currently ${primaryTotal}%)`,
        variant: "destructive"
      });
      return;
    }
    
    if (beneficiaryForm.contingent.length > 0 && contingentTotal !== 100) {
      toast({
        title: "Invalid Contingent Beneficiaries",
        description: `Percentages must total 100% (currently ${contingentTotal}%)`,
        variant: "destructive"
      });
      return;
    }
    
    // Save to localStorage
    saveBeneficiaries(selectedAccount.accountId, beneficiaryForm);
    
    // Show success message
    toast({
      title: "Beneficiaries Updated",
      description: "Your beneficiary designations have been saved.",
    });
    
    // Close modal and refresh
    setShowBeneficiaryModal(false);
    queryClient.invalidateQueries();
  };
  
  const ownershipData = analyzeOwnership();
  const beneficiaryData = getBeneficiaryDesignations();
  
  // Calculate audit scores
  const ownershipScore = Math.round(
    (ownershipData.filter(a => !a.ownershipIssue).length / Math.max(ownershipData.length, 1)) * 100
  );
  const beneficiaryScore = Math.round(
    (beneficiaryData.filter(b => !b.issues?.length).length / Math.max(beneficiaryData.length, 1)) * 100
  );
  
  return (
    <div className="space-y-6">
      {/* CFP Compliance Header */}
      <Alert className="bg-blue-900/20 border-blue-800">
        <Shield className="h-4 w-4 text-blue-300" />
        <AlertDescription className="text-gray-300">
          <strong>CFP Board Step 3 - Analyze:</strong> This audit evaluates titling, probate exposure, 
          and beneficiary designations per CFP Practice Standards. Recommendations should be reviewed 
          with qualified legal counsel.
        </AlertDescription>
      </Alert>
      
      
      {/* Ownership Audit Section */}
      <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-white">Asset Ownership Analysis</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Ownership Score</p>
                    <p className="text-2xl font-bold text-white">{ownershipScore}%</p>
                  </div>
                  <Progress value={ownershipScore} className="w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ownershipData.map((asset) => (
                  <div key={asset.assetId} className="bg-gray-700/30 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-white font-medium">{asset.description}</h4>
                        <p className="text-sm text-gray-400 capitalize">{asset.type}</p>
                      </div>
                      <p className="text-white font-medium">{formatCurrency(asset.value)}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Current Ownership</p>
                        <Badge variant={asset.currentOwnership === 'trust' ? 'default' : 'secondary'}>
                          {asset.currentOwnership}
                        </Badge>
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Probate Exposure</p>
                        {asset.probateExposure && !(asset.canHaveBeneficiary && assetBeneficiaries[asset.assetId]?.hasBeneficiary) ? (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <XCircle className="h-3 w-3" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="default" className="flex items-center gap-1 w-fit bg-green-600">
                            <CheckCircle className="h-3 w-3" />
                            No
                          </Badge>
                        )}
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Status</p>
                        {asset.ownershipIssue ? (
                          <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                            Review Needed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-400 border-green-400">
                            Optimal
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {asset.ownershipIssue && (
                      <Alert className="mt-3 bg-yellow-900/20 border-yellow-800">
                        <AlertCircle className="h-4 w-4 text-yellow-400" />
                        <AlertDescription className="text-sm text-gray-300">
                          {asset.ownershipIssue}
                          {asset.recommendedOwnership !== asset.currentOwnership && (
                            <span className="block mt-1">
                              Recommended: <strong>{asset.recommendedOwnership}</strong>
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {asset.canHaveBeneficiary && (
                      <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`beneficiary-${asset.assetId}`}
                              checked={assetBeneficiaries[asset.assetId]?.hasBeneficiary ?? false}
                              onCheckedChange={(checked) => {
                                const isChecked = checked === true;        // radix returns true | false | "indeterminate"
                                const currentName = assetBeneficiaries[asset.assetId]?.beneficiaryName || '';
                                saveAssetBeneficiary(asset.assetId, isChecked, currentName);
                              }}
                              className="border-gray-600 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                            />
                            <label 
                              htmlFor={`beneficiary-${asset.assetId}`} 
                              className="text-sm text-gray-300 font-medium cursor-pointer select-none"
                            >
                              Beneficiary Designated
                            </label>
                            {assetBeneficiaries[asset.assetId]?.hasBeneficiary && (
                              <Input
                                id={`beneficiary-name-${asset.assetId}`}
                                type="text"
                                placeholder="e.g., John Doe (Primary)"
                                value={assetBeneficiaries[asset.assetId]?.beneficiaryName || ''}
                                onChange={(e) =>
                                  saveAssetBeneficiary(asset.assetId, true, e.target.value)
                                }
                                className="ml-4 h-8 text-sm bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                              />
                            )}
                          </div>
                          {assetBeneficiaries[asset.assetId]?.hasBeneficiary && (
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Summary Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Card className="bg-gray-700/30 border-gray-600">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-400">Assets in Trust</p>
                    <p className="text-2xl font-bold text-white">
                      {ownershipData.filter(a => a.currentOwnership === 'trust').length}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-700/30 border-gray-600">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-400">Probate Exposure</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {formatCurrency(
                        ownershipData
                          .filter(a => a.probateExposure && !(a.canHaveBeneficiary && assetBeneficiaries[a.assetId]?.hasBeneficiary))
                          .reduce((sum, a) => sum + a.value, 0)
                      )}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-700/30 border-gray-600">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-400">Issues Found</p>
                    <p className="text-2xl font-bold text-orange-400">
                      {ownershipData.filter(a => a.ownershipIssue).length}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
          
          {/* Probate Avoidance Strategies */}
          <Alert className="bg-blue-900/20 border-blue-800">
            <Info className="h-4 w-4 text-blue-300" />
            <AlertDescription className="text-gray-300">
              <strong>Probate Avoidance Strategies by Asset Type:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>Real Estate:</strong> Revocable trust, transfer-on-death deed, or joint tenancy with right of survivorship</li>
                <li><strong>Bank Accounts:</strong> POD (Payable on Death) beneficiary designation</li>
                <li><strong>Investment Accounts:</strong> TOD (Transfer on Death) beneficiary designation or trust ownership</li>
                <li><strong>Retirement Accounts:</strong> Named beneficiaries (do NOT put in trust - loses tax benefits)</li>
                <li><strong>Life Insurance:</strong> Named beneficiaries (primary and contingent)</li>
                <li><strong>Personal Property:</strong> Trust ownership or specific bequests in pour-over will</li>
              </ul>
              <p className="mt-3 text-xs">
                Note: Assets with proper beneficiary designations or trust ownership bypass probate entirely, 
                saving time, money, and maintaining privacy.
              </p>
            </AlertDescription>
          </Alert>
          
          {/* Beneficiary Designations */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Beneficiary Designations</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Instructions Banner */}
              <Alert className="mb-6 bg-purple-900/20 border-purple-800">
                <Info className="h-4 w-4 text-purple-400" />
                <AlertDescription className="text-gray-300">
                  <strong>Track Your Beneficiaries:</strong> After updating beneficiaries with your financial institutions, 
                  click the "Add/Update Beneficiaries" button below to record the information here. This helps track your 
                  designations and improves your beneficiary score.
                </AlertDescription>
              </Alert>
              
              {/* Action Items */}
              <Alert className="bg-gray-700/30 border-gray-600">
                <Info className="h-4 w-4 text-gray-400" />
                <AlertDescription className="text-gray-300">
                  <strong>Action Items:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Request current beneficiary forms from all financial institutions</li>
                    <li>Verify SSNs and percentages for all beneficiaries</li>
                    <li>Consider adding contingent beneficiaries where missing</li>
                    <li>Update forms after any life changes (marriage, divorce, births)</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      
      
      {/* Beneficiary Update Modal */}
      <Dialog open={showBeneficiaryModal} onOpenChange={setShowBeneficiaryModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Beneficiary Designations</DialogTitle>
            <DialogDescription>
              Record the beneficiary information you've updated with {selectedAccount?.accountName}.
              Ensure percentages total 100% for each beneficiary type.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Primary Beneficiaries */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold text-white">Primary Beneficiaries</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addBeneficiary('primary')}
                  className="text-xs bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Primary
                </Button>
              </div>
              
              {beneficiaryForm.primary.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No primary beneficiaries. Click "Add Primary" to add one.
                </p>
              ) : (
                <div className="space-y-3">
                  {beneficiaryForm.primary.map((beneficiary, index) => (
                    <div key={index} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={beneficiary.name}
                            onChange={(e) => updateBeneficiary('primary', index, 'name', e.target.value)}
                            placeholder="Full name"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Relationship</Label>
                          <Select
                            value={beneficiary.relationship}
                            onValueChange={(value) => updateBeneficiary('primary', index, 'relationship', value)}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Spouse">Spouse</SelectItem>
                              <SelectItem value="Child">Child</SelectItem>
                              <SelectItem value="Parent">Parent</SelectItem>
                              <SelectItem value="Sibling">Sibling</SelectItem>
                              <SelectItem value="Trust">Trust</SelectItem>
                              <SelectItem value="Charity">Charity</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Percentage</Label>
                          <Input
                            type="number"
                            value={beneficiary.percentage}
                            onChange={(e) => updateBeneficiary('primary', index, 'percentage', parseInt(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            max="100"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeBeneficiary('primary', index)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="text-sm text-right">
                    Total: <span className={beneficiaryForm.primary.reduce((sum, b) => sum + Number(b.percentage), 0) === 100 ? 'text-green-400' : 'text-red-400'}>
                      {beneficiaryForm.primary.reduce((sum, b) => sum + Number(b.percentage), 0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Contingent Beneficiaries */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold text-white">Contingent Beneficiaries</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addBeneficiary('contingent')}
                  className="text-xs bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Contingent
                </Button>
              </div>
              
              {beneficiaryForm.contingent.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No contingent beneficiaries. This is optional but recommended.
                </p>
              ) : (
                <div className="space-y-3">
                  {beneficiaryForm.contingent.map((beneficiary, index) => (
                    <div key={index} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={beneficiary.name}
                            onChange={(e) => updateBeneficiary('contingent', index, 'name', e.target.value)}
                            placeholder="Full name"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Relationship</Label>
                          <Select
                            value={beneficiary.relationship}
                            onValueChange={(value) => updateBeneficiary('contingent', index, 'relationship', value)}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Spouse">Spouse</SelectItem>
                              <SelectItem value="Child">Child</SelectItem>
                              <SelectItem value="Parent">Parent</SelectItem>
                              <SelectItem value="Sibling">Sibling</SelectItem>
                              <SelectItem value="Trust">Trust</SelectItem>
                              <SelectItem value="Charity">Charity</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Percentage</Label>
                          <Input
                            type="number"
                            value={beneficiary.percentage}
                            onChange={(e) => updateBeneficiary('contingent', index, 'percentage', parseInt(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            max="100"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeBeneficiary('contingent', index)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="text-sm text-right">
                    Total: <span className={beneficiaryForm.contingent.reduce((sum, b) => sum + Number(b.percentage), 0) === 100 ? 'text-green-400' : 'text-red-400'}>
                      {beneficiaryForm.contingent.reduce((sum, b) => sum + Number(b.percentage), 0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Instructions */}
            <Alert className="bg-blue-900/20 border-blue-800">
              <Info className="h-4 w-4 text-blue-300" />
              <AlertDescription className="text-sm text-gray-300">
                <strong>Important:</strong> This form records your beneficiary designations for tracking purposes only. 
                You must still update beneficiaries directly with each financial institution. Keep copies of all 
                beneficiary designation forms for your records.
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBeneficiaryModal(false)} className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500">
              Cancel
            </Button>
            <Button onClick={handleSaveBeneficiaries} className="bg-[#8A00C4] hover:bg-[#7000A4]">
              <Save className="h-4 w-4 mr-2" />
              Save Beneficiaries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}