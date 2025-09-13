import { calculateSocialSecurityBenefit } from './server/social-security-calculator';

const profiles = [
  { name: "Alex Rivera", monthlyIncome: 6500, age: 28, retirementAge: 65 },
  { name: "Jordan Lee", monthlyIncome: 8200, age: 42, retirementAge: 62 },
  { name: "Pat Nguyen", monthlyIncome: 12000, age: 55, retirementAge: 67 },
  { name: "Chris Patel", monthlyIncome: 3200, age: 35, retirementAge: 70 },
  { name: "Taylor Kim", monthlyIncome: 14000, age: 48, retirementAge: 60 }
];

console.log("Social Security Benefit Calculations:");
console.log("=====================================");

profiles.forEach(p => {
  const benefit = calculateSocialSecurityBenefit(
    p.monthlyIncome, 
    p.age, 
    p.retirementAge,
    p.retirementAge - 22
  );
  const replacementRate = (benefit / p.monthlyIncome * 100).toFixed(1);
  const nameDisplay = p.name + ' '.repeat(20 - p.name.length);
  const incomeDisplay = '$' + p.monthlyIncome.toLocaleString();
  const benefitDisplay = '$' + benefit.toLocaleString();
  console.log(`${nameDisplay} Income: ${incomeDisplay} → SS: ${benefitDisplay}/mo (${replacementRate}%)`);
});