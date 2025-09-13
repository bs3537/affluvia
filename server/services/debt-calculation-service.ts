import { db } from '../db';
import { debts, debtPayments } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface DebtPayoffScheduleItem {
  month: number;
  debtName: string;
  payment: number;
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
}

export interface DebtPayoffResult {
  totalMonths: number;
  totalInterestPaid: number;
  totalAmountPaid: number;
  effectiveDate: Date;
  schedule: DebtPayoffScheduleItem[];
  strategyUsed: 'avalanche' | 'snowball' | 'hybrid' | 'custom';
  debtFreeDate: Date;
  savingsVsMinimum: number;
}

export interface DebtInfo {
  id: number;
  debtName: string;
  currentBalance: number;
  annualInterestRate: number;
  minimumPayment: number;
  extraPayment?: number;
  isPromotionalRate?: boolean;
  promotionalRate?: number;
  promotionalRateEndDate?: string;
}

export class DebtCalculationService {
  private static readonly MAX_PAYOFF_MONTHS = 600; // 50 years max
  private static readonly CALCULATION_PRECISION = 2;

  /**
   * Calculate optimal payoff order based on strategy
   */
  static getPayoffOrder(
    debts: DebtInfo[],
    strategy: 'avalanche' | 'snowball' | 'hybrid',
    customOrder?: number[],
    hybridConfig?: {
      quickWinCount?: number;
      switchTrigger?: 'afterWins' | 'afterMonths' | 'whenInterestSaved';
      switchValue?: number;
      excludeTypes?: string[];
    }
  ): DebtInfo[] {
    if (customOrder && customOrder.length > 0) {
      return customOrder
        .map(id => debts.find(d => d.id === id))
        .filter(Boolean) as DebtInfo[];
    }

    // Filter out excluded debt types if specified
    let eligibleDebts = [...debts];
    if (hybridConfig?.excludeTypes && hybridConfig.excludeTypes.length > 0) {
      eligibleDebts = debts.filter(d => !hybridConfig.excludeTypes?.includes(d.debtType));
    }

    const sortedDebts = [...eligibleDebts];

    switch (strategy) {
      case 'avalanche':
        // Sort by highest interest rate first, considering promotional rates
        return sortedDebts.sort((a, b) => {
          const rateA = this.getEffectiveRate(a);
          const rateB = this.getEffectiveRate(b);
          // If rates are within 0.5%, prioritize smaller balance for quicker wins and less total interest
          if (Math.abs(rateA - rateB) < 0.5) {
            return a.currentBalance - b.currentBalance;
          }
          return rateB - rateA;
        });

      case 'snowball':
        // Sort by lowest balance first
        return sortedDebts.sort((a, b) => {
          // If balances are very close (within $100), prioritize higher interest
          if (Math.abs(a.currentBalance - b.currentBalance) < 100) {
            return this.getEffectiveRate(b) - this.getEffectiveRate(a);
          }
          return a.currentBalance - b.currentBalance;
        });

      case 'hybrid':
        // Enhanced hybrid strategy: Quick wins first, then highest APR
        const quickWinCount = hybridConfig?.quickWinCount ?? 1;
        
        // Sort all debts by balance for quick wins
        const debtsByBalance = [...sortedDebts].sort((a, b) => 
          a.currentBalance - b.currentBalance
        );
        
        // Take the specified number of quick wins
        const quickWins = debtsByBalance.slice(0, quickWinCount);
        const quickWinIds = new Set(quickWins.map(d => d.id));
        
        // Sort remaining debts by APR (avalanche)
        const remainingDebts = sortedDebts
          .filter(d => !quickWinIds.has(d.id))
          .sort((a, b) => {
            const rateA = this.getEffectiveRate(a);
            const rateB = this.getEffectiveRate(b);
            
            // Check for promotional rates ending soon (within 60 days)
            const aPromoEndingSoon = a.promotionalRateEndDate && 
              new Date(a.promotionalRateEndDate) <= new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
            const bPromoEndingSoon = b.promotionalRateEndDate && 
              new Date(b.promotionalRateEndDate) <= new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
            
            // Prioritize debts with promotional rates ending soon
            if (aPromoEndingSoon && !bPromoEndingSoon) return -1;
            if (!aPromoEndingSoon && bPromoEndingSoon) return 1;
            
            // Otherwise sort by effective rate
            if (Math.abs(rateA - rateB) < 0.01) {
              return a.currentBalance - b.currentBalance;
            }
            return rateB - rateA;
          });
        
        // Combine quick wins and avalanche order
        return [...quickWins, ...remainingDebts];

      default:
        return sortedDebts;
    }
  }

  /**
   * Calculate effective interest rate considering promotional rates
   */
  private static getEffectiveRate(debt: DebtInfo, currentDate: Date): number {
    if (debt.isPromotionalRate && debt.promotionalRateEndDate) {
      const promoEndDate = new Date(debt.promotionalRateEndDate);
      if (currentDate < promoEndDate && debt.promotionalRate !== undefined) {
        return debt.promotionalRate;
      }
    }
    return debt.annualInterestRate;
  }

  /**
   * Calculate monthly interest with proper rounding
   */
  private static calculateMonthlyInterest(balance: number, annualRate: number): number {
    const monthlyRate = annualRate / 100 / 12;
    return Math.round(balance * monthlyRate * 100) / 100;
  }

  /**
   * Optimized payoff calculation with early termination
   */
  static calculatePayoffPlan(
    inputDebts: DebtInfo[],
    totalMonthlyPayment: number,
    strategy: 'avalanche' | 'snowball' | 'hybrid' | 'custom' = 'avalanche',
    customOrder?: number[],
    maxMonths: number = 60 // Only calculate first 60 months by default
  ): DebtPayoffResult {
    // Validate inputs
    if (!inputDebts || inputDebts.length === 0) {
      throw new Error('No debts provided for calculation');
    }

    const totalMinimum = inputDebts.reduce((sum, d) => sum + d.minimumPayment, 0);
    if (totalMonthlyPayment < totalMinimum) {
      throw new Error(`Total monthly payment ($${totalMonthlyPayment}) must be at least the sum of minimum payments ($${totalMinimum})`);
    }

    // Initialize working copies of debts
    const workingDebts = inputDebts.map(d => ({
      ...d,
      balance: d.currentBalance,
      paid: false
    }));

    const orderedDebts = this.getPayoffOrder(inputDebts, strategy, customOrder);
    const schedule: DebtPayoffScheduleItem[] = [];
    
    let month = 0;
    let totalInterestPaid = 0;
    let totalPrincipalPaid = 0;
    const currentDate = new Date();
    const effectiveDate = new Date(currentDate);

    // Calculate payoff with optimization
    while (workingDebts.some(d => !d.paid) && month < this.MAX_PAYOFF_MONTHS) {
      month++;
      const monthDate = new Date(effectiveDate);
      monthDate.setMonth(monthDate.getMonth() + month - 1);

      let availablePayment = totalMonthlyPayment;
      const monthSchedule: DebtPayoffScheduleItem[] = [];

      // First pass: pay minimums on all active debts
      for (const debt of workingDebts) {
        if (debt.paid) continue;

        const effectiveRate = this.getEffectiveRate(debt, monthDate);
        const monthlyInterest = this.calculateMonthlyInterest(debt.balance, effectiveRate);
        const minimumPayment = Math.min(debt.minimumPayment, debt.balance + monthlyInterest);

        const principalPaid = Math.max(0, minimumPayment - monthlyInterest);
        debt.balance = Math.max(0, debt.balance - principalPaid);

        if (debt.balance <= 0.01) { // Account for rounding
          debt.paid = true;
          debt.balance = 0;
        }

        availablePayment -= minimumPayment;
        totalInterestPaid += monthlyInterest;
        totalPrincipalPaid += principalPaid;

        monthSchedule.push({
          month,
          debtName: debt.debtName,
          payment: minimumPayment,
          principalPaid,
          interestPaid: monthlyInterest,
          remainingBalance: debt.balance,
          cumulativeInterest: totalInterestPaid,
          cumulativePrincipal: totalPrincipalPaid
        });
      }

      // Second pass: apply extra payment to target debt
      if (availablePayment > 0.01) {
        for (const targetDebt of orderedDebts) {
          const workingDebt = workingDebts.find(d => d.id === targetDebt.id);
          if (!workingDebt || workingDebt.paid) continue;

          const extraPayment = Math.min(availablePayment, workingDebt.balance);
          workingDebt.balance -= extraPayment;
          totalPrincipalPaid += extraPayment;

          if (workingDebt.balance <= 0.01) {
            workingDebt.paid = true;
            workingDebt.balance = 0;
          }

          // Update the schedule item for this debt
          const scheduleItem = monthSchedule.find(s => s.debtName === workingDebt.debtName);
          if (scheduleItem) {
            scheduleItem.payment += extraPayment;
            scheduleItem.principalPaid += extraPayment;
            scheduleItem.remainingBalance = workingDebt.balance;
            scheduleItem.cumulativePrincipal = totalPrincipalPaid;
          }

          availablePayment -= extraPayment;
          if (availablePayment <= 0.01) break;
        }
      }

      schedule.push(...monthSchedule);

      // Early termination for performance
      if (month >= maxMonths && !workingDebts.every(d => d.paid)) {
        // Continue calculation but don't store full schedule
        break;
      }
    }

    // Calculate remaining months if not fully paid off
    let finalMonths = month;
    if (!workingDebts.every(d => d.paid) && month >= maxMonths) {
      // Quick calculation for remaining months without storing schedule
      finalMonths = this.estimateRemainingMonths(workingDebts, totalMonthlyPayment, month);
    }

    const debtFreeDate = new Date(effectiveDate);
    debtFreeDate.setMonth(debtFreeDate.getMonth() + finalMonths);

    // Calculate savings vs minimum payments
    const minimumOnlyMonths = this.calculateMinimumPaymentMonths(inputDebts);
    const minimumOnlyInterest = this.calculateTotalInterest(inputDebts, minimumOnlyMonths);
    const savingsVsMinimum = minimumOnlyInterest - totalInterestPaid;

    return {
      totalMonths: finalMonths,
      totalInterestPaid,
      totalAmountPaid: totalInterestPaid + inputDebts.reduce((sum, d) => sum + d.currentBalance, 0),
      effectiveDate,
      schedule: schedule.slice(0, maxMonths), // Return only requested months
      strategyUsed: strategy,
      debtFreeDate,
      savingsVsMinimum: Math.max(0, savingsVsMinimum)
    };
  }

  /**
   * Estimate remaining months for performance optimization
   */
  private static estimateRemainingMonths(
    workingDebts: any[],
    monthlyPayment: number,
    currentMonth: number
  ): number {
    const remainingBalance = workingDebts.reduce((sum, d) => sum + d.balance, 0);
    const avgRate = workingDebts.reduce((sum, d) => {
      if (d.balance > 0) {
        return sum + (d.annualInterestRate * d.balance);
      }
      return sum;
    }, 0) / remainingBalance;

    const monthlyRate = avgRate / 100 / 12;
    const estimatedMonths = Math.log(monthlyPayment / (monthlyPayment - remainingBalance * monthlyRate)) / Math.log(1 + monthlyRate);
    
    return currentMonth + Math.ceil(estimatedMonths);
  }

  /**
   * Calculate months to pay off with minimum payments only
   */
  private static calculateMinimumPaymentMonths(debts: DebtInfo[]): number {
    let maxMonths = 0;
    
    for (const debt of debts) {
      const monthlyRate = debt.annualInterestRate / 100 / 12;
      if (monthlyRate === 0) {
        maxMonths = Math.max(maxMonths, Math.ceil(debt.currentBalance / debt.minimumPayment));
      } else {
        const months = Math.log(debt.minimumPayment / (debt.minimumPayment - debt.currentBalance * monthlyRate)) / Math.log(1 + monthlyRate);
        maxMonths = Math.max(maxMonths, Math.ceil(months));
      }
    }
    
    return Math.min(maxMonths, this.MAX_PAYOFF_MONTHS);
  }

  /**
   * Calculate total interest for given payoff period
   */
  private static calculateTotalInterest(debts: DebtInfo[], months: number): number {
    let totalInterest = 0;
    
    for (const debt of debts) {
      const monthlyRate = debt.annualInterestRate / 100 / 12;
      if (monthlyRate === 0) {
        continue;
      }
      
      const totalPaid = debt.minimumPayment * months;
      const interest = totalPaid - debt.currentBalance;
      totalInterest += Math.max(0, interest);
    }
    
    return totalInterest;
  }

  /**
   * Validate debt can be serviced with minimum payment
   */
  static validateDebtServicing(debt: DebtInfo): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const monthlyRate = debt.annualInterestRate / 100 / 12;
    const monthlyInterest = debt.currentBalance * monthlyRate;
    
    if (debt.minimumPayment <= monthlyInterest) {
      errors.push(`Minimum payment ($${debt.minimumPayment}) must exceed monthly interest ($${monthlyInterest.toFixed(2)}) to reduce principal`);
    }
    
    if (debt.currentBalance < 0) {
      errors.push('Current balance cannot be negative');
    }
    
    if (debt.annualInterestRate < 0 || debt.annualInterestRate > 100) {
      errors.push('Annual interest rate must be between 0% and 100%');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check authorization for debt operations
   */
  static async checkDebtOwnership(debtId: number, userId: number): Promise<boolean> {
    const result = await db.select({ id: debts.id })
      .from(debts)
      .where(and(
        eq(debts.id, debtId),
        eq(debts.userId, userId)
      ))
      .limit(1);
    
    return result.length > 0;
  }

  /**
   * Get debt with authorization check
   */
  static async getAuthorizedDebt(debtId: number, userId: number) {
    const result = await db.select()
      .from(debts)
      .where(and(
        eq(debts.id, debtId),
        eq(debts.userId, userId)
      ))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Record a payment with validation
   */
  static async recordPayment(
    debtId: number,
    userId: number,
    paymentData: {
      paymentAmount: number;
      paymentDate: string;
      notes?: string;
    }
  ) {
    // Check ownership
    const debt = await this.getAuthorizedDebt(debtId, userId);
    if (!debt) {
      throw new Error('Debt not found or unauthorized');
    }

    // Calculate interest and principal
    const paymentDate = new Date(paymentData.paymentDate);
    const lastPayment = await db.select()
      .from(debtPayments)
      .where(eq(debtPayments.debtId, debtId))
      .orderBy(desc(debtPayments.paymentDate))
      .limit(1);

    const daysSinceLastPayment = lastPayment[0] 
      ? Math.ceil((paymentDate.getTime() - new Date(lastPayment[0].paymentDate).getTime()) / (1000 * 60 * 60 * 24))
      : 30;

    const dailyRate = Number(debt.annualInterestRate) / 100 / 365;
    const interestPaid = Number(debt.currentBalance) * dailyRate * daysSinceLastPayment;
    const principalPaid = Math.max(0, paymentData.paymentAmount - interestPaid);
    const remainingBalance = Math.max(0, Number(debt.currentBalance) - principalPaid);

    // Record payment in transaction
    return await db.transaction(async (tx) => {
      // Insert payment record
      const [payment] = await tx.insert(debtPayments).values({
        debtId,
        paymentAmount: paymentData.paymentAmount.toString(),
        paymentDate: paymentData.paymentDate,
        principalPaid: principalPaid.toString(),
        interestPaid: interestPaid.toString(),
        remainingBalance: remainingBalance.toString(),
        notes: paymentData.notes
      }).returning();

      // Update debt balance
      await tx.update(debts)
        .set({ 
          currentBalance: remainingBalance.toString(),
          updatedAt: new Date()
        })
        .where(eq(debts.id, debtId));

      return payment;
    });
  }
}