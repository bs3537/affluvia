import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  GraduationCap, 
  School,
  DollarSign,
  Calendar,
  User,
  Calculator,
  TrendingUp,
  Info,
  Search,
  Loader2,
  Plus,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { filter529Plans, parseAssets } from '@/utils/asset-utils';

interface CollegeSearchResult {
  id: number;
  name: string;
  city: string;
  state: string;
  inStateTuition: number | null;
  outOfStateTuition: number | null;
  roomAndBoard: number | null;
  isPublic: boolean;
}

interface FundingSource {
  type: string;
  amount: number;
}

interface EducationGoal {
  id?: string;
  studentName: string;
  relationship?: string;
  goalType: 'college' | 'pre-college';
  degreeType?: 'undergraduate' | 'masters';
  stateOfResidence?: string;
  startYear: number;
  endYear: number;
  years: number;
  costOption: 'average' | 'specific' | 'custom';
  collegeId?: string;
  collegeName?: string;
  costPerYear?: number;
  includeRoomBoard?: boolean;
  isInState?: boolean;
  scholarshipPerYear?: number;
  loanPerYear?: number;
  coverPercent: number;
  currentSavings?: number;
  monthlyContribution?: number;
  accountType?: string;
  fundingSources?: FundingSource[];
  expectedReturn?: number;
  riskProfile?: string;
  // Optional linkage to a specific 529 asset from profile
  selected529AssetId?: string;
  selected529AssetName?: string;
  // Student loan specific fields
  loanInterestRate?: number;
  loanRepaymentTerm?: number;
  loanDefermentPeriod?: number;
  loanSubsidized?: boolean;
  projection?: {
    years: number[];
    costs: number[];
    funded: number[];
    totalCost: number;
    totalFunded: number;
    fundingPercentage: number;
    monthlyContributionNeeded: number;
    probabilityOfSuccess?: number;
    monteCarloAnalysis?: any;
  };
}

interface GoalFormModalProps {
  goal: EducationGoal | null;
  onClose: () => void;
  onSave: (goal: EducationGoal) => void;
}

const currentYear = new Date().getFullYear();

// Based on 2023-2024 College Board data
const nationalAverageCosts = {
  college: {
    publicInStateCommuter: 12210,     // Tuition + fees only (commuter)
    publicInStateBoarding: 28840,     // Tuition + fees + room & board
    publicOutOfStateCommuter: 29150,  // Tuition + fees only (out-of-state)
    publicOutOfStateBoarding: 45780,  // Tuition + fees + room & board
    privateCommuter: 41540,           // Tuition + fees only (private)
    privateBoarding: 56190,           // Tuition + fees + room & board
  },
  masters: {
    publicInStateCommuter: 12596,     // Average graduate tuition (in-state)
    publicInStateBoarding: 25000,     // Tuition + estimated living expenses
    publicOutOfStateCommuter: 28886,  // Average out-of-state graduate tuition
    publicOutOfStateBoarding: 41000,  // Tuition + estimated living expenses
    privateCommuter: 29931,           // Average private graduate tuition
    privateBoarding: 42000,           // Tuition + estimated living expenses
  },
  preCollege: {
    publicK12: 0,
    privateK12: 15000
  }
};

// State-specific private K-12 tuition data (2024)
const statePrivateK12Costs: Record<string, { elementary: number; secondary: number; average: number }> = {
  AL: { elementary: 7808, secondary: 8758, average: 8289 },
  AK: { elementary: 7316, secondary: 6881, average: 7224 },
  AZ: { elementary: 10500, secondary: 14000, average: 12250 },
  AR: { elementary: 6500, secondary: 8000, average: 7250 },
  CA: { elementary: 14500, secondary: 19000, average: 16750 },
  CO: { elementary: 11000, secondary: 14500, average: 12750 },
  CT: { elementary: 22000, secondary: 33610, average: 29133 },
  DE: { elementary: 11500, secondary: 13000, average: 12250 },
  DC: { elementary: 24000, secondary: 32000, average: 28000 },
  FL: { elementary: 10500, secondary: 12500, average: 11500 },
  GA: { elementary: 11000, secondary: 13500, average: 12250 },
  HI: { elementary: 9000, secondary: 12000, average: 10500 },
  ID: { elementary: 7000, secondary: 9000, average: 8000 },
  IL: { elementary: 8639, secondary: 13923, average: 9287 },
  IN: { elementary: 6098, secondary: 9216, average: 7161 },
  IA: { elementary: 5810, secondary: 10792, average: 6363 },
  KS: { elementary: 7184, secondary: 10676, average: 8044 },
  KY: { elementary: 6500, secondary: 8500, average: 7500 },
  LA: { elementary: 7500, secondary: 9500, average: 8500 },
  ME: { elementary: 18000, secondary: 25000, average: 21500 },
  MD: { elementary: 14000, secondary: 18000, average: 16000 },
  MA: { elementary: 20000, secondary: 28000, average: 24000 },
  MI: { elementary: 8000, secondary: 11000, average: 9500 },
  MN: { elementary: 8500, secondary: 12000, average: 10250 },
  MS: { elementary: 5500, secondary: 7000, average: 6250 },
  MO: { elementary: 8000, secondary: 11000, average: 9500 },
  MT: { elementary: 7000, secondary: 9000, average: 8000 },
  NE: { elementary: 3755, secondary: 3905, average: 2830 },
  NV: { elementary: 8500, secondary: 11000, average: 9750 },
  NH: { elementary: 16000, secondary: 22000, average: 19000 },
  NJ: { elementary: 15000, secondary: 20000, average: 17500 },
  NM: { elementary: 7500, secondary: 10000, average: 8750 },
  NY: { elementary: 17000, secondary: 23000, average: 20000 },
  NC: { elementary: 9000, secondary: 11500, average: 10250 },
  ND: { elementary: 5000, secondary: 6500, average: 5750 },
  OH: { elementary: 7389, secondary: 10895, average: 7929 },
  OK: { elementary: 7573, secondary: 8647, average: 7432 },
  OR: { elementary: 10000, secondary: 13000, average: 11500 },
  PA: { elementary: 12000, secondary: 16000, average: 14000 },
  RI: { elementary: 14000, secondary: 19000, average: 16500 },
  SC: { elementary: 8500, secondary: 11000, average: 9750 },
  SD: { elementary: 4000, secondary: 4424, average: 4212 },
  TN: { elementary: 9000, secondary: 11500, average: 10250 },
  TX: { elementary: 9500, secondary: 12000, average: 10750 },
  UT: { elementary: 8000, secondary: 10500, average: 9250 },
  VT: { elementary: 19348, secondary: 33421, average: 24628 },
  VA: { elementary: 13599, secondary: 17901, average: 15116 },
  WA: { elementary: 11000, secondary: 14500, average: 12750 },
  WV: { elementary: 5500, secondary: 7000, average: 6250 },
  WI: { elementary: 4483, secondary: 9442, average: 5058 },
  WY: { elementary: 6500, secondary: 8500, average: 7500 }
};

// US states list for dropdown
const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' }
];

export function GoalFormModal({ goal, onClose, onSave }: GoalFormModalProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CollegeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState<CollegeSearchResult | null>(null);
  const [isInState, setIsInState] = useState(goal?.isInState ?? true);
  const [includeRoomBoard, setIncludeRoomBoard] = useState(goal?.includeRoomBoard ?? true);
  const [selectedNationalAverage, setSelectedNationalAverage] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedSchoolType, setSelectedSchoolType] = useState<'public' | 'private' | null>(null);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<'elementary' | 'secondary' | 'average' | null>(null);
  
  // Load financial profile to surface 529 plan accounts
  const { data: profile } = useQuery({
    queryKey: ['/api/financial-profile'],
    queryFn: async () => {
      const res = await fetch('/api/financial-profile', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    }
  });
  const educationAssetOptions = useMemo(() => {
    if (!profile) return [] as Array<{ id: string; name: string; value: number; type: string; owner?: any }>;
    const assets = parseAssets((profile as any).assets);
    return filter529Plans(assets);
  }, [profile]);
  
  // Load Plaid-linked 529 accounts (if any)
  const { data: plaidData } = useQuery({
    queryKey: ['/api/education/plaid-529-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/education/plaid-529-accounts', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30_000,
  });

  const plaidAssetOptions = useMemo(() => {
    const accounts = plaidData?.accounts || [];
    return accounts.map((acc: any) => ({
      id: acc.accountId,
      name: `Plaid • ${[acc.institutionName, acc.accountName].filter(Boolean).join(' ')}`.trim(),
      value: Number(acc.balance) || 0,
      type: acc.accountType || '529',
    }));
  }, [plaidData]);

  const merged529Options = useMemo(() => {
    const merged = new Map<string, { id: string; name: string; value: number; type: string }>();
    [...plaidAssetOptions, ...educationAssetOptions].forEach((asset) => {
      if (!merged.has(asset.id)) {
        merged.set(asset.id, asset);
      }
    });
    return Array.from(merged.values());
  }, [plaidAssetOptions, educationAssetOptions]);
  
  // Reconstruct funding sources from scholarshipPerYear and loanPerYear if editing
  const reconstructFundingSources = (goal: EducationGoal | null): FundingSource[] => {
    if (!goal) return [];
    
    const sources: FundingSource[] = [];
    
    // Add scholarship/grant if present
    if (goal.scholarshipPerYear && Number(goal.scholarshipPerYear) > 0) {
      sources.push({
        type: 'scholarships',
        amount: Number(goal.scholarshipPerYear)
      });
    }
    
    // Add student loan if present
    if (goal.loanPerYear && Number(goal.loanPerYear) > 0) {
      sources.push({
        type: 'student_loan',
        amount: Number(goal.loanPerYear)
      });
    }
    
    return sources;
  };

  const [formData, setFormData] = useState<EducationGoal>({
    studentName: '',
    relationship: 'child',
    goalType: 'college',
    degreeType: 'undergraduate',
    startYear: currentYear + 10,
    endYear: currentYear + 14, // 4 years starting 10 years from now (currentYear + 10 + 4 = currentYear + 14)
    years: 4,
    costOption: 'average',
    coverPercent: 100,
    currentSavings: 0,
    monthlyContribution: 0,
    accountType: '529',
    expectedReturn: 6,
    riskProfile: 'moderate',
    ...goal,
    // Reconstruct funding sources if editing an existing goal
    fundingSources: goal?.fundingSources || reconstructFundingSources(goal)
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate annual education cost
  const calculateAnnualCost = () => {
    if (formData.costPerYear) {
      return formData.costPerYear;
    }
    
    // For specific college selection
    if (selectedCollege && formData.costOption === 'specific') {
      const tuition = isInState ? 
        (selectedCollege.inStateTuition || 0) : 
        (selectedCollege.outOfStateTuition || 0);
      const roomBoard = includeRoomBoard ? (selectedCollege.roomAndBoard || 0) : 0;
      return tuition + roomBoard;
    }
    
    return 0;
  };

  // Calculate funding gap
  const calculateFundingGap = () => {
    const annualCost = calculateAnnualCost();
    const annualContributions = Number(formData.monthlyContribution || 0) * 12;
    
    // Separate student loans from other funding sources
    const studentLoans = formData.fundingSources?.filter(s => s.type === 'student_loan').reduce((sum, s) => sum + Number(s.amount || 0), 0) || 0;
    const otherFunding = formData.fundingSources?.filter(s => s.type !== 'student_loan').reduce((sum, s) => sum + Number(s.amount || 0), 0) || 0;
    
    const annualFromSavings = formData.years > 0 ? Number(formData.currentSavings || 0) / formData.years : 0;
    
    const totalAnnualFunding = annualContributions + otherFunding + studentLoans + annualFromSavings;
    const gap = Math.max(0, annualCost - totalAnnualFunding);
    
    return {
      annualCost,
      totalAnnualFunding,
      gap,
      annualFromSavings,
      studentLoans,
      otherFunding
    };
  };

  // Helper function to get the appropriate cost based on degree type
  const getCollegeCost = (costType: keyof typeof nationalAverageCosts.college) => {
    const costKey = formData.degreeType === 'masters' ? 'masters' : 'college';
    return nationalAverageCosts[costKey][costType];
  };

  // Update end year when start year or duration changes
  useEffect(() => {
    // Only update endYear if it's actually different to prevent infinite loops
    const newEndYear = formData.startYear + formData.years;
    if (formData.endYear !== newEndYear) {
      setFormData(prev => ({
        ...prev,
        endYear: newEndYear // 4 years: Sept 2035 - May 2039
      }));
    }
  }, [formData.startYear, formData.years, formData.endYear]);

  // Debounce timer ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // College search function using backend API
  const searchColleges = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/education/college-search?query=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to search colleges');
      }
      
      const results: CollegeSearchResult[] = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching colleges:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to search colleges. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };
  
  // Debounced search function
  const debouncedSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchColleges(query);
    }, 300); // 300ms delay
  }, []);

  // Handle college selection
  const handleCollegeSelect = (college: CollegeSearchResult) => {
    setSelectedCollege(college);
    setSelectedNationalAverage(null); // Clear national average selection
    
    // Calculate total cost based on selections
    let tuition = 0;
    if (college.isPublic && isInState && college.inStateTuition) {
      tuition = college.inStateTuition;
    } else if (college.outOfStateTuition) {
      tuition = college.outOfStateTuition;
    } else if (college.inStateTuition) {
      tuition = college.inStateTuition; // Fallback for private schools
    }
    
    const roomBoard = includeRoomBoard && college.roomAndBoard ? college.roomAndBoard : 0;
    const totalCost = tuition + roomBoard;
    
    setFormData(prev => ({
      ...prev,
      collegeId: college.id.toString(),
      collegeName: college.name,
      costPerYear: totalCost,
      includeRoomBoard: includeRoomBoard,
      isInState: isInState
    }));
    
    toast.success(`Selected ${college.name}. Annual cost: $${totalCost.toLocaleString()}`);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.studentName.trim()) {
      newErrors.studentName = 'Student name is required';
    }

    if (formData.costOption === 'custom' && (!formData.costPerYear || formData.costPerYear <= 0)) {
      newErrors.costPerYear = 'Please enter a valid annual cost';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSave(formData);
    } else {
      toast.error('Please fix the errors before saving');
      // Switch to the tab with the first error
      if (errors.studentName || errors.startYear) {
        setActiveTab('basic');
      } else if (errors.costPerYear) {
        setActiveTab('costs');
      }
    }
  };

  const updateField = (field: keyof EducationGoal, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const addFundingSource = () => {
    const newSource: FundingSource = { type: '', amount: 0 };
    setFormData(prev => ({
      ...prev,
      fundingSources: [...(prev.fundingSources || []), newSource]
    }));
  };

  const removeFundingSource = (index: number) => {
    setFormData(prev => ({
      ...prev,
      fundingSources: prev.fundingSources?.filter((_, i) => i !== index) || []
    }));
  };

  const updateFundingSource = (index: number, field: keyof FundingSource, value: any) => {
    setFormData(prev => ({
      ...prev,
      fundingSources: prev.fundingSources?.map((source, i) => 
        i === index ? { ...source, [field]: value } : source
      ) || []
    }));
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40" 
        onClick={onClose}
      />
      
      {/* Sliding Panel */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 lg:left-64 right-0 top-20 bg-gray-900 z-50 shadow-2xl border-t border-gray-800 lg:border-l rounded-t-2xl lg:rounded-none overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Handle for mobile */}
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 lg:hidden">
          <div className="w-12 h-1 bg-gray-600 rounded-full" />
        </div>
          {/* Header */}
          <div className="p-6 border-b border-gray-800 bg-gradient-to-r from-gray-900 to-purple-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <School className="h-8 w-8 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {goal ? 'Edit Education Goal' : 'Add Education Goal'}
                  </h2>
                  <p className="text-base text-gray-400">
                    Plan for future education expenses
                  </p>
                </div>
              </div>
              <Button
                onClick={onClose}
                variant="ghost"
                className="hover:bg-gray-800 p-2"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 mb-8 bg-gray-800/50 p-1 rounded-xl">
                <TabsTrigger value="basic" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-600/20 text-base py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">1.</span>
                    <User className="h-4 w-4" />
                    Basic Info
                  </div>
                </TabsTrigger>
                <TabsTrigger value="costs" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-600/20 text-base py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">2.</span>
                    <DollarSign className="h-4 w-4" />
                    Costs
                  </div>
                </TabsTrigger>
                <TabsTrigger value="funding" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-600/20 text-base py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">3.</span>
                    <Calculator className="h-4 w-4" />
                    Funding
                  </div>
                </TabsTrigger>
                <TabsTrigger value="investment" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-600/20 text-base py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">4.</span>
                    <TrendingUp className="h-4 w-4" />
                    Investment
                  </div>
                </TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-8">
                {/* Info Alert */}
                <Alert className="bg-purple-900/20 border-purple-500/20">
                  <Info className="h-4 w-4 text-purple-400" />
                  <AlertDescription className="text-purple-200">
                    Let's start with basic information about the student and when they'll need education funding.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Student Name */}
                  <div className="space-y-2">
                    <Label htmlFor="studentName" className="text-white text-base font-medium">
                      Student Name <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="studentName"
                      value={formData.studentName}
                      onChange={(e) => updateField('studentName', e.target.value)}
                      placeholder="e.g., Jane Doe"
                      className={`h-12 text-base bg-gray-800/50 border-gray-700 focus:border-purple-500 ${errors.studentName ? 'border-red-500' : ''}`}
                    />
                    {errors.studentName && (
                      <p className="text-sm text-red-400">{errors.studentName}</p>
                    )}
                  </div>

                  {/* Relationship */}
                  <div className="space-y-2">
                    <Label htmlFor="relationship" className="text-white text-base font-medium">
                      Relationship to Student
                    </Label>
                    <Select
                      value={formData.relationship}
                      onValueChange={(value) => updateField('relationship', value)}
                    >
                      <SelectTrigger id="relationship" className="h-12 text-base bg-gray-800/50 border-gray-700 focus:border-purple-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-white">
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="self">Self</SelectItem>
                        <SelectItem value="spouse">Spouse</SelectItem>
                        <SelectItem value="grandchild">Grandchild</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Goal Type */}
                  <div className="space-y-2">
                    <Label className="text-white text-base font-medium">Education Type</Label>
                    <RadioGroup
                      value={formData.goalType}
                      onValueChange={(value) => {
                        updateField('goalType', value as 'college' | 'pre-college');
                        // Reset pre-college selections when changing goal type
                        setSelectedState('');
                        setSelectedSchoolType(null);
                        setSelectedGradeLevel(null);
                        setSelectedNationalAverage(null);
                        // If switching to pre-college and cost option was 'specific', reset to 'average'
                        if (value === 'pre-college' && formData.costOption === 'specific') {
                          updateField('costOption', 'average');
                          // Also clear any selected college data
                          setSelectedCollege(null);
                          setSearchQuery('');
                          setSearchResults([]);
                        }
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pre-college" id="pre-college" />
                        <Label htmlFor="pre-college" className="text-gray-300 cursor-pointer">
                          Pre-college
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="college" id="college" />
                        <Label htmlFor="college" className="text-gray-300 cursor-pointer">
                          College/University
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Degree Type - Only show for college */}
                  {formData.goalType === 'college' && (
                    <div className="space-y-2">
                      <Label className="text-white text-base font-medium">Degree Type</Label>
                      <RadioGroup
                        value={formData.degreeType || 'undergraduate'}
                        onValueChange={(value) => {
                          updateField('degreeType', value as 'undergraduate' | 'masters');
                          // Update default years based on degree type
                          if (value === 'undergraduate') {
                            updateField('years', 4);
                          } else if (value === 'masters') {
                            updateField('years', 2);
                            // If switching to masters and cost option was 'specific', reset to 'average'
                            if (formData.costOption === 'specific') {
                              updateField('costOption', 'average');
                              // Clear any selected college data
                              setSelectedCollege(null);
                              setSearchQuery('');
                              setSearchResults([]);
                            }
                          }
                          // Update cost if national average was selected
                          if (formData.costOption === 'average' && selectedNationalAverage) {
                            const costKey = value === 'masters' ? 'masters' : 'college';
                            updateField('costPerYear', nationalAverageCosts[costKey][selectedNationalAverage as keyof typeof nationalAverageCosts.college]);
                          }
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="undergraduate" id="undergraduate" />
                          <Label htmlFor="undergraduate" className="text-gray-300 cursor-pointer">
                            Undergraduate
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="masters" id="masters" />
                          <Label htmlFor="masters" className="text-gray-300 cursor-pointer">
                            Masters
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  {/* Years */}
                  <div className="space-y-2">
                    <Label htmlFor="years" className="text-white text-base font-medium">
                      Duration (Years)
                    </Label>
                    <Select
                      value={formData.years.toString()}
                      onValueChange={(value) => updateField('years', parseInt(value))}
                    >
                      <SelectTrigger id="years" className="h-12 text-base bg-gray-800/50 border-gray-700 focus:border-purple-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-white">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(year => (
                          <SelectItem key={year} value={year.toString()}>
                            {year} {year === 1 ? 'year' : 'years'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Start Year */}
                  <div className="space-y-2">
                    <Label htmlFor="startYear" className="text-white text-base font-medium">
                      Start Year <span className="text-red-400">*</span>
                    </Label>
                    <p className="text-sm text-gray-400">When will the student begin their education?</p>
                    <Input
                      id="startYear"
                      type="number"
                      min={currentYear - 20}
                      max={currentYear + 30}
                      value={formData.startYear}
                      onChange={(e) => updateField('startYear', parseInt(e.target.value))}
                      className={`h-12 text-base bg-gray-800/50 border-gray-700 focus:border-purple-500 ${errors.startYear ? 'border-red-500' : ''}`}
                    />
                    {errors.startYear && (
                      <p className="text-sm text-red-400">{errors.startYear}</p>
                    )}
                  </div>

                  {/* End Year (calculated) */}
                  <div className="space-y-2">
                    <Label className="text-white text-base font-medium">End Year</Label>
                    <div className="h-12 px-3 py-3 bg-gray-800 rounded-md text-gray-400 border border-gray-700 flex items-center text-base">
                      {formData.endYear}
                    </div>
                    <p className="text-xs text-gray-500">
                      Sept {formData.startYear} - May {formData.endYear} ({formData.years} academic years)
                    </p>
                  </div>

                  {/* State of Residence */}
                  <div className="space-y-2">
                    <Label htmlFor="stateOfResidence" className="text-white text-base font-medium">
                      State of Residence
                    </Label>
                    <p className="text-sm text-gray-400">Your state for 529 plan tax benefits</p>
                    <Select
                      value={formData.stateOfResidence || ''}
                      onValueChange={(value) => updateField('stateOfResidence', value)}
                    >
                      <SelectTrigger id="stateOfResidence" className="h-12 text-base bg-gray-800/50 border-gray-700 focus:border-purple-500">
                        <SelectValue placeholder="Select your state" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-white">
                        {US_STATES.map(state => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Navigation Footer */}
                <div className="mt-12 pt-6 border-t border-gray-800">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-400">
                      Step 1 of 4: Basic Information
                    </div>
                    <Button
                      onClick={() => setActiveTab('costs')}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Next: Education Costs
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Costs Tab */}
              <TabsContent value="costs" className="space-y-8">
                {/* Info Alert */}
                <Alert className="bg-purple-900/20 border-purple-500/20">
                  <Info className="h-4 w-4 text-purple-400" />
                  <AlertDescription className="text-purple-200">
                    Choose how to estimate education costs. You can use national averages, search for a specific school, or enter custom amounts.
                  </AlertDescription>
                </Alert>

                {/* Show selected school info at the top if available */}
                {formData.collegeName && formData.costPerYear && (
                  <Card className="bg-gray-800/50 border-purple-500/50">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <School className="h-6 w-6 text-purple-400" />
                            <h3 className="text-lg font-semibold text-purple-400">Selected School</h3>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400">School:</span>
                              <span className="text-white font-medium">{formData.collegeName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400">Annual Cost:</span>
                              <span className="text-green-400 font-bold text-lg">
                                ${formData.costPerYear.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Clear selection
                            setFormData(prev => ({
                              ...prev,
                              collegeName: '',
                              collegeId: '',
                              costPerYear: 0
                            }));
                            setSelectedCollege(null);
                            setSelectedNationalAverage(null);
                          }}
                          className="text-gray-400 hover:text-red-400 hover:bg-red-900/20"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <div className="space-y-6">
                  <Label className="text-white text-lg font-medium">How would you like to estimate costs?</Label>
                  <RadioGroup
                    value={formData.costOption}
                    onValueChange={(value) => {
                      updateField('costOption', value as 'average' | 'specific' | 'custom');
                      // Clear selections when changing cost option
                      if (value !== 'specific') {
                        setSelectedCollege(null);
                        setSearchQuery('');
                        setSearchResults([]);
                      }
                      if (value !== 'average') {
                        setSelectedNationalAverage(null);
                        // Reset pre-college selections
                        setSelectedState('');
                        setSelectedSchoolType(null);
                        setSelectedGradeLevel(null);
                      }
                    }}
                  >
                    <Card className="bg-gray-800/50 border-gray-700 hover:border-purple-600 hover:bg-gray-800/70 transition-all cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex items-start space-x-3">
                          <RadioGroupItem value="average" id="average" className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor="average" className="text-white cursor-pointer text-base font-medium">
                              Use National Averages
                            </Label>
                            <p className="text-sm text-gray-400 mt-2 mb-3">
                              Select from average {formData.degreeType === 'masters' ? 'graduate program' : 'undergraduate'} costs including tuition, fees, room & board
                            </p>
                            {formData.costOption === 'average' && formData.goalType === 'college' && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Public In-State Options */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedNationalAverage('publicInStateCommuter');
                                      updateField('costPerYear', getCollegeCost('publicInStateCommuter'));
                                      updateField('collegeName', '');
                                      updateField('collegeId', '');
                                    }}
                                    className={`p-4 rounded-lg border transition-all text-left ${
                                      selectedNationalAverage === 'publicInStateCommuter'
                                        ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-600/20'
                                        : 'bg-gray-800/50 border-gray-700 hover:border-purple-500'
                                    }`}
                                  >
                                    <div className="font-medium text-white">In-State Public (Commuter)</div>
                                    <div className="text-xs text-gray-400 mt-1">Tuition & fees only</div>
                                    <div className="text-lg text-purple-400 mt-2">
                                      ${getCollegeCost('publicInStateCommuter').toLocaleString()}/year
                                    </div>
                                  </button>
                                  
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedNationalAverage('publicInStateBoarding');
                                      updateField('costPerYear', getCollegeCost('publicInStateBoarding'));
                                      updateField('collegeName', '');
                                      updateField('collegeId', '');
                                    }}
                                    className={`p-4 rounded-lg border transition-all text-left ${
                                      selectedNationalAverage === 'publicInStateBoarding'
                                        ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-600/20'
                                        : 'bg-gray-800/50 border-gray-700 hover:border-purple-500'
                                    }`}
                                  >
                                    <div className="font-medium text-white">In-State Public (With Boarding)</div>
                                    <div className="text-xs text-gray-400 mt-1">Includes room & board</div>
                                    <div className="text-lg text-purple-400 mt-2">
                                      ${getCollegeCost('publicInStateBoarding').toLocaleString()}/year
                                    </div>
                                  </button>

                                  {/* Public Out-of-State Options */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedNationalAverage('publicOutOfStateCommuter');
                                      updateField('costPerYear', getCollegeCost('publicOutOfStateCommuter'));
                                      updateField('collegeName', '');
                                      updateField('collegeId', '');
                                    }}
                                    className={`p-4 rounded-lg border transition-all text-left ${
                                      selectedNationalAverage === 'publicOutOfStateCommuter'
                                        ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-600/20'
                                        : 'bg-gray-800/50 border-gray-700 hover:border-purple-500'
                                    }`}
                                  >
                                    <div className="font-medium text-white">Out-of-State Public (Commuter)</div>
                                    <div className="text-xs text-gray-400 mt-1">Tuition & fees only</div>
                                    <div className="text-lg text-purple-400 mt-2">
                                      ${getCollegeCost('publicOutOfStateCommuter').toLocaleString()}/year
                                    </div>
                                  </button>
                                  
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedNationalAverage('publicOutOfStateBoarding');
                                      updateField('costPerYear', getCollegeCost('publicOutOfStateBoarding'));
                                      updateField('collegeName', '');
                                      updateField('collegeId', '');
                                    }}
                                    className={`p-4 rounded-lg border transition-all text-left ${
                                      selectedNationalAverage === 'publicOutOfStateBoarding'
                                        ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-600/20'
                                        : 'bg-gray-800/50 border-gray-700 hover:border-purple-500'
                                    }`}
                                  >
                                    <div className="font-medium text-white">Out-of-State Public (With Boarding)</div>
                                    <div className="text-xs text-gray-400 mt-1">Includes room & board</div>
                                    <div className="text-lg text-purple-400 mt-2">
                                      ${getCollegeCost('publicOutOfStateBoarding').toLocaleString()}/year
                                    </div>
                                  </button>

                                  {/* Private Options */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedNationalAverage('privateCommuter');
                                      updateField('costPerYear', getCollegeCost('privateCommuter'));
                                      updateField('collegeName', '');
                                      updateField('collegeId', '');
                                    }}
                                    className={`p-4 rounded-lg border transition-all text-left ${
                                      selectedNationalAverage === 'privateCommuter'
                                        ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-600/20'
                                        : 'bg-gray-800/50 border-gray-700 hover:border-purple-500'
                                    }`}
                                  >
                                    <div className="font-medium text-white">Private (Commuter)</div>
                                    <div className="text-xs text-gray-400 mt-1">Tuition & fees only</div>
                                    <div className="text-lg text-purple-400 mt-2">
                                      ${getCollegeCost('privateCommuter').toLocaleString()}/year
                                    </div>
                                  </button>
                                  
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedNationalAverage('privateBoarding');
                                      updateField('costPerYear', getCollegeCost('privateBoarding'));
                                      updateField('collegeName', '');
                                      updateField('collegeId', '');
                                    }}
                                    className={`p-4 rounded-lg border transition-all text-left ${
                                      selectedNationalAverage === 'privateBoarding'
                                        ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-600/20'
                                        : 'bg-gray-800/50 border-gray-700 hover:border-purple-500'
                                    }`}
                                  >
                                    <div className="font-medium text-white">Private (With Boarding)</div>
                                    <div className="text-xs text-gray-400 mt-1">Includes room & board</div>
                                    <div className="text-lg text-purple-400 mt-2">
                                      ${getCollegeCost('privateBoarding').toLocaleString()}/year
                                    </div>
                                  </button>
                                </div>
                                
                                {selectedNationalAverage && (
                                  <div className="flex justify-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedNationalAverage(null);
                                        updateField('costPerYear', 0);
                                      }}
                                      className="text-gray-400 hover:text-red-400 hover:bg-red-900/20"
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Clear Selection
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Pre-College (K-12) National Averages */}
                            {formData.costOption === 'average' && formData.goalType === 'pre-college' && (
                              <div className="space-y-4">
                                {/* State Selection */}
                                <div className="space-y-2">
                                  <Label className="text-white text-base font-medium">
                                    Select State
                                  </Label>
                                  <Select
                                    value={selectedState}
                                    onValueChange={(value) => {
                                      setSelectedState(value);
                                      // Reset other selections when state changes
                                      setSelectedSchoolType(null);
                                      setSelectedGradeLevel(null);
                                      updateField('costPerYear', 0);
                                    }}
                                  >
                                    <SelectTrigger className="bg-gray-800/50 border-gray-700 focus:border-purple-500 text-white [&>svg]:text-white">
                                      <SelectValue placeholder="Choose a state" className="text-gray-300" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-800 border-gray-700 max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-700 [&::-webkit-scrollbar-thumb]:bg-gray-500 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-gray-400">
                                      {US_STATES.map((state) => (
                                        <SelectItem 
                                          key={state.value} 
                                          value={state.value}
                                          className="text-white hover:bg-gray-700 focus:bg-purple-600/20 focus:text-purple-200 cursor-pointer"
                                        >
                                          {state.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* School Type Selection */}
                                {selectedState && (
                                  <div className="space-y-3">
                                    <Label className="text-white text-base font-medium">
                                      School Type
                                    </Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedSchoolType('public');
                                          setSelectedGradeLevel(null);
                                          updateField('costPerYear', 0); // Public schools are free
                                        }}
                                        className={`p-4 rounded-lg border transition-all text-left ${
                                          selectedSchoolType === 'public'
                                            ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-600/20'
                                            : 'bg-gray-800/50 border-gray-700 hover:border-purple-500'
                                        }`}
                                      >
                                        <div className="font-medium text-white">Public School</div>
                                        <div className="text-xs text-gray-400 mt-1">No tuition cost</div>
                                        <div className="text-lg text-purple-400 mt-2">$0/year</div>
                                      </button>
                                      
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedSchoolType('private');
                                          setSelectedGradeLevel('average'); // Default to average
                                          const stateCosts = statePrivateK12Costs[selectedState];
                                          if (stateCosts) {
                                            updateField('costPerYear', stateCosts.average);
                                          }
                                        }}
                                        className={`p-4 rounded-lg border transition-all text-left ${
                                          selectedSchoolType === 'private'
                                            ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-600/20'
                                            : 'bg-gray-800/50 border-gray-700 hover:border-purple-500'
                                        }`}
                                      >
                                        <div className="font-medium text-white">Private School</div>
                                        <div className="text-xs text-gray-400 mt-1">State average tuition</div>
                                        <div className="text-lg text-purple-400 mt-2">
                                          ${statePrivateK12Costs[selectedState]?.average.toLocaleString() || 'N/A'}/year
                                        </div>
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Grade Level Selection for Private Schools */}
                                {selectedSchoolType === 'private' && selectedState && (
                                  <div className="space-y-3">
                                    <Label className="text-white text-base font-medium">
                                      Grade Level (Optional)
                                    </Label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedGradeLevel('elementary');
                                          const stateCosts = statePrivateK12Costs[selectedState];
                                          if (stateCosts) {
                                            updateField('costPerYear', stateCosts.elementary);
                                          }
                                        }}
                                        className={`p-4 rounded-lg border transition-all text-left ${
                                          selectedGradeLevel === 'elementary'
                                            ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-600/20'
                                            : 'bg-gray-800/50 border-gray-700 hover:border-purple-500'
                                        }`}
                                      >
                                        <div className="font-medium text-white">Elementary</div>
                                        <div className="text-xs text-gray-400 mt-1">K-5</div>
                                        <div className="text-lg text-purple-400 mt-2">
                                          ${statePrivateK12Costs[selectedState]?.elementary.toLocaleString() || 'N/A'}/year
                                        </div>
                                      </button>
                                      
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedGradeLevel('secondary');
                                          const stateCosts = statePrivateK12Costs[selectedState];
                                          if (stateCosts) {
                                            updateField('costPerYear', stateCosts.secondary);
                                          }
                                        }}
                                        className={`p-4 rounded-lg border transition-all text-left ${
                                          selectedGradeLevel === 'secondary'
                                            ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-600/20'
                                            : 'bg-gray-800/50 border-gray-700 hover:border-purple-500'
                                        }`}
                                      >
                                        <div className="font-medium text-white">Secondary</div>
                                        <div className="text-xs text-gray-400 mt-1">6-12</div>
                                        <div className="text-lg text-purple-400 mt-2">
                                          ${statePrivateK12Costs[selectedState]?.secondary.toLocaleString() || 'N/A'}/year
                                        </div>
                                      </button>
                                      
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedGradeLevel('average');
                                          const stateCosts = statePrivateK12Costs[selectedState];
                                          if (stateCosts) {
                                            updateField('costPerYear', stateCosts.average);
                                          }
                                        }}
                                        className={`p-4 rounded-lg border transition-all text-left ${
                                          selectedGradeLevel === 'average'
                                            ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-600/20'
                                            : 'bg-gray-800/50 border-gray-700 hover:border-purple-500'
                                        }`}
                                      >
                                        <div className="font-medium text-white">Average K-12</div>
                                        <div className="text-xs text-gray-400 mt-1">All grades</div>
                                        <div className="text-lg text-purple-400 mt-2">
                                          ${statePrivateK12Costs[selectedState]?.average.toLocaleString() || 'N/A'}/year
                                        </div>
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Clear Selection Button */}
                                {(selectedSchoolType || selectedState) && (
                                  <div className="flex justify-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedState('');
                                        setSelectedSchoolType(null);
                                        setSelectedGradeLevel(null);
                                        updateField('costPerYear', 0);
                                      }}
                                      className="text-gray-400 hover:text-red-400 hover:bg-red-900/20"
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Clear Selection
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {formData.goalType === 'college' && formData.degreeType !== 'masters' && (
                      <Card className="bg-gray-800/50 border-gray-700 hover:border-purple-600 hover:bg-gray-800/70 transition-all cursor-pointer">
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-3">
                            <RadioGroupItem value="specific" id="specific" className="mt-1" />
                            <div className="flex-1">
                              <Label htmlFor="specific" className="text-white cursor-pointer text-base font-medium">
                                Select Specific School
                              </Label>
                              <p className="text-sm text-gray-400 mt-2">
                                Search the College Scorecard database for your institution
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card className="bg-gray-800/50 border-gray-700 hover:border-purple-600 hover:bg-gray-800/70 transition-all cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex items-start space-x-3">
                          <RadioGroupItem value="custom" id="custom" className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor="custom" className="text-white cursor-pointer text-base font-medium">
                              Enter Custom Amount
                            </Label>
                            <p className="text-sm text-gray-400 mt-2">
                              Manually enter the annual cost if you know the exact amount
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </RadioGroup>
                </div>

                {/* Custom Cost Input */}
                {formData.costOption === 'custom' && (
                  <div className="space-y-2">
                    <Label htmlFor="costPerYear" className="text-white">
                      Annual Cost (in today's dollars) <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                      <Input
                        id="costPerYear"
                        type="number"
                        min="0"
                        value={formData.costPerYear || ''}
                        onChange={(e) => updateField('costPerYear', parseFloat(e.target.value) || 0)}
                        className={`pl-10 bg-gray-800/50 border-gray-700 focus:border-purple-500 ${errors.costPerYear ? 'border-red-500' : ''}`}
                        placeholder="50,000"
                      />
                    </div>
                    {errors.costPerYear && (
                      <p className="text-sm text-red-400">{errors.costPerYear}</p>
                    )}
                  </div>
                )}

                {/* College Search */}
                {formData.costOption === 'specific' && formData.goalType === 'college' && (
                  <div className="space-y-4">
                    {/* Search Input */}
                    <div className="space-y-2">
                      <Label className="text-white">Search for College/University</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (e.target.value.length >= 2) {
                              searchColleges(e.target.value);
                            }
                          }}
                          placeholder="Type college name (e.g., Stanford, Harvard)"
                          className="pl-10 bg-gray-800/50 border-gray-700 focus:border-purple-500"
                        />
                        {isSearching && (
                          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                        )}
                      </div>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-white">Select from search results:</Label>
                        <div className="max-h-48 overflow-y-auto space-y-2 bg-gray-800/30 rounded-lg p-2">
                          {searchResults.map((college) => (
                            <button
                              key={college.id}
                              onClick={() => handleCollegeSelect(college)}
                              className={`w-full text-left p-3 rounded-lg transition-colors ${
                                selectedCollege?.id === college.id
                                  ? 'bg-purple-600/20 border-purple-500 border'
                                  : 'bg-gray-800/50 hover:bg-gray-800/70 border-gray-700 border'
                              }`}
                            >
                              <div className="font-medium text-white">{college.name}</div>
                              <div className="text-sm text-gray-400">
                                {college.city}, {college.state} • {college.isPublic ? 'Public' : 'Private'}
                              </div>
                              <div className="text-sm text-gray-300 mt-1">
                                {college.inStateTuition && `In-State: $${college.inStateTuition.toLocaleString()}`}
                                {college.outOfStateTuition && ` • Out-of-State: $${college.outOfStateTuition.toLocaleString()}`}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Selected College Details */}
                    {selectedCollege && (
                      <Card className="bg-gray-800/50 border-purple-500/50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-purple-400">Selected: {selectedCollege.name}</h4>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCollege(null);
                                setSearchQuery('');
                                setSearchResults([]);
                                updateField('collegeName', '');
                                updateField('collegeId', '');
                                updateField('costPerYear', 0);
                              }}
                              className="text-gray-400 hover:text-red-400 hover:bg-red-900/20 p-1"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {/* In-State/Out-of-State Toggle */}
                          {selectedCollege.isPublic && (
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-white">Student Residency</Label>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={isInState ? "default" : "outline"}
                                  onClick={() => {
                                    setIsInState(true);
                                    updateField('isInState', true);
                                    handleCollegeSelect(selectedCollege);
                                  }}
                                  className={isInState ? "bg-purple-600 hover:bg-purple-700" : ""}
                                >
                                  In-State
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={!isInState ? "default" : "outline"}
                                  onClick={() => {
                                    setIsInState(false);
                                    updateField('isInState', false);
                                    handleCollegeSelect(selectedCollege);
                                  }}
                                  className={!isInState ? "bg-purple-600 hover:bg-purple-700" : ""}
                                >
                                  Out-of-State
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {/* Room & Board Toggle */}
                          <div className="flex items-center justify-between mb-3">
                            <Label className="text-white">Include Room & Board</Label>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={includeRoomBoard ? "default" : "outline"}
                                onClick={() => {
                                  setIncludeRoomBoard(true);
                                  updateField('includeRoomBoard', true);
                                  handleCollegeSelect(selectedCollege);
                                }}
                                className={includeRoomBoard ? "bg-purple-600 hover:bg-purple-700" : ""}
                              >
                                Yes
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={!includeRoomBoard ? "default" : "outline"}
                                onClick={() => {
                                  setIncludeRoomBoard(false);
                                  updateField('includeRoomBoard', false);
                                  handleCollegeSelect(selectedCollege);
                                }}
                                className={!includeRoomBoard ? "bg-purple-600 hover:bg-purple-700" : ""}
                              >
                                No
                              </Button>
                            </div>
                          </div>
                          
                          {/* Cost Breakdown */}
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between text-gray-300">
                              <span>Tuition & Fees:</span>
                              <span>
                                ${((selectedCollege.isPublic && isInState && selectedCollege.inStateTuition) 
                                  ? selectedCollege.inStateTuition 
                                  : selectedCollege.outOfStateTuition || selectedCollege.inStateTuition || 0
                                ).toLocaleString()}
                              </span>
                            </div>
                            {includeRoomBoard && selectedCollege.roomAndBoard && (
                              <div className="flex justify-between text-gray-300">
                                <span>Room & Board:</span>
                                <span>${selectedCollege.roomAndBoard.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-semibold text-white pt-2 border-t border-gray-700">
                              <span>Total Annual Cost:</span>
                              <span>${(formData.costPerYear || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}


                {/* Coverage Percentage */}
                <div className="space-y-2">
                  <Label className="text-white">
                    What percentage of costs do you plan to cover?
                  </Label>
                  {formData.costPerYear && formData.costPerYear > 0 && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Selected Annual Cost:</span>
                        <span className="text-lg font-semibold text-white">
                          ${formData.costPerYear.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center space-x-4">
                    <Slider
                      value={[formData.coverPercent]}
                      onValueChange={(value) => updateField('coverPercent', value[0])}
                      min={0}
                      max={100}
                      step={10}
                      className="flex-1"
                    />
                    <div className="w-16 text-right text-white font-medium">
                      {formData.coverPercent}%
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">
                    {formData.coverPercent < 100 && 
                      `The remaining ${100 - formData.coverPercent}% may come from other sources`
                    }
                  </p>
                </div>

                {/* Inflation Rate Notice */}
                <Alert className="bg-blue-900/10 border-blue-500/20">
                  <Info className="h-4 w-4 text-blue-400" />
                  <AlertDescription className="text-blue-200">
                    We assume an annual education inflation rate of 5% to project future costs
                  </AlertDescription>
                </Alert>
                
                {/* Navigation Footer */}
                <div className="mt-12 pt-6 border-t border-gray-800">
                  <div className="flex justify-between items-center">
                    <Button
                      onClick={() => setActiveTab('basic')}
                      variant="outline"
                      className="bg-gray-900/50 border-purple-500/50 hover:bg-purple-900/20 hover:border-purple-500 text-white transition-all"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back: Basic Info
                    </Button>
                    <div className="text-sm text-gray-400">
                      Step 2 of 4: Education Costs
                    </div>
                    <Button
                      onClick={() => setActiveTab('funding')}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Next: Funding
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Funding Tab */}
              <TabsContent value="funding" className="space-y-8">
                <Alert className="bg-purple-900/20 border-purple-500/20">
                  <Info className="h-4 w-4 text-purple-400" />
                  <AlertDescription className="text-purple-200">
                    Tell us about your current savings and how much you plan to contribute monthly. This helps calculate if you're on track.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* 529 Plan Account Selection */}
                  <div className="space-y-2">
                    <Label className="text-white text-base font-medium">529 Plan Account (optional)</Label>
                    <p className="text-sm text-gray-400">Choose from linked Plaid accounts or saved assets</p>
                    <Select
                      value={formData.selected529AssetId || ''}
                      onValueChange={(val) => {
                        const asset = merged529Options.find(a => a.id === val);
                        setFormData(prev => ({
                          ...prev,
                          selected529AssetId: val,
                          selected529AssetName: asset?.name,
                          // If no current savings entered, default from selected asset value
                          currentSavings: (prev.currentSavings && prev.currentSavings > 0) ? prev.currentSavings : (asset?.value || 0),
                          accountType: '529'
                        }));
                      }}
                    >
                      <SelectTrigger className="bg-gray-800/50 border-gray-700 focus:border-purple-500 text-white">
                        <SelectValue placeholder={merged529Options.length ? 'Select 529 account' : 'No 529 accounts found'} />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-white">
                        {merged529Options.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-400">No 529 plans found</div>
                        ) : (
                          merged529Options.map(a => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name} (${a.value.toLocaleString()})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    {typeof plaidData?.detectedMonthlyContribution === 'number' && plaidData.detectedMonthlyContribution > 0 && (
                      <div className="text-xs text-gray-400 mt-2 flex items-center gap-2">
                        Detected monthly contribution via Plaid: ${Number(plaidData.detectedMonthlyContribution).toLocaleString()}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-purple-500 text-purple-400 hover:bg-purple-900/20 hover:text-white"
                          onClick={() => updateField('monthlyContribution', Number(plaidData.detectedMonthlyContribution) || 0)}
                        >
                          Use
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Current Savings */}
                  <div className="space-y-2">
                    <Label htmlFor="currentSavings" className="text-white text-base font-medium">
                      Current 529 Plan Savings
                    </Label>
                    <p className="text-sm text-gray-400">Amount already saved for this goal</p>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                      <Input
                        id="currentSavings"
                        type="number"
                        min="0"
                        value={formData.currentSavings || ''}
                        onChange={(e) => updateField('currentSavings', parseFloat(e.target.value) || 0)}
                        className="pl-10 h-12 text-base bg-gray-800/50 border-gray-700 focus:border-purple-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Monthly Contribution */}
                  <div className="space-y-2">
                    <Label htmlFor="monthlyContribution" className="text-white text-base font-medium">
                      Monthly 529 Plan Contribution
                    </Label>
                    <p className="text-sm text-gray-400">How much will you save each month?</p>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                      <Input
                        id="monthlyContribution"
                        type="number"
                        min="0"
                        value={formData.monthlyContribution || ''}
                        onChange={(e) => updateField('monthlyContribution', parseFloat(e.target.value) || 0)}
                        className="pl-10 bg-gray-800/50 border-gray-700 focus:border-purple-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                </div>

                {/* Multiple Funding Sources */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-white text-base font-medium">
                      Funding Sources
                    </Label>
                    <Button
                      type="button"
                      onClick={addFundingSource}
                      variant="outline"
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600 hover:border-purple-700"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Source
                    </Button>
                  </div>
                  
                  <p className="text-sm text-gray-400">
                    Add all funding sources you plan to use for this education goal
                  </p>

                  <div className="space-y-3">
                    {(formData.fundingSources || []).map((source, index) => (
                      <Card key={index} className="bg-gray-800/50 border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-white">Source Type</Label>
                                <Select
                                  value={source.type}
                                  onValueChange={(value) => updateFundingSource(index, 'type', value)}
                                >
                                  <SelectTrigger className="bg-gray-800/50 border-gray-700 focus:border-purple-500 text-white">
                                    <SelectValue placeholder="Select source" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                    <SelectItem value="529">529 Plan</SelectItem>
                                    <SelectItem value="coverdell">Coverdell ESA</SelectItem>
                                    <SelectItem value="custodial">Custodial Account (UGMA/UTMA)</SelectItem>
                                    <SelectItem value="savings">Regular Savings</SelectItem>
                                    <SelectItem value="investment">Taxable Investment</SelectItem>
                                    <SelectItem value="scholarships">Scholarships/Grants</SelectItem>
                                    <SelectItem value="student_loan">Student Loans</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-white">Annual Amount</Label>
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                                  <Input
                                    type="number"
                                    min="0"
                                    value={source.amount || ''}
                                    onChange={(e) => updateFundingSource(index, 'amount', parseFloat(e.target.value) || 0)}
                                    className="pl-10 bg-gray-800/50 border-gray-700 focus:border-purple-500 text-white"
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            <Button
                              type="button"
                              onClick={() => removeFundingSource(index)}
                              variant="ghost"
                              size="icon"
                              className="text-red-400 hover:bg-red-900/20"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {/* Show loan-specific fields if student loan is selected */}
                          {source.type === 'student_loan' && (
                            <div className="mt-4 pt-4 border-t border-gray-700">
                              <Alert className="bg-amber-900/10 border-amber-500/20 mb-4">
                                <Info className="h-4 w-4 text-amber-400" />
                                <AlertDescription className="text-amber-200">
                                  Student loan details help calculate the total cost of borrowing and monthly repayment amounts.
                                </AlertDescription>
                              </Alert>
                              
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-white">Interest Rate (%)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value={formData.loanInterestRate || ''}
                                    onChange={(e) => updateField('loanInterestRate', parseFloat(e.target.value) || 0)}
                                    className="bg-gray-800/50 border-gray-700 focus:border-purple-500 text-white"
                                    placeholder="6.5"
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label className="text-white">Repayment Term</Label>
                                  <Select
                                    value={formData.loanRepaymentTerm?.toString() || '10'}
                                    onValueChange={(value) => updateField('loanRepaymentTerm', parseInt(value))}
                                  >
                                    <SelectTrigger className="bg-gray-800/50 border-gray-700 focus:border-purple-500 text-white">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                      <SelectItem value="5">5 years</SelectItem>
                                      <SelectItem value="10">10 years</SelectItem>
                                      <SelectItem value="15">15 years</SelectItem>
                                      <SelectItem value="20">20 years</SelectItem>
                                      <SelectItem value="25">25 years</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    
                    {(!formData.fundingSources || formData.fundingSources.length === 0) && (
                      <Card className="bg-gray-800/30 border-gray-700 border-dashed">
                        <CardContent className="p-8 text-center">
                          <DollarSign className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-400">No funding sources added yet</p>
                          <p className="text-sm text-gray-500 mt-1">Click "Add Source" to add funding options</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  
                  
                  {/* Total Funding Summary */}
                  {(formData.fundingSources && formData.fundingSources.length > 0) || (formData.monthlyContribution && formData.monthlyContribution > 0) ? (
                    <Card className="bg-purple-900/20 border-purple-500/30">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-purple-200 font-medium">Total Annual Funding</span>
                            <span className="text-2xl font-bold text-purple-400">
                              ${(
                                (formData.fundingSources?.reduce((sum, source) => sum + Number(source.amount || 0), 0) || 0) +
                                Number(formData.monthlyContribution || 0) * 12
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs text-purple-300 space-y-1 pt-2 border-t border-purple-500/20">
                            {formData.monthlyContribution && formData.monthlyContribution > 0 && (
                              <div className="flex justify-between">
                                <span>529 Plan Contributions:</span>
                                <span>${(Number(formData.monthlyContribution || 0) * 12).toLocaleString()}/year</span>
                              </div>
                            )}
                            {formData.fundingSources?.map((source, index) => (
                              <div key={index} className="flex justify-between">
                                <span>{source.type === 'scholarships' ? 'Scholarships/Grants' : source.type === 'student_loan' ? 'Student Loans' : source.type}:</span>
                                <span>${Number(source.amount || 0).toLocaleString()}/year</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
                
                {/* Navigation Footer */}
                <div className="mt-12 pt-6 border-t border-gray-800">
                  <div className="flex justify-between items-center">
                    <Button
                      onClick={() => setActiveTab('costs')}
                      variant="outline"
                      className="bg-gray-900/50 border-purple-500/50 hover:bg-purple-900/20 hover:border-purple-500 text-white transition-all"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back: Costs
                    </Button>
                    <div className="text-sm text-gray-400">
                      Step 3 of 4: Funding Sources
                    </div>
                    <Button
                      onClick={() => setActiveTab('investment')}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Next: Investment
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>

              </TabsContent>

              {/* Investment Tab */}
              <TabsContent value="investment" className="space-y-6">
                <div className="space-y-6">
                  {/* Time-Based Risk Guidance */}
                  {(() => {
                    const yearsToGoal = formData.startYear - currentYear;
                    let recommendedProfile = 'moderate';
                    let riskGuidance = '';
                    
                    if (yearsToGoal >= 15) {
                      recommendedProfile = 'aggressive';
                      riskGuidance = 'With 15+ years until education begins, an aggressive strategy can help maximize growth through market cycles.';
                    } else if (yearsToGoal >= 8) {
                      recommendedProfile = 'moderate';
                      riskGuidance = 'With 8-15 years remaining, a moderate approach balances growth potential with stability.';
                    } else if (yearsToGoal >= 3) {
                      recommendedProfile = 'conservative';
                      riskGuidance = 'With 3-8 years until education begins, protecting capital becomes more important than aggressive growth.';
                    } else {
                      recommendedProfile = 'conservative';
                      riskGuidance = 'With less than 3 years until education begins, preserving capital should be the primary focus.';
                    }
                    
                    return (
                      <Alert className="bg-blue-900/20 border-blue-500/20">
                        <TrendingUp className="h-4 w-4 text-blue-400" />
                        <AlertDescription className="text-blue-200">
                          <strong>Time-Based Recommendation:</strong> With {yearsToGoal} years until {formData.studentName}'s education begins, 
                          we recommend a <span className="font-semibold text-blue-400">{recommendedProfile}</span> investment approach. 
                          {riskGuidance}
                        </AlertDescription>
                      </Alert>
                    );
                  })()}

                  {/* Risk Profile */}
                  <div className="space-y-4">
                    <Label className="text-white">Investment Risk Profile</Label>
                    <RadioGroup
                      value={formData.riskProfile}
                      onValueChange={(value) => {
                        updateField('riskProfile', value);
                        // Auto-adjust expected return based on risk profile
                        const riskProfileReturns: { [key: string]: number } = {
                          'conservative': 4,
                          'moderate': 6,
                          'aggressive': 8,
                          'glide': 6 // Glide path starts with moderate baseline
                        };
                        if (riskProfileReturns[value] !== undefined) {
                          updateField('expectedReturn', riskProfileReturns[value]);
                        }
                      }}
                    >
                      {(() => {
                        const yearsToGoal = formData.startYear - currentYear;
                        let recommendedProfile = 'moderate';
                        
                        if (yearsToGoal >= 15) recommendedProfile = 'aggressive';
                        else if (yearsToGoal >= 8) recommendedProfile = 'moderate';
                        else recommendedProfile = 'conservative';
                        
                        return (
                          <>
                            <Card className={`bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-colors ${
                              recommendedProfile === 'conservative' ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900' : ''
                            }`}>
                              <CardContent className="p-4">
                                <div className="flex items-start space-x-2">
                                  <RadioGroupItem value="conservative" id="conservative" className="mt-1" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <Label htmlFor="conservative" className="text-white cursor-pointer">
                                        Conservative
                                      </Label>
                                      {recommendedProfile === 'conservative' && (
                                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                                          Recommended
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">
                                      Lower risk, lower expected returns (~4% annually)
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className={`bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-colors ${
                              recommendedProfile === 'moderate' ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900' : ''
                            }`}>
                              <CardContent className="p-4">
                                <div className="flex items-start space-x-2">
                                  <RadioGroupItem value="moderate" id="moderate" className="mt-1" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <Label htmlFor="moderate" className="text-white cursor-pointer">
                                        Moderate
                                      </Label>
                                      {recommendedProfile === 'moderate' && (
                                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                                          Recommended
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">
                                      Balanced risk and return (~6% annually)
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className={`bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-colors ${
                              recommendedProfile === 'aggressive' ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900' : ''
                            }`}>
                              <CardContent className="p-4">
                                <div className="flex items-start space-x-2">
                                  <RadioGroupItem value="aggressive" id="aggressive" className="mt-1" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <Label htmlFor="aggressive" className="text-white cursor-pointer">
                                        Aggressive
                                      </Label>
                                      {recommendedProfile === 'aggressive' && (
                                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                                          Recommended
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">
                                      Higher risk, higher expected returns (~8% annually)
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className={`bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-colors ${
                              yearsToGoal >= 10 ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-gray-900' : ''
                            }`}>
                              <CardContent className="p-4">
                                <div className="flex items-start space-x-2">
                                  <RadioGroupItem value="glide" id="glide" className="mt-1" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <Label htmlFor="glide" className="text-white cursor-pointer">
                                        Glide Path (Age-Based)
                                      </Label>
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">
                                      Automatically shifts from growth to conservative as college approaches
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Starts aggressive, gradually becomes conservative over time
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </>
                        );
                      })()}
                    </RadioGroup>
                  </div>

                  {/* Expected Return (Advanced) */}
                  <div className="space-y-2">
                    <Label className="text-white">
                      Expected Annual Return
                    </Label>
                    {formData.riskProfile === 'glide' ? (
                      <p className="text-sm text-gray-400">
                        Returns automatically adjust over time based on glide path strategy (starts ~8%, ends ~4%)
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">
                        Auto-adjusts based on risk profile selection, but can be manually fine-tuned
                      </p>
                    )}
                    <div className="flex items-center space-x-4">
                      <Slider
                        value={[formData.expectedReturn || 6]}
                        onValueChange={(value) => updateField('expectedReturn', value[0])}
                        min={0}
                        max={12}
                        step={0.5}
                        className="flex-1"
                        disabled={formData.riskProfile === 'glide'}
                      />
                      <div className="w-16 text-right text-white font-medium">
                        {formData.riskProfile === 'glide' ? 'Dynamic' : `${formData.expectedReturn}%`}
                      </div>
                    </div>
                  </div>

                  <Alert className="bg-yellow-900/10 border-yellow-500/20">
                    <Info className="h-4 w-4 text-yellow-400" />
                    <AlertDescription className="text-yellow-200">
                      Returns are not guaranteed. Consider using age-based portfolios that automatically 
                      become more conservative as the beneficiary approaches college age. Many 529 plans offer 
                      "glide path" options that adjust risk automatically based on the student's age.
                    </AlertDescription>
                  </Alert>
                  
                  {/* Additional guidance for mismatched risk profile */}
                  {(() => {
                    const yearsToGoal = formData.startYear - currentYear;
                    let recommendedProfile = 'moderate';
                    
                    if (yearsToGoal >= 15) recommendedProfile = 'aggressive';
                    else if (yearsToGoal >= 8) recommendedProfile = 'moderate';
                    else recommendedProfile = 'conservative';
                    
                    if (formData.riskProfile && formData.riskProfile !== recommendedProfile && formData.riskProfile !== 'glide') {
                      const isMoreAggressive = 
                        (formData.riskProfile === 'aggressive' && recommendedProfile !== 'aggressive') ||
                        (formData.riskProfile === 'moderate' && recommendedProfile === 'conservative');
                      
                      return (
                        <Alert className={`${isMoreAggressive ? 'bg-amber-900/20 border-amber-500/20' : 'bg-green-900/20 border-green-500/20'}`}>
                          <AlertTriangle className={`h-4 w-4 ${isMoreAggressive ? 'text-amber-400' : 'text-green-400'}`} />
                          <AlertDescription className={isMoreAggressive ? 'text-amber-200' : 'text-green-200'}>
                            {isMoreAggressive ? (
                              <>
                                Your selected risk profile is more aggressive than typically recommended for your time horizon. 
                                While this may increase growth potential, it also increases the risk of losses closer to when funds are needed.
                              </>
                            ) : (
                              <>
                                Your selected risk profile is more conservative than typically recommended for your time horizon. 
                                While this reduces risk, it may also limit growth potential over the long term.
                              </>
                            )}
                          </AlertDescription>
                        </Alert>
                      );
                    }
                    return null;
                  })()}
                </div>
                
                {/* Navigation Footer */}
                <div className="mt-12 pt-6 border-t border-gray-800">
                  <div className="flex justify-between items-center">
                    <Button
                      onClick={() => setActiveTab('funding')}
                      variant="outline"
                      className="bg-gray-900/50 border-purple-500/50 hover:bg-purple-900/20 hover:border-purple-500 text-white transition-all"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back: Funding
                    </Button>
                    <div className="text-sm text-gray-400">
                      Step 4 of 4: Investment Strategy
                    </div>
                    <div className="text-sm text-green-400 flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      Ready to save!
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-800 bg-gradient-to-r from-gray-900 to-purple-900/20">
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-gray-400">
                All projections are estimates and not guaranteed
              </p>
              <div className="flex justify-center gap-4">
                <Button 
                  onClick={onClose} 
                  variant="outline" 
                  size="lg"
                  className="border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500 px-8"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  size="lg"
                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20 hover:shadow-purple-700/30 transition-all px-8"
                >
                  {goal ? 'Update Goal' : 'Create Goal'}
                </Button>
              </div>
            </div>
          </div>
      </motion.div>
    </AnimatePresence>
  );
}
