import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Target, TrendingUp, Calendar } from 'lucide-react';

interface QuickEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editType: 'income' | 'retirement' | 'risk' | null;
  currentData: any;
  onSave: (data: any) => void;
}

interface FormData {
  annualIncome?: number;
  spouseAnnualIncome?: number;
  desiredRetirementAge?: number;
  spouseDesiredRetirementAge?: number;
  currentAllocation?: {
    usStocks: number;
    intlStocks: number;
    bonds: number;
    alternatives: number;
    cash: number;
  };
}

export function QuickEditModal({ isOpen, onClose, editType, currentData, onSave }: QuickEditModalProps) {
  const { register, handleSubmit, setValue, watch, reset } = useForm<FormData>();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && currentData) {
      // Pre-populate form with current data
      if (editType === 'income') {
        setValue('annualIncome', currentData.annualIncome || 0);
        setValue('spouseAnnualIncome', currentData.spouseAnnualIncome || 0);
      } else if (editType === 'retirement') {
        setValue('desiredRetirementAge', currentData.desiredRetirementAge || 65);
        setValue('spouseDesiredRetirementAge', currentData.spouseDesiredRetirementAge || 65);
      } else if (editType === 'risk') {
        setValue('currentAllocation', currentData.currentAllocation || {
          usStocks: 60,
          intlStocks: 20,
          bonds: 15,
          alternatives: 3,
          cash: 2
        });
      }
    }
  }, [isOpen, currentData, editType, setValue]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await onSave(data);
      toast({
        title: "Profile Updated",
        description: "Your financial profile has been successfully updated.",
      });
      onClose();
      reset();
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "There was an error updating your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModalConfig = () => {
    switch (editType) {
      case 'income':
        return {
          title: 'Update Income Information',
          icon: DollarSign,
          description: 'Update your household income details'
        };
      case 'retirement':
        return {
          title: 'Update Retirement Plans',
          icon: Target,
          description: 'Adjust your retirement timeline'
        };
      case 'risk':
        return {
          title: 'Update Investment Allocation',
          icon: TrendingUp,
          description: 'Modify your current asset allocation'
        };
      default:
        return {
          title: 'Quick Edit',
          icon: Calendar,
          description: 'Update your information'
        };
    }
  };

  const config = getModalConfig();
  const IconComponent = config.icon;

  // Validate allocation totals to 100%
  const watchedAllocation = watch('currentAllocation');
  const allocationTotal = watchedAllocation ? 
    Object.values(watchedAllocation).reduce((sum, val) => sum + (val || 0), 0) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <IconComponent className="w-5 h-5 text-[#B040FF]" />
            {config.title}
          </DialogTitle>
          <p className="text-gray-400 text-sm">{config.description}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {editType === 'income' && (
            <>
              <div>
                <Label htmlFor="annualIncome" className="text-white">Annual Income</Label>
                <Input
                  id="annualIncome"
                  type="number"
                  placeholder="$0"
                  {...register('annualIncome', { valueAsNumber: true })}
                  className="bg-gray-800 border-gray-700 text-white focus:border-[#B040FF]"
                />
              </div>
              
              {currentData?.maritalStatus === 'married' && (
                <div>
                  <Label htmlFor="spouseAnnualIncome" className="text-white">Spouse Annual Income</Label>
                  <Input
                    id="spouseAnnualIncome"
                    type="number"
                    placeholder="$0"
                    {...register('spouseAnnualIncome', { valueAsNumber: true })}
                    className="bg-gray-800 border-gray-700 text-white focus:border-[#B040FF]"
                  />
                </div>
              )}
            </>
          )}

          {editType === 'retirement' && (
            <>
              <div>
                <Label htmlFor="desiredRetirementAge" className="text-white">Desired Retirement Age</Label>
                <Input
                  id="desiredRetirementAge"
                  type="number"
                  min="50"
                  max="80"
                  {...register('desiredRetirementAge', { valueAsNumber: true })}
                  className="bg-gray-800 border-gray-700 text-white focus:border-[#B040FF]"
                />
              </div>
              
              {currentData?.maritalStatus === 'married' && (
                <div>
                  <Label htmlFor="spouseDesiredRetirementAge" className="text-white">Spouse Retirement Age</Label>
                  <Input
                    id="spouseDesiredRetirementAge"
                    type="number"
                    min="50"
                    max="80"
                    {...register('spouseDesiredRetirementAge', { valueAsNumber: true })}
                    className="bg-gray-800 border-gray-700 text-white focus:border-[#B040FF]"
                  />
                </div>
              )}
            </>
          )}

          {editType === 'risk' && (
            <>
              <div className="space-y-3">
                <Label className="text-white">Current Asset Allocation (%)</Label>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="usStocks" className="text-sm text-gray-300">US Stocks</Label>
                    <Input
                      id="usStocks"
                      type="number"
                      min="0"
                      max="100"
                      {...register('currentAllocation.usStocks', { valueAsNumber: true })}
                      className="bg-gray-800 border-gray-700 text-white focus:border-[#B040FF]"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="intlStocks" className="text-sm text-gray-300">International Stocks</Label>
                    <Input
                      id="intlStocks"
                      type="number"
                      min="0"
                      max="100"
                      {...register('currentAllocation.intlStocks', { valueAsNumber: true })}
                      className="bg-gray-800 border-gray-700 text-white focus:border-[#B040FF]"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="bonds" className="text-sm text-gray-300">Bonds</Label>
                    <Input
                      id="bonds"
                      type="number"
                      min="0"
                      max="100"
                      {...register('currentAllocation.bonds', { valueAsNumber: true })}
                      className="bg-gray-800 border-gray-700 text-white focus:border-[#B040FF]"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="alternatives" className="text-sm text-gray-300">Alternatives</Label>
                    <Input
                      id="alternatives"
                      type="number"
                      min="0"
                      max="100"
                      {...register('currentAllocation.alternatives', { valueAsNumber: true })}
                      className="bg-gray-800 border-gray-700 text-white focus:border-[#B040FF]"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label htmlFor="cash" className="text-sm text-gray-300">Cash</Label>
                    <Input
                      id="cash"
                      type="number"
                      min="0"
                      max="100"
                      {...register('currentAllocation.cash', { valueAsNumber: true })}
                      className="bg-gray-800 border-gray-700 text-white focus:border-[#B040FF]"
                    />
                  </div>
                </div>
                
                <div className={`text-sm ${allocationTotal === 100 ? 'text-green-400' : 'text-yellow-400'}`}>
                  Total: {allocationTotal.toFixed(1)}% {allocationTotal !== 100 && '(should equal 100%)'}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-gray-800 text-white border-gray-600 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (editType === 'risk' && allocationTotal !== 100)}
              className="flex-1 bg-[#B040FF] hover:bg-[#a020f0] text-white"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}