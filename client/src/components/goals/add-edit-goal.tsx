import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Target, 
  Save,
  X,
  Home,
  GraduationCap,
  Plane,
  Heart,
  MoreHorizontal,
  DollarSign,
  Calendar,
  TrendingUp,
  Shield,
  Info,
  Trash2
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Goal, InsertGoal } from '@shared/schema';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Goal templates with CFP Board default assumptions
const goalTemplates = {
  retirement: {
    type: 'retirement',
    description: 'Retirement',
    inflationAssumptionPct: '2.5',
    riskPreference: 'moderate',
    successThresholdPct: '85',
    icon: Target,
    defaults: {
      targetAmountToday: 2000000,
      yearsToGoal: 30
    }
  },
  college: {
    type: 'college',
    description: 'College Education Fund',
    inflationAssumptionPct: '5.0', // Higher for education
    riskPreference: 'moderate',
    successThresholdPct: '80',
    icon: GraduationCap,
    defaults: {
      targetAmountToday: 150000,
      yearsToGoal: 18
    }
  },
  home: {
    type: 'home',
    description: 'Home Purchase',
    inflationAssumptionPct: '3.0',
    riskPreference: 'conservative',
    successThresholdPct: '90',
    icon: Home,
    defaults: {
      targetAmountToday: 100000,
      yearsToGoal: 5
    }
  },
  travel: {
    type: 'travel',
    description: 'Dream Vacation',
    inflationAssumptionPct: '2.5',
    riskPreference: 'moderate',
    successThresholdPct: '70',
    icon: Plane,
    defaults: {
      targetAmountToday: 25000,
      yearsToGoal: 3
    }
  },
  healthcare: {
    type: 'healthcare',
    description: 'Healthcare Reserve',
    inflationAssumptionPct: '4.0', // Higher for healthcare
    riskPreference: 'conservative',
    successThresholdPct: '90',
    icon: Heart,
    defaults: {
      targetAmountToday: 300000,
      yearsToGoal: 20
    }
  },
  custom: {
    type: 'custom',
    description: '',
    inflationAssumptionPct: '2.5',
    riskPreference: 'moderate',
    successThresholdPct: '70',
    icon: MoreHorizontal,
    defaults: {
      targetAmountToday: 50000,
      yearsToGoal: 10
    }
  }
};

interface AddEditGoalProps {
  goal: Goal | null;
  onSave: () => void;
  onCancel: () => void;
}

export function AddEditGoal({ goal, onSave, onCancel }: AddEditGoalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!goal;

  // Calculate default target date
  const getDefaultTargetDate = (yearsToGoal: number) => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + yearsToGoal);
    return date.toISOString().split('T')[0];
  };

  // Form state
  const [formData, setFormData] = useState({
    type: goal?.type || 'custom',
    description: goal?.description || '',
    targetAmountToday: goal?.targetAmountToday?.toString() || '50000',
    targetDate: goal?.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : getDefaultTargetDate(10),
    inflationAssumptionPct: goal?.inflationAssumptionPct?.toString() || '2.5',
    priority: goal?.priority || 1,
    currentSavings: goal?.currentSavings?.toString() || '0',
    riskPreference: goal?.riskPreference || 'moderate',
    successThresholdPct: goal?.successThresholdPct?.toString() || '70',
    notes: goal?.notes || ''
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Create/Update mutation
  const saveGoalMutation = useMutation({
    mutationFn: async (data: Partial<InsertGoal>) => {
      const url = isEditing ? `/api/goals/${goal.id}` : '/api/goals';
      const method = isEditing ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error('Failed to save goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      onSave();
    },
  });

  // Delete mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/goals/${goal!.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to delete goal');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      onSave(); // This will close the edit form and go back to overview
    },
  });

  // Handle delete
  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    deleteGoalMutation.mutate();
    setShowDeleteDialog(false);
  };

  // Apply template
  const applyTemplate = (templateKey: string) => {
    const template = goalTemplates[templateKey as keyof typeof goalTemplates];
    if (template) {
      setFormData({
        ...formData,
        type: template.type,
        description: template.description,
        targetAmountToday: template.defaults.targetAmountToday.toString(),
        targetDate: getDefaultTargetDate(template.defaults.yearsToGoal),
        inflationAssumptionPct: template.inflationAssumptionPct,
        riskPreference: template.riskPreference,
        successThresholdPct: template.successThresholdPct
      });
      setSelectedTemplate(templateKey);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const goalData: Partial<InsertGoal> = {
      type: formData.type,
      description: formData.description,
      targetAmountToday: formData.targetAmountToday,
      targetDate: new Date(formData.targetDate).toISOString() as any, // Convert to ISO string for JSON
      inflationAssumptionPct: formData.inflationAssumptionPct,
      priority: formData.priority,
      currentSavings: formData.currentSavings,
      riskPreference: formData.riskPreference,
      successThresholdPct: formData.successThresholdPct,
      notes: formData.notes || undefined
    };

    saveGoalMutation.mutate(goalData);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl text-white">
              {isEditing ? 'Edit Goal' : 'Add New Goal'}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Template Selection (only for new goals) */}
          {!isEditing && (
            <div className="mb-6">
              <Label className="text-white mb-3 block">Choose a Goal Template</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(goalTemplates).map(([key, template]) => {
                  const Icon = template.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyTemplate(key)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedTemplate === key
                          ? 'border-[#8A00C4] bg-[#8A00C4]/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-700/30'
                      }`}
                    >
                      <Icon className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="text-white text-sm font-medium">{template.description || 'Custom Goal'}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Goal Description */}
            <div>
              <Label htmlFor="description" className="text-white">Goal Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="e.g., Comfortable retirement by age 65"
                required
              />
            </div>

            {/* Target Amount and Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="targetAmount" className="text-white">
                  Target Amount (Today's Dollars)
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="targetAmount"
                    type="number"
                    value={formData.targetAmountToday}
                    onChange={(e) => setFormData({ ...formData, targetAmountToday: e.target.value })}
                    className="bg-gray-700 border-gray-600 text-white pl-10"
                    placeholder="0"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="targetDate" className="text-white">Target Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="targetDate"
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    className="bg-gray-700 border-gray-600 text-white pl-10"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Current Savings and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="currentSavings" className="text-white">
                  Current Savings
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="currentSavings"
                    type="number"
                    value={formData.currentSavings}
                    onChange={(e) => setFormData({ ...formData, currentSavings: e.target.value })}
                    className="bg-gray-700 border-gray-600 text-white pl-10"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="priority" className="text-white">Priority (1 = Highest)</Label>
                <Select
                  value={formData.priority.toString()}
                  onValueChange={(value) => setFormData({ ...formData, priority: parseInt(value) })}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(num => (
                      <SelectItem key={num} value={num.toString()}>
                        Priority {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Risk Preference and Inflation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="riskPreference" className="text-white">Risk Preference</Label>
                <Select
                  value={formData.riskPreference}
                  onValueChange={(value) => setFormData({ ...formData, riskPreference: value })}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="inflation" className="text-white">
                  Inflation Assumption: {formData.inflationAssumptionPct}%
                </Label>
                <Slider
                  id="inflation"
                  min={0}
                  max={10}
                  step={0.5}
                  value={[parseFloat(formData.inflationAssumptionPct)]}
                  onValueChange={([value]) => 
                    setFormData({ ...formData, inflationAssumptionPct: value.toString() })
                  }
                  className="mt-2"
                />
              </div>
            </div>

            {/* Success Threshold */}
            <div>
              <Label htmlFor="successThreshold" className="text-white">
                Success Threshold: {formData.successThresholdPct}%
              </Label>
              <Slider
                id="successThreshold"
                min={50}
                max={95}
                step={5}
                value={[parseFloat(formData.successThresholdPct)]}
                onValueChange={([value]) => 
                  setFormData({ ...formData, successThresholdPct: value.toString() })
                }
                className="mt-2"
              />
              <p className="text-gray-400 text-sm mt-1">
                Minimum probability of success you're comfortable with
              </p>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes" className="text-white">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Additional details about this goal..."
                rows={3}
              />
            </div>

            {/* CFP Board Disclosure */}
            <Alert className="bg-blue-900/20 border-blue-800">
              <Info className="h-4 w-4 text-blue-300" />
              <AlertDescription className="text-gray-300">
                Default assumptions based on CFP Board Practice Standards. 
                Adjust based on your specific circumstances.
              </AlertDescription>
            </Alert>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveGoalMutation.isPending}
                className="bg-[#8A00C4] hover:bg-[#7000A4]"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveGoalMutation.isPending ? 'Saving...' : (isEditing ? 'Update Goal' : 'Create Goal')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}