// Debug which contribution path is being taken
import { RetirementMonteCarloParams } from './monte-carlo-base.js';

const testParams: RetirementMonteCarloParams = {
  monthlyContribution401k: 2500,
  monthlyContributionIRA: 700,
  monthlyContributionRothIRA: 0,
  spouseMonthlyContribution401k: 2200,
  spouseMonthlyContributionIRA: 600,
  spouseMonthlyContributionRothIRA: 0,
} as any;

console.log('Testing contribution path condition...');
console.log('params.monthlyContribution401k:', testParams.monthlyContribution401k);
console.log('params.monthlyContributionIRA:', testParams.monthlyContributionIRA);
console.log('params.monthlyContributionRothIRA:', testParams.monthlyContributionRothIRA);
console.log('params.spouseMonthlyContribution401k:', testParams.spouseMonthlyContribution401k);
console.log('params.spouseMonthlyContributionIRA:', testParams.spouseMonthlyContributionIRA);
console.log('params.spouseMonthlyContributionRothIRA:', testParams.spouseMonthlyContributionRothIRA);

const condition = testParams.monthlyContribution401k || testParams.monthlyContributionIRA || testParams.monthlyContributionRothIRA ||
                 testParams.spouseMonthlyContribution401k || testParams.spouseMonthlyContributionIRA || testParams.spouseMonthlyContributionRothIRA;

console.log('Condition result:', condition);
console.log('Should use specific contribution path:', !!condition);