import { 
  calculateAIME, 
  calculatePIA, 
  adjustPIAForClaimAge,
  calculateSocialSecurityBenefit 
} from './server/social-security-calculator';

const chris = { 
  name: "Chris Patel", 
  monthlyIncome: 3200, 
  age: 35, 
  retirementAge: 70,
  yearsWorked: 48 // 70 - 22
};

console.log("Detailed SS Calculation for Chris Patel:");
console.log("=========================================");
console.log(`Monthly Income: $${chris.monthlyIncome}`);
console.log(`Years Worked: ${chris.yearsWorked}`);
console.log(`Adjusted Years (75%): ${chris.yearsWorked * 0.75}`);

const aime = calculateAIME(chris.monthlyIncome, chris.yearsWorked * 0.75);
console.log(`\nAIME: $${aime.toFixed(2)}`);

const pia = calculatePIA(aime);
console.log(`PIA at FRA (67): $${pia.toFixed(2)}`);

const benefitAt70 = adjustPIAForClaimAge(pia, 70);
console.log(`Benefit at 70 (with delayed credits): $${benefitAt70.toFixed(2)}`);

const finalBenefit = calculateSocialSecurityBenefit(
  chris.monthlyIncome,
  chris.age,
  chris.retirementAge,
  chris.yearsWorked
);
console.log(`\nFinal Calculated Benefit: $${finalBenefit}`);
console.log(`Replacement Rate: ${(finalBenefit / chris.monthlyIncome * 100).toFixed(1)}%`);
console.log(`\nCoverage of $1,960 expenses: ${(finalBenefit / 1960 * 100).toFixed(1)}%`);