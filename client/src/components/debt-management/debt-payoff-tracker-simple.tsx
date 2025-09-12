import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Debt {
  id: number;
  debtName: string;
  debtType: string;
  currentBalance: number | string;
  annualInterestRate: number | string;
  minimumPayment: number | string;
  status?: string;
}

interface DebtPayoffTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  debts: Debt[];
  onDebtsUpdate?: () => void;
}

export function DebtPayoffTracker({ isOpen, onClose, debts }: DebtPayoffTrackerProps) {
  console.log('DebtPayoffTracker render:', { isOpen, debtsCount: debts?.length });
  
  if (!isOpen) {
    console.log('Modal not open, returning null');
    return null;
  }

  console.log('Rendering modal content');
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={(e) => {
        console.log('Backdrop clicked');
        e.stopPropagation();
      }}
    >
      <div 
        className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => {
          console.log('Modal content clicked');
          e.stopPropagation();
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-black">Debt Payoff Strategy</h2>
          <Button 
            onClick={() => {
              console.log('Close button clicked');
              onClose();
            }} 
            variant="ghost" 
            size="icon"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="space-y-4">
          <p className="text-gray-600">
            Modal is working! Total Debts: {debts?.filter(d => d.status !== 'paid_off').length || 0}
          </p>
          
          {debts?.filter(d => d.status !== 'paid_off').map((debt, index) => (
            <div key={debt.id} className="border p-4 rounded-lg">
              <h3 className="font-semibold text-black">
                #{index + 1}: {debt.debtName}
              </h3>
              <p className="text-gray-700">
                Balance: {formatCurrency(typeof debt.currentBalance === 'string' ? parseFloat(debt.currentBalance) : debt.currentBalance)}
              </p>
              <p className="text-gray-700">Rate: {debt.annualInterestRate}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}