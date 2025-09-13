import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, 
  Plus, 
  UserPlus,
  AlertCircle,
  Info,
  Edit,
  Trash2,
  Heart,
  Building,
  DollarSign,
  Percent
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EstateBeneficiary } from '@shared/schema';
import { formatCurrency } from '@/lib/utils';

interface BeneficiaryManagerProps {
  estatePlanId?: number;
}

export function BeneficiaryManager({ estatePlanId }: BeneficiaryManagerProps) {
  const [showAddBeneficiary, setShowAddBeneficiary] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<EstateBeneficiary | null>(null);
  const queryClient = useQueryClient();

  // Fetch beneficiaries
  const { data: beneficiaries = [], isLoading } = useQuery({
    queryKey: ['estate-beneficiaries', estatePlanId],
    queryFn: async () => {
      const url = estatePlanId 
        ? `/api/estate-beneficiaries?estatePlanId=${estatePlanId}`
        : '/api/estate-beneficiaries';
      const response = await fetch(url, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch beneficiaries');
      return response.json();
    },
  });

  // Create beneficiary mutation
  const createBeneficiaryMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/estate-beneficiaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...data, estatePlanId }),
      });
      if (!response.ok) throw new Error('Failed to create beneficiary');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estate-beneficiaries'] });
      setShowAddBeneficiary(false);
    },
  });

  // Update beneficiary mutation
  const updateBeneficiaryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/estate-beneficiaries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update beneficiary');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estate-beneficiaries'] });
      setEditingBeneficiary(null);
    },
  });

  // Delete beneficiary mutation
  const deleteBeneficiaryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/estate-beneficiaries/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete beneficiary');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estate-beneficiaries'] });
    },
  });

  // Fetch financial profile to check marital status
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
  
  const isMarried = profile?.maritalStatus === 'married';
  const spouseName = profile?.spouseName || 'Spouse';
  const userName = profile ? `${profile.firstName} ${profile.lastName}` : 'User';
  
  const BeneficiaryForm = ({ beneficiary }: { beneficiary?: EstateBeneficiary | null }) => {
    const [formData, setFormData] = useState({
      beneficiaryType: beneficiary?.beneficiaryType || 'individual',
      name: beneficiary?.name || '',
      relationship: beneficiary?.relationship || '',
      dateOfBirth: beneficiary?.dateOfBirth ? new Date(beneficiary.dateOfBirth).toISOString().split('T')[0] : '',
      distributionType: beneficiary?.distributionType || 'percentage',
      distributionPercentage: parseFloat(beneficiary?.distributionPercentage?.toString() || '0'),
      distributionAmount: beneficiary?.distributionAmount?.toString() || '',
      conditions: beneficiary?.conditions || '',
      ageRestriction: beneficiary?.ageRestriction || 0,
      isPrimary: beneficiary?.isPrimary ?? true,
      contactInfo: beneficiary?.contactInfo || { phone: '', email: '', address: '' },
      assignedBy: beneficiary?.assignedBy || 'user', // 'user' or 'spouse'
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const data = {
        ...formData,
        distributionPercentage: formData.distributionType === 'percentage' ? formData.distributionPercentage : null,
        distributionAmount: formData.distributionType === 'specific_amount' ? formData.distributionAmount : null,
        ageRestriction: formData.ageRestriction || null,
        assignedBy: isMarried ? formData.assignedBy : 'user',
      };
      
      if (beneficiary) {
        updateBeneficiaryMutation.mutate({ id: beneficiary.id, data });
      } else {
        createBeneficiaryMutation.mutate(data);
      }
    };

    const relationships = [
      'spouse', 'child', 'parent', 'sibling', 'grandchild', 
      'friend', 'charity', 'trust', 'other'
    ];

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {isMarried && (
          <div>
            <Label htmlFor="assignedBy" className="text-white">Assigned By</Label>
            <Select
              value={formData.assignedBy}
              onValueChange={(value) => setFormData({ ...formData, assignedBy: value })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{userName}</SelectItem>
                <SelectItem value="spouse">{spouseName}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="beneficiaryType" className="text-white">Type</Label>
            <Select
              value={formData.beneficiaryType}
              onValueChange={(value) => setFormData({ ...formData, beneficiaryType: value })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="charity">Charity</SelectItem>
                <SelectItem value="trust">Trust</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="isPrimary" className="text-white">Beneficiary Level</Label>
            <Select
              value={formData.isPrimary ? 'primary' : 'contingent'}
              onValueChange={(value) => setFormData({ ...formData, isPrimary: value === 'primary' })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="contingent">Contingent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="name" className="text-white">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="bg-gray-700 border-gray-600 text-white"
            placeholder="Full legal name"
            required
          />
        </div>

        {formData.beneficiaryType === 'individual' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="relationship" className="text-white">Relationship</Label>
              <Select
                value={formData.relationship}
                onValueChange={(value) => setFormData({ ...formData, relationship: value })}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {relationships.map((rel) => (
                    <SelectItem key={rel} value={rel}>
                      {rel.charAt(0).toUpperCase() + rel.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dateOfBirth" className="text-white">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="distributionType" className="text-white">Distribution Type</Label>
          <Select
            value={formData.distributionType}
            onValueChange={(value) => setFormData({ ...formData, distributionType: value })}
          >
            <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage</SelectItem>
              <SelectItem value="specific_amount">Specific Amount</SelectItem>
              <SelectItem value="specific_assets">Specific Assets</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.distributionType === 'percentage' && (
          <div>
            <Label htmlFor="distributionPercentage" className="text-white">
              Distribution Percentage: {formData.distributionPercentage}%
            </Label>
            <Slider
              id="distributionPercentage"
              min={0}
              max={100}
              step={5}
              value={[formData.distributionPercentage]}
              onValueChange={([value]) => setFormData({ ...formData, distributionPercentage: value })}
              className="mt-2"
            />
          </div>
        )}

        {formData.distributionType === 'specific_amount' && (
          <div>
            <Label htmlFor="distributionAmount" className="text-white">Distribution Amount</Label>
            <Input
              id="distributionAmount"
              type="number"
              value={formData.distributionAmount}
              onChange={(e) => setFormData({ ...formData, distributionAmount: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
              placeholder="0"
              min="0"
            />
          </div>
        )}

        <div>
          <Label htmlFor="conditions" className="text-white">Conditions (Optional)</Label>
          <Textarea
            id="conditions"
            value={formData.conditions}
            onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
            className="bg-gray-700 border-gray-600 text-white"
            placeholder="Any conditions or restrictions on the distribution"
            rows={3}
          />
        </div>

        {formData.beneficiaryType === 'individual' && (
          <div>
            <Label htmlFor="ageRestriction" className="text-white">
              Age Restriction: {formData.ageRestriction || 'None'}
            </Label>
            <Slider
              id="ageRestriction"
              min={0}
              max={40}
              step={1}
              value={[formData.ageRestriction]}
              onValueChange={([value]) => setFormData({ ...formData, ageRestriction: value })}
              className="mt-2"
            />
            <p className="text-xs text-gray-400 mt-1">
              Set to 0 for no age restriction
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => beneficiary ? setEditingBeneficiary(null) : setShowAddBeneficiary(false)}
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-[#8A00C4] hover:bg-[#7000A4]"
            disabled={createBeneficiaryMutation.isPending || updateBeneficiaryMutation.isPending}
          >
            {beneficiary ? 'Update' : 'Add'} Beneficiary
          </Button>
        </div>
      </form>
    );
  };

  // Separate beneficiaries by assignee if married
  const userBeneficiaries = beneficiaries.filter((b: EstateBeneficiary) => 
    !isMarried || b.assignedBy === 'user'
  );
  const spouseBeneficiaries = beneficiaries.filter((b: EstateBeneficiary) => 
    isMarried && b.assignedBy === 'spouse'
  );
  
  // Calculate total distribution percentages for each spouse
  const calculateTotalPercentage = (bens: EstateBeneficiary[]) => {
    return bens
      .filter((b: EstateBeneficiary) => b.distributionType === 'percentage' && b.isPrimary)
      .reduce((sum: number, b: EstateBeneficiary) => sum + parseFloat(b.distributionPercentage?.toString() || '0'), 0);
  };
  
  const userTotalPercentage = calculateTotalPercentage(userBeneficiaries);
  const spouseTotalPercentage = calculateTotalPercentage(spouseBeneficiaries);

  const primaryBeneficiaries = beneficiaries.filter((b: EstateBeneficiary) => b.isPrimary);
  const contingentBeneficiaries = beneficiaries.filter((b: EstateBeneficiary) => !b.isPrimary);

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">Loading beneficiaries...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Guidance Alert */}
      <Alert className="bg-purple-900/20 border-purple-800">
        <Info className="h-4 w-4 text-purple-400" />
        <AlertDescription className="text-gray-300">
          <strong>Looking to update beneficiaries for retirement accounts, life insurance, or bank accounts?</strong> 
          <span className="block mt-1">
            Go to <strong>Tab 2: "2. Ownership & Beneficiary"</strong> → Click <strong>"Beneficiary Sweep"</strong> button
            → Click <strong>"Add Beneficiaries"</strong> button next to each account.
          </span>
          <span className="block mt-2 text-sm">
            This section (Tab 6) is for managing estate distribution through your will or trust, not for account beneficiaries.
          </span>
        </AlertDescription>
      </Alert>
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">Beneficiary Management</h3>
          <p className="text-gray-400 text-sm mt-1">
            Manage your estate beneficiaries and distribution plans
          </p>
        </div>
        <Dialog open={showAddBeneficiary} onOpenChange={setShowAddBeneficiary}>
          <DialogTrigger asChild>
            <Button className="bg-[#8A00C4] hover:bg-[#7000A4]">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Beneficiary
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">Add New Beneficiary</DialogTitle>
            </DialogHeader>
            <BeneficiaryForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Distribution Summary */}
      {(userTotalPercentage > 0 || spouseTotalPercentage > 0) && (
        <div className="space-y-3">
          {userTotalPercentage > 0 && (
            <Alert className={userTotalPercentage !== 100 ? "bg-yellow-900/20 border-yellow-800" : "bg-green-900/20 border-green-800"}>
              <Info className={`h-4 w-4 ${userTotalPercentage !== 100 ? 'text-yellow-400' : 'text-green-400'}`} />
              <AlertDescription className="text-gray-300">
                {userName}'s primary beneficiary percentage: {userTotalPercentage}%
                {userTotalPercentage !== 100 && ` (Should equal 100%)`}
              </AlertDescription>
            </Alert>
          )}
          {isMarried && spouseTotalPercentage > 0 && (
            <Alert className={spouseTotalPercentage !== 100 ? "bg-yellow-900/20 border-yellow-800" : "bg-green-900/20 border-green-800"}>
              <Info className={`h-4 w-4 ${spouseTotalPercentage !== 100 ? 'text-yellow-400' : 'text-green-400'}`} />
              <AlertDescription className="text-gray-300">
                {spouseName}'s primary beneficiary percentage: {spouseTotalPercentage}%
                {spouseTotalPercentage !== 100 && ` (Should equal 100%)`}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Beneficiaries Display */}
      {!isMarried ? (
        // Single person view
        <>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Primary Beneficiaries
              </CardTitle>
            </CardHeader>
            <CardContent>
              {primaryBeneficiaries.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No primary beneficiaries added yet</p>
              ) : (
                <div className="space-y-3">
                  {primaryBeneficiaries.map((beneficiary: EstateBeneficiary) => (
                    <BeneficiaryCard 
                      key={beneficiary.id} 
                      beneficiary={beneficiary}
                      onEdit={setEditingBeneficiary}
                      onDelete={(id) => deleteBeneficiaryMutation.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-400" />
                Contingent Beneficiaries
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contingentBeneficiaries.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No contingent beneficiaries added yet</p>
              ) : (
                <div className="space-y-3">
                  {contingentBeneficiaries.map((beneficiary: EstateBeneficiary) => (
                    <BeneficiaryCard 
                      key={beneficiary.id} 
                      beneficiary={beneficiary}
                      onEdit={setEditingBeneficiary}
                      onDelete={(id) => deleteBeneficiaryMutation.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        // Married couple view - side by side
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User's Beneficiaries */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">{userName}'s Beneficiaries</h3>
              
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Primary Beneficiaries</CardTitle>
                </CardHeader>
                <CardContent>
                  {userBeneficiaries.filter((b: EstateBeneficiary) => b.isPrimary).length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No primary beneficiaries</p>
                  ) : (
                    <div className="space-y-2">
                      {userBeneficiaries.filter((b: EstateBeneficiary) => b.isPrimary).map((beneficiary: EstateBeneficiary) => (
                        <BeneficiaryCard 
                          key={beneficiary.id} 
                          beneficiary={beneficiary}
                          onEdit={setEditingBeneficiary}
                          onDelete={(id) => deleteBeneficiaryMutation.mutate(id)}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Contingent Beneficiaries</CardTitle>
                </CardHeader>
                <CardContent>
                  {userBeneficiaries.filter((b: EstateBeneficiary) => !b.isPrimary).length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No contingent beneficiaries</p>
                  ) : (
                    <div className="space-y-2">
                      {userBeneficiaries.filter((b: EstateBeneficiary) => !b.isPrimary).map((beneficiary: EstateBeneficiary) => (
                        <BeneficiaryCard 
                          key={beneficiary.id} 
                          beneficiary={beneficiary}
                          onEdit={setEditingBeneficiary}
                          onDelete={(id) => deleteBeneficiaryMutation.mutate(id)}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Spouse's Beneficiaries */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">{spouseName}'s Beneficiaries</h3>
              
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Primary Beneficiaries</CardTitle>
                </CardHeader>
                <CardContent>
                  {spouseBeneficiaries.filter((b: EstateBeneficiary) => b.isPrimary).length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No primary beneficiaries</p>
                  ) : (
                    <div className="space-y-2">
                      {spouseBeneficiaries.filter((b: EstateBeneficiary) => b.isPrimary).map((beneficiary: EstateBeneficiary) => (
                        <BeneficiaryCard 
                          key={beneficiary.id} 
                          beneficiary={beneficiary}
                          onEdit={setEditingBeneficiary}
                          onDelete={(id) => deleteBeneficiaryMutation.mutate(id)}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Contingent Beneficiaries</CardTitle>
                </CardHeader>
                <CardContent>
                  {spouseBeneficiaries.filter((b: EstateBeneficiary) => !b.isPrimary).length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No contingent beneficiaries</p>
                  ) : (
                    <div className="space-y-2">
                      {spouseBeneficiaries.filter((b: EstateBeneficiary) => !b.isPrimary).map((beneficiary: EstateBeneficiary) => (
                        <BeneficiaryCard 
                          key={beneficiary.id} 
                          beneficiary={beneficiary}
                          onEdit={setEditingBeneficiary}
                          onDelete={(id) => deleteBeneficiaryMutation.mutate(id)}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingBeneficiary} onOpenChange={(open) => !open && setEditingBeneficiary(null)}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Beneficiary</DialogTitle>
          </DialogHeader>
          <BeneficiaryForm beneficiary={editingBeneficiary} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Beneficiary Card Component
function BeneficiaryCard({ 
  beneficiary, 
  onEdit, 
  onDelete,
  compact = false 
}: { 
  beneficiary: EstateBeneficiary; 
  onEdit: (b: EstateBeneficiary) => void;
  onDelete: (id: number) => void;
  compact?: boolean;
}) {
  const getIcon = () => {
    switch (beneficiary.beneficiaryType) {
      case 'charity':
        return <Heart className="h-5 w-5 text-pink-400" />;
      case 'trust':
        return <Building className="h-5 w-5 text-blue-300" />;
      default:
        return <Users className="h-5 w-5 text-green-400" />;
    }
  };

  const getDistributionDisplay = () => {
    switch (beneficiary.distributionType) {
      case 'percentage':
        return (
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-gray-400" />
            <span className="text-white font-semibold">
              {beneficiary.distributionPercentage}%
            </span>
          </div>
        );
      case 'specific_amount':
        return (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <span className="text-white font-semibold">
              {formatCurrency(parseFloat(beneficiary.distributionAmount?.toString() || '0'))}
            </span>
          </div>
        );
      default:
        return <span className="text-gray-400">Specific Assets</span>;
    }
  };

  return (
    <div className={`bg-gray-700/30 rounded-lg ${compact ? 'p-3' : 'p-4'} flex items-center justify-between`}>
      <div className="flex items-start gap-2">
        {!compact && getIcon()}
        <div className="flex-1">
          <h4 className={`text-white ${compact ? 'text-sm' : ''} font-medium`}>{beneficiary.name}</h4>
          <div className={`flex flex-wrap gap-2 mt-1 ${compact ? 'text-xs' : 'text-sm'} text-gray-400`}>
            {beneficiary.relationship && (
              <span>{beneficiary.relationship.charAt(0).toUpperCase() + beneficiary.relationship.slice(1)}</span>
            )}
            {beneficiary.ageRestriction && beneficiary.ageRestriction > 0 && (
              <span className="text-yellow-400">Age {beneficiary.ageRestriction}+</span>
            )}
          </div>
          {!compact && beneficiary.conditions && (
            <p className="text-sm text-gray-400 mt-2">{beneficiary.conditions}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={compact ? 'text-sm' : ''}>
          {getDistributionDisplay()}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size={compact ? 'sm' : 'icon'}
            onClick={() => onEdit(beneficiary)}
            className="text-gray-400 hover:text-white"
          >
            <Edit className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
          </Button>
          <Button
            variant="ghost"
            size={compact ? 'sm' : 'icon'}
            onClick={() => onDelete(beneficiary.id)}
            className="text-gray-400 hover:text-red-400"
          >
            <Trash2 className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
          </Button>
        </div>
      </div>
    </div>
  );
}