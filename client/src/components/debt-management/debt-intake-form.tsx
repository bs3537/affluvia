import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus,
  Trash2,
  Edit,
  CreditCard,
  Home,
  Car,
  GraduationCap,
  User,
  DollarSign,
  Percent,
  Calendar,
  AlertCircle,
  CheckCircle,
  Info
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Debt {
  id: number;
  debtName: string;
  debtType: string;
  currentBalance: number | string;
  annualInterestRate: number | string;
  minimumPayment: number | string;
  status: string;
  owner?: string;
  lender?: string;
  paymentDueDate?: number;
  notes?: string;
}

interface DebtIntakeFormProps {
  debts: Debt[];
  onDebtAdded: () => void;
  readOnly?: boolean;
}

export function DebtIntakeForm({ debts, onDebtAdded, readOnly = false }: DebtIntakeFormProps) {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [formData, setFormData] = useState({
    debtName: "",
    debtType: "credit_card",
    owner: "user",
    lender: "",
    currentBalance: "",
    annualInterestRate: "",
    minimumPayment: "",
    paymentDueDate: "",
    creditLimit: "",
  });

  // Add debt mutation
  const addDebtMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to add debt");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      setIsAddDialogOpen(false);
      resetForm();
      onDebtAdded();
    },
  });

  // Update debt mutation
  const updateDebtMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/debts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update debt");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      setEditingDebt(null);
      resetForm();
    },
  });

  // Delete debt mutation
  const deleteDebtMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/debts/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete debt");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
    },
  });

  const resetForm = () => {
    setFormData({
      debtName: "",
      debtType: "credit_card",
      owner: "user",
      lender: "",
      currentBalance: "",
      annualInterestRate: "",
      minimumPayment: "",
      paymentDueDate: "",
      creditLimit: "",
    });
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      currentBalance: parseFloat(formData.currentBalance),
      annualInterestRate: parseFloat(formData.annualInterestRate),
      minimumPayment: parseFloat(formData.minimumPayment),
      paymentDueDate: formData.paymentDueDate ? parseInt(formData.paymentDueDate) : null,
      creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : null,
    };

    if (editingDebt) {
      updateDebtMutation.mutate({ id: editingDebt.id, data });
    } else {
      addDebtMutation.mutate(data);
    }
  };

  const getDebtIcon = (type: string) => {
    switch (type) {
      case 'mortgage': return Home;
      case 'auto_loan': return Car;
      case 'federal_student_loan':
      case 'private_student_loan': return GraduationCap;
      case 'credit_card': return CreditCard;
      default: return DollarSign;
    }
  };

  const getDebtColor = (type: string) => {
    switch (type) {
      case 'mortgage': return 'text-green-400';
      case 'auto_loan': return 'text-blue-400';
      case 'federal_student_loan':
      case 'private_student_loan': return 'text-purple-400';
      case 'credit_card': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const activeDebts = debts.filter(d => d.status === 'active');
  const paidOffDebts = debts.filter(d => d.status === 'paid_off');

  return (
    <div className="space-y-6">
      {/* Sync Info Message for Read-Only Mode */}
      {readOnly && activeDebts.length > 0 && (
        <Card className="bg-blue-900/20 border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-medium mb-1">These debts are synced from your intake form</p>
                <p className="text-gray-400">
                  To update your debts, please modify them in the intake form and click the "Refresh" icon to refresh.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Debts List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Active Debts</h3>
        {activeDebts.length === 0 ? (
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">No active debts found</p>
              <p className="text-sm text-gray-500 mt-1">
                {readOnly 
                  ? "Complete the intake form to add your debts, then sync them here" 
                  : "Click 'Add Debt' to get started"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {activeDebts.map((debt) => {
              const Icon = getDebtIcon(debt.debtType);
              const colorClass = getDebtColor(debt.debtType);
              const currentBalance = typeof debt.currentBalance === 'string' ? parseFloat(debt.currentBalance) : debt.currentBalance;
              const utilization = debt.debtType === 'credit_card' && (debt as any).creditLimit
                ? (currentBalance / (debt as any).creditLimit) * 100
                : 0;

              return (
                <Card key={debt.id} className="bg-gray-900 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 bg-gray-800 rounded-lg ${colorClass}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-white">{debt.debtName}</p>
                            {debt.owner === 'spouse' && (
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                                Spouse
                              </Badge>
                            )}
                            {debt.owner === 'joint' && (
                              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                                Joint
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>{debt.lender || 'Unknown Lender'}</span>
                            {debt.paymentDueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Due: {debt.paymentDueDate}th
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">
                            {formatCurrency(typeof debt.currentBalance === 'string' ? parseFloat(debt.currentBalance) : debt.currentBalance)}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Percent className="w-3 h-3" />
                              {typeof debt.annualInterestRate === 'string' ? parseFloat(debt.annualInterestRate) : debt.annualInterestRate}%
                            </span>
                            <span>•</span>
                            <span>{formatCurrency(typeof debt.minimumPayment === 'string' ? parseFloat(debt.minimumPayment) : debt.minimumPayment)}/mo</span>
                          </div>
                          {utilization > 0 && (
                            <div className="mt-1">
                              <span className={`text-xs ${
                                utilization > 70 ? 'text-red-400' : 
                                utilization > 30 ? 'text-yellow-400' : 
                                'text-green-400'
                              }`}>
                                {utilization.toFixed(0)}% utilized
                              </span>
                            </div>
                          )}
                        </div>

                        {!readOnly && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingDebt(debt);
                                setFormData({
                                  debtName: debt.debtName,
                                  debtType: debt.debtType,
                                  owner: debt.owner,
                                  lender: debt.lender || "",
                                  currentBalance: debt.currentBalance.toString(),
                                  annualInterestRate: debt.annualInterestRate.toString(),
                                  minimumPayment: debt.minimumPayment.toString(),
                                  paymentDueDate: debt.paymentDueDate?.toString() || "",
                                  creditLimit: (debt as any).creditLimit?.toString() || "",
                                });
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteDebtMutation.mutate(debt.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Paid Off Debts */}
      {paidOffDebts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Paid Off Debts
          </h3>
          <div className="grid gap-3">
            {paidOffDebts.map((debt) => {
              const Icon = getDebtIcon(debt.debtType);
              return (
                <Card key={debt.id} className="bg-green-900/10 border-green-800/50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-green-400" />
                        <div>
                          <p className="font-medium text-white line-through opacity-75">
                            {debt.debtName}
                          </p>
                          <p className="text-sm text-gray-400">
                            Original: {formatCurrency((debt as any).originalBalance || debt.currentBalance)}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                        PAID OFF
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Debt Dialog */}
      {!readOnly && (
        <Dialog open={isAddDialogOpen || !!editingDebt} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingDebt(null);
            resetForm();
          } else {
            setIsAddDialogOpen(true);
          }
        }}>
        <DialogTrigger asChild>
          <Button className="w-full bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Add New Debt
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingDebt ? 'Edit Debt' : 'Add New Debt'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter the details of your debt to include it in your payoff plan
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="debtName" className="text-white">Debt Name</Label>
                <Input
                  id="debtName"
                  value={formData.debtName}
                  onChange={(e) => setFormData({ ...formData, debtName: e.target.value })}
                  placeholder="e.g., Chase Visa"
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>

              <div>
                <Label htmlFor="debtType" className="text-white">Debt Type</Label>
                <Select
                  value={formData.debtType}
                  onValueChange={(value) => setFormData({ ...formData, debtType: value })}
                >
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="federal_student_loan">Federal Student Loan</SelectItem>
                    <SelectItem value="private_student_loan">Private Student Loan</SelectItem>
                    <SelectItem value="auto_loan">Auto Loan</SelectItem>
                    <SelectItem value="personal_loan">Personal Loan</SelectItem>
                    <SelectItem value="mortgage">Mortgage</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="owner" className="text-white">Owner</Label>
                <Select
                  value={formData.owner}
                  onValueChange={(value) => setFormData({ ...formData, owner: value })}
                >
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="user">Me</SelectItem>
                    <SelectItem value="spouse">Spouse</SelectItem>
                    <SelectItem value="joint">Joint</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="lender" className="text-white">Lender (Optional)</Label>
                <Input
                  id="lender"
                  value={formData.lender}
                  onChange={(e) => setFormData({ ...formData, lender: e.target.value })}
                  placeholder="e.g., Chase Bank"
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="currentBalance" className="text-white">Current Balance</Label>
                <Input
                  id="currentBalance"
                  type="number"
                  value={formData.currentBalance}
                  onChange={(e) => setFormData({ ...formData, currentBalance: e.target.value })}
                  placeholder="0.00"
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>

              <div>
                <Label htmlFor="annualInterestRate" className="text-white">Interest Rate (%)</Label>
                <Input
                  id="annualInterestRate"
                  type="number"
                  step="0.01"
                  value={formData.annualInterestRate}
                  onChange={(e) => setFormData({ ...formData, annualInterestRate: e.target.value })}
                  placeholder="18.99"
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>

              <div>
                <Label htmlFor="minimumPayment" className="text-white">Min Payment</Label>
                <Input
                  id="minimumPayment"
                  type="number"
                  value={formData.minimumPayment}
                  onChange={(e) => setFormData({ ...formData, minimumPayment: e.target.value })}
                  placeholder="0.00"
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="paymentDueDate" className="text-white">Payment Due Day (Optional)</Label>
                <Input
                  id="paymentDueDate"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.paymentDueDate}
                  onChange={(e) => setFormData({ ...formData, paymentDueDate: e.target.value })}
                  placeholder="15"
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>

              {formData.debtType === 'credit_card' && (
                <div>
                  <Label htmlFor="creditLimit" className="text-white">Credit Limit (Optional)</Label>
                  <Input
                    id="creditLimit"
                    type="number"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                    placeholder="0.00"
                    className="bg-gray-900 border-gray-700 text-white"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsAddDialogOpen(false);
                setEditingDebt(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleSubmit}
              disabled={!formData.debtName || !formData.currentBalance || !formData.annualInterestRate || !formData.minimumPayment}
            >
              {editingDebt ? 'Update Debt' : 'Add Debt'}
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
